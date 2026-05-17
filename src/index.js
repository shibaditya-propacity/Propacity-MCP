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

const server = new McpServer({
  name: "propacity-mcp",
  version: "1.0.0",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toToolResult(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function runTool(fn, toolName) {
  try {
    const result = await fn();
    return toToolResult(result);
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

// ─── Tool Registrations ───────────────────────────────────────────────────────

server.tool(
  "get_company_overview",
  "Scrape propacity.in and return company overview: title, meta description, tagline, headquarters, and founded year.",
  {}, // no input args
  () => runTool(fetchCompanyOverview, "get_company_overview")
);

server.tool(
  "get_social_links",
  "Return all social media links for Propacity (LinkedIn, Twitter/X, Facebook, Instagram, YouTube) scraped from propacity.in plus known static links.",
  {},
  () => runTool(fetchSocialLinks, "get_social_links")
);

server.tool(
  "get_funding_and_investors",
  "Fetch funding data for Propacity from Crunchbase and YourStory: total funding raised, number of rounds, investor list, and valuation if available.",
  {},
  () => runTool(fetchFundingAndInvestors, "get_funding_and_investors")
);

server.tool(
  "get_team_info",
  "Return founders and key team members of Propacity with names, roles, and LinkedIn URLs. Known founders: Uday Vansh Malik, Rahul Bansal, Imran Shaikh.",
  {},
  () => runTool(fetchTeamInfo, "get_team_info")
);

server.tool(
  "get_latest_news",
  "Search for recent news and press coverage about Propacity from YourStory, Entrackr, and Inc42. Returns list of articles sorted by newest.",
  {},
  () => runTool(fetchLatestNews, "get_latest_news")
);

server.tool(
  "get_full_profile",
  "Call all Propacity tools in parallel and return a single merged JSON object with company overview, social links, funding, team info, and latest news.",
  {},
  () => runTool(fetchFullProfile, "get_full_profile")
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
// MCP servers communicate over stdio — do NOT write to stdout after connecting
