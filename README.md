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
| `get_social_links` | LinkedIn followers, Instagram, Twitter/X, YouTube URLs |
| `get_funding_and_investors` | Total funding raised, rounds, investor list, valuation |
| `get_team_info` | Verified founders with roles, LinkedIn URLs, employee count |
| `get_latest_news` | Recent press articles sorted newest first |
| `get_full_profile` | All of the above in a single merged JSON response |

---

## Install

```bash
npm install -g @shibadityadeb-propacity/propacity-mcp
```

### Update to latest version

```bash
npm install -g @shibadityadeb-propacity/propacity-mcp@latest
```

---

## CLI commands

Once installed, use directly from your terminal — no JSON, no pipes:

```bash
propacity-mcp overview    # Company title, description, HQ, founded year
propacity-mcp social      # LinkedIn followers, Instagram, Twitter, YouTube
propacity-mcp funding     # Funding rounds, investors, total raised
propacity-mcp team        # Founders with roles + total employee count
propacity-mcp news        # Latest news from Google News RSS
propacity-mcp profile     # Everything above in one call
propacity-mcp --help      # Show all commands
```

### Example output

```
propacity-mcp social

──────────────────────────────────────────────────
 Social Links
──────────────────────────────────────────────────
 Status : OK
 Fetched: 2025-05-17T06:47:30.497Z
──────────────────────────────────────────────────

 Linkedin:
   Followers: 39106
   Employees: 102
   Location: Delhi
   Url: https://in.linkedin.com/company/propacity
 Instagram:
   Url: https://www.instagram.com/propacity.in/
   Note: Instagram restricts public follower data
 Twitter:
   Url: https://twitter.com/propacity_in
 Youtube:
   Url: https://www.youtube.com/@propacity
```

---

## Claude Desktop setup

**Step 1.** Open (or create) the config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Step 2.** Add this and save:

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

**Step 3.** Restart Claude Desktop. Click the hammer icon to confirm all 6 Propacity tools are listed.

If you installed globally, you can also use:

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
- `errors` — list of non-fatal partial failures; data is still returned

---

## How it works

```
Terminal / Claude Desktop
     │
     ▼
src/index.js          ← CLI mode (args) or MCP server (no args, stdio)
     │
     ▼
src/fetchers.js       ← scraping logic (axios + cheerio)
     │
     ├── in.linkedin.com/company/propacity   (followers, employees, location)
     ├── instagram.com/propacity.in          (profile — Meta restricts data)
     ├── news.google.com/rss                 (Google News RSS, no JS needed)
     ├── crunchbase.com                      (funding — 403, uses static data)
     └── yourstory.com                       (funding — 403, uses static data)
```

Key design decisions:

- **Dual mode** — pass a command (`propacity-mcp overview`) for CLI output; no args = MCP stdio server for Claude Desktop
- **All HTTP requests** have a 12 s timeout, browser-like headers, and legacy TLS support
- **`get_full_profile`** fires all 5 fetchers in parallel via `Promise.allSettled`
- **Graceful degradation** — blocked sources (Crunchbase/YourStory 403) fall back to known public data with a note

---

## Local development

```bash
git clone https://github.com/shibadityadeb-propacity/propacity-mcp.git
cd propacity-mcp
npm install

# Test a single fetcher
node src/index.js overview

# Run as MCP server (for Claude Desktop)
node src/index.js
```

### Project structure

```
propacity-mcp/
├── src/
│   ├── index.js      # CLI + MCP server entry point
│   └── fetchers.js   # All scraping functions
├── package.json
├── .npmignore
└── README.md
```

---

## Founders

| Name | Role | LinkedIn |
|---|---|---|
| Uday Vansh Malik | Co-Founder & CEO | [linkedin.com/in/udayvanshmalik](https://www.linkedin.com/in/udayvanshmalik/) |
| Rahul Bansal | Co-Founder & CTO | [linkedin.com/in/rahulbansal7](https://www.linkedin.com/in/rahulbansal7/) |
| Imran Shaikh | Co-Founder & COO | [linkedin.com/in/imranshaikh4](https://www.linkedin.com/in/imranshaikh4/) |

---

## Publishing a new version

```bash
npm version patch --no-git-tag-version
npm publish --access public
```

---

## License

MIT © [Propacity](https://propacity.in)
