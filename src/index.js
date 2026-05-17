#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  fetchCompanyOverview,
  fetchSocialLinks,
  fetchFundingAndInvestors,
  fetchTeamInfo,
  fetchLatestNews,
  fetchFullProfile,
} from "./fetchers.js";

// ─── CLI mode ────────────────────────────────────────────────────────────────
// If a command argument is passed (e.g. `propacity-mcp overview`),
// run as a plain CLI and print formatted output — no MCP / JSON-RPC involved.

const COMMANDS = {
  overview:  { label: "Company Overview",      fn: fetchCompanyOverview },
  social:    { label: "Social Links",          fn: fetchSocialLinks },
  funding:   { label: "Funding & Investors",   fn: fetchFundingAndInvestors },
  team:      { label: "Team Info",             fn: fetchTeamInfo },
  news:      { label: "Latest News",           fn: fetchLatestNews },
  profile:   { label: "Full Profile",          fn: fetchFullProfile },
};

function printHelp() {
  console.log(`
  propacity-mcp <command>

  Commands:
    overview   Company title, description, HQ, founded year
    social     Social media links (LinkedIn, Twitter, Instagram, YouTube)
    funding    Funding rounds, investors, total raised
    team       Founders and key team members
    news       Latest news articles from Google News
    profile    Full profile — all of the above in one call

  Examples:
    propacity-mcp overview
    propacity-mcp news
    propacity-mcp profile
  `);
}

function formatValue(val, indent = 0) {
  const pad = " ".repeat(indent);
  if (val === null || val === undefined) return "N/A";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "None";
    return val
      .map((v) =>
        typeof v === "object" ? "\n" + formatObject(v, indent + 4) : `${pad}  • ${v}`
      )
      .join("\n");
  }
  if (typeof val === "object") return "\n" + formatObject(val, indent + 2);
  return String(val);
}

function formatObject(obj, indent = 2) {
  const pad = " ".repeat(indent);
  return Object.entries(obj)
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      const value = formatValue(v, indent);
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        return `${pad}${label}:${value}`;
      }
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        return `${pad}${label}:${value}`;
      }
      return `${pad}${label}: ${value}`;
    })
    .join("\n");
}

function printResult(label, result) {
  const divider = "─".repeat(50);
  console.log(`\n${divider}`);
  console.log(` ${label}`);
  console.log(`${divider}`);

  if (!result.success && result.errors?.length) {
    console.log(` Status : partial (some sources failed)`);
  } else {
    console.log(` Status : OK`);
  }
  console.log(` Fetched: ${result.fetched_at}`);
  console.log(`${divider}\n`);

  if (result.data) {
    console.log(formatObject(result.data, 1));
  }

  if (result.errors?.length) {
    console.log(`\n Notes:`);
    result.errors.forEach((e) => console.log(`  ⚠ ${e}`));
  }

  console.log(`\n Sources:`);
  (result.sources || []).forEach((s) => console.log(`  → ${s}`));
  console.log();
}

const arg = process.argv[2];

if (arg) {
  if (arg === "--help" || arg === "-h" || arg === "help") {
    printHelp();
    process.exit(0);
  }

  const cmd = COMMANDS[arg];
  if (!cmd) {
    console.error(`\n  Unknown command: "${arg}"`);
    printHelp();
    process.exit(1);
  }

  console.log(`\n  Fetching ${cmd.label}...`);
  try {
    const result = await cmd.fn();
    printResult(cmd.label, result);
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// ─── MCP server mode (no args → stdio transport for Claude Desktop) ──────────

const server = new McpServer({
  name: "propacity-mcp",
  version: "1.0.2",
});

function toToolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

async function runTool(fn, toolName) {
  try {
    return toToolResult(await fn());
  } catch (err) {
    return toToolResult({
      success: false,
      data: null,
      sources: [],
      fetched_at: new Date().toISOString(),
      errors: [`Unexpected error in ${toolName}: ${err.message}`],
    });
  }
}

server.tool("get_company_overview", "Scrape propacity.in and return company overview: title, meta description, tagline, headquarters, and founded year.", {},
  () => runTool(fetchCompanyOverview, "get_company_overview"));

server.tool("get_social_links", "Return all social media links for Propacity (LinkedIn, Twitter/X, Facebook, Instagram, YouTube).", {},
  () => runTool(fetchSocialLinks, "get_social_links"));

server.tool("get_funding_and_investors", "Fetch funding data for Propacity from Crunchbase and YourStory: total funding raised, number of rounds, investor list, and valuation.", {},
  () => runTool(fetchFundingAndInvestors, "get_funding_and_investors"));

server.tool("get_team_info", "Return founders and key team members of Propacity with names, roles, and LinkedIn URLs.", {},
  () => runTool(fetchTeamInfo, "get_team_info"));

server.tool("get_latest_news", "Search for recent news and press coverage about Propacity. Returns list of articles sorted by newest.", {},
  () => runTool(fetchLatestNews, "get_latest_news"));

server.tool("get_full_profile", "Call all Propacity tools in parallel and return a single merged JSON object.", {},
  () => runTool(fetchFullProfile, "get_full_profile"));

const transport = new StdioServerTransport();
await server.connect(transport);
