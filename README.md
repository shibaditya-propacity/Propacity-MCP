# @shibadityadeb-propacity/propacity-mcp

A production-ready **Model Context Protocol (MCP)** server that provides real-time data about **Propacity** (propacity.in) — an Indian real-estate technology platform.

## Tools

| Tool | Description |
|---|---|
| `get_company_overview` | Title, meta description, tagline, HQ, founded year scraped from propacity.in |
| `get_social_links` | All social media links (LinkedIn, Twitter/X, Facebook, Instagram, YouTube) |
| `get_funding_and_investors` | Funding rounds, total raised, investors from Crunchbase + YourStory |
| `get_team_info` | Founders & key team members with roles and LinkedIn URLs |
| `get_latest_news` | Recent press from YourStory, Entrackr, Inc42 — sorted newest first |
| `get_full_profile` | Calls all tools in parallel and returns a single merged JSON profile |

## Response shape

Every tool returns a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "sources": ["https://...", "https://..."],
  "fetched_at": "2024-01-01T00:00:00.000Z",
  "errors": []
}
```

Partial failures are non-fatal — `errors` will contain notes while `data` carries whatever was retrievable.

## Installation

```bash
npm install -g @shibadityadeb-propacity/propacity-mcp
# or run directly with npx (no install needed)
npx @shibadityadeb-propacity/propacity-mcp
```

## Claude Desktop configuration

Add this to your `claude_desktop_config.json`:

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

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Local development

```bash
git clone <repo>
cd propacity-mcp
npm install
node src/index.js
```

## How it works

- `src/index.js` — MCP server wiring (tool registration, stdio transport)
- `src/fetchers.js` — All scraping logic using `axios` + `cheerio`
- All HTTP requests carry a `10 s` timeout and a descriptive `User-Agent`
- `get_full_profile` uses `Promise.allSettled` so one failing source never blocks the others

## Known founders

- **Uday Vansh Malik** — Co-Founder & CEO
- **Rahul Bansal** — Co-Founder & CTO
- **Imran Shaikh** — Co-Founder & COO

## License

MIT
