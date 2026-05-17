# @shibadityadeb-propacity/propacity-mcp

A production-ready **Model Context Protocol (MCP)** server that gives any MCP-compatible AI client (Claude Desktop, Cursor, etc.) real-time data about **[Propacity](https://propacity.in)** — India's #1 platform to invest in Bharat's real estate.

---

## What is this?

MCP servers expose tools that AI assistants can call just like functions. Once this server is connected to Claude Desktop, you can ask things like:

- _"What does Propacity do?"_
- _"Who are the founders of Propacity?"_
- _"Show me the latest news about Propacity."_
- _"Give me the full Propacity company profile."_

…and Claude will call the right tool, fetch live data, and answer you.

---

## Available tools

| Tool | What it returns |
|---|---|
| `get_company_overview` | Title, meta description, tagline, headquarters, founded year |
| `get_social_links` | LinkedIn, Twitter/X, Instagram, YouTube URLs |
| `get_funding_and_investors` | Total funding raised, rounds, investor list, valuation |
| `get_team_info` | Founders and key team members with roles and LinkedIn URLs |
| `get_latest_news` | Recent press articles sorted newest first |
| `get_full_profile` | All of the above in a single merged JSON response |

---

## Quick start

### Option 1 — Claude Desktop (recommended)

**Step 1.** Open (or create) the Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Step 2.** Add the following and save:

```json
{
  "mcpServers": {
    "propacity": {
      "command": "npx",
      "args": ["-y", "@shibadityadeb-propacity/propacity-mcp"]
    }
  }
}
```

**Step 3.** Restart Claude Desktop. You should see a hammer icon — click it to confirm the 6 Propacity tools are listed.

No installation required — `npx` downloads and runs the package automatically.

---

### Option 2 — Install globally + use from terminal

```bash
npm install -g @shibadityadeb-propacity/propacity-mcp
```

Then run commands directly from your terminal — no JSON, no pipes:

```bash
propacity-mcp overview    # Company title, description, HQ, founded year
propacity-mcp social      # LinkedIn, Twitter, Instagram, YouTube
propacity-mcp funding     # Funding rounds, investors, total raised
propacity-mcp team        # Founders and key team members
propacity-mcp news        # Latest news from Google News
propacity-mcp profile     # Everything above in one call

propacity-mcp --help      # Show all commands
```

Or use the global binary in Claude Desktop config:

```json
{
  "mcpServers": {
    "propacity": {
      "command": "propacity-mcp"
    }
  }
}
```

---

### Option 3 — Run directly (for testing)

```bash
npx @shibadityadeb-propacity/propacity-mcp
```

The server starts and listens on stdio. Send a JSON-RPC `tools/list` request to see all registered tools.

---

## Response format

Every tool returns the same consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "sources": ["https://propacity.in", "https://..."],
  "fetched_at": "2025-05-17T10:00:00.000Z",
  "errors": []
}
```

- `success` — `false` only if all sources failed
- `data` — the actual payload (shape varies per tool)
- `sources` — every URL that was scraped
- `fetched_at` — ISO timestamp of when the fetch ran
- `errors` — list of non-fatal errors (partial failures); data is still returned

---

## How it works

```
Claude Desktop
     │  JSON-RPC over stdio
     ▼
src/index.js          ← MCP server, registers all 6 tools
     │
     ▼
src/fetchers.js       ← scraping logic (axios + cheerio)
     │
     ├── propacity.in          (homepage + about page)
     ├── news.google.com/rss   (Google News RSS — no JS rendering needed)
     ├── crunchbase.com        (funding — may 403, falls back to static data)
     └── yourstory.com         (funding/investors — may 403, falls back)
```

Key design decisions:

- **All HTTP requests** have a 10 s timeout and a browser-like `User-Agent`
- **`get_full_profile`** fires all 5 fetchers in parallel via `Promise.allSettled` — one failing source never blocks the rest
- **Graceful degradation** — if a site blocks scraping (Crunchbase/YourStory return 403), the tool returns known static data plus an error note instead of crashing
- **Google News RSS** is used for news instead of JS-rendered sites (YourStory, Inc42, Entrackr) because RSS is server-rendered XML

---

## Local development

```bash
# Clone and install
git clone https://github.com/shibadityadeb-propacity/propacity-mcp.git
cd propacity-mcp
npm install

# Run the MCP server
node src/index.js

# Quick tool test (no Claude Desktop needed)
node --input-type=module <<'EOF'
import { fetchCompanyOverview, fetchLatestNews } from './src/fetchers.js';
console.log(await fetchCompanyOverview());
console.log(await fetchLatestNews());
EOF
```

### Project structure

```
propacity-mcp/
├── src/
│   ├── index.js      # MCP server — tool registration + stdio transport
│   └── fetchers.js   # All scraping functions (imported by index.js)
├── package.json
├── .npmignore
└── README.md
```

---

## Known founders

| Name | Role | LinkedIn |
|---|---|---|
| Uday Vansh Malik | Co-Founder & CEO | [linkedin.com/in/udayvanshmalik](https://www.linkedin.com/in/udayvanshmalik/) |
| Rahul Bansal | Co-Founder & CTO | [linkedin.com/in/rahulbansal7](https://www.linkedin.com/in/rahulbansal7/) |
| Imran Shaikh | Co-Founder & COO | [linkedin.com/in/imranshaikh4](https://www.linkedin.com/in/imranshaikh4/) |

---

## Publishing a new version

```bash
# Bump version (patch / minor / major)
npm version patch

# Publish to npm
npm publish --access public
```

---

## License

MIT © [Propacity](https://propacity.in)
