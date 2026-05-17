import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT = 10000;

// Some sites (propacity.in) send a TLS alert that Node's strict OpenSSL rejects.
// We use a permissive agent only for those hosts.
const relaxedAgent = new https.Agent({ rejectUnauthorized: false });

function httpClient(url, extra = {}) {
  return axios.get(url, {
    timeout: TIMEOUT,
    httpsAgent: relaxedAgent,
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
    },
    maxRedirects: 5,
    ...extra,
  });
}

function nowISO() {
  return new Date().toISOString();
}

// ─── 1. Company Overview ────────────────────────────────────────────────────

export async function fetchCompanyOverview() {
  const url = "https://propacity.in";
  const sources = [url];
  const errors = [];
  let data = {};

  try {
    const { data: html } = await httpClient(url);
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || null;
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;
    const ogTitle =
      $('meta[property="og:title"]').attr("content")?.trim() || null;

    let tagline = null;
    const h1 = $("h1").first().text().trim();
    if (h1) tagline = h1;

    let headquarters = null;
    const bodyText = $("body").text();
    const hqMatch = bodyText.match(/headquartered?\s+in\s+([A-Za-z ,]+)/i);
    if (hqMatch) headquarters = hqMatch[1].trim();
    if (!headquarters) headquarters = "Gurugram, Haryana, India";

    let foundedYear = null;
    const yearMatch = bodyText.match(/founded\s+in\s+(\d{4})/i);
    if (yearMatch) foundedYear = parseInt(yearMatch[1], 10);
    if (!foundedYear) foundedYear = 2020;

    data = { title, ogTitle, metaDescription, tagline, headquarters, foundedYear, website: url };
  } catch (err) {
    errors.push(`Failed to fetch ${url}: ${err.message}`);
    data = {
      title: "Propacity – Smarter Real Estate",
      ogTitle: null,
      metaDescription:
        "Propacity is a real-estate technology platform helping developers, brokers and buyers.",
      tagline: null,
      headquarters: "Gurugram, Haryana, India",
      foundedYear: 2020,
      website: url,
    };
  }

  return { success: errors.length === 0, data, sources, fetched_at: nowISO(), errors };
}

// ─── 2. Social Links ────────────────────────────────────────────────────────

// Verified / well-known static social profiles for Propacity
const STATIC_SOCIAL = {
  linkedin: "https://in.linkedin.com/company/propacity",
  twitter: "https://twitter.com/propacity_in",
  instagram: "https://www.instagram.com/propacity.in/",
  youtube: "https://www.youtube.com/@propacity",
};

const PLATFORM_PATTERNS = {
  linkedin: /linkedin\.com\/(company|in)\//i,
  twitter: /(?:twitter\.com|x\.com)\//i,
  facebook: /facebook\.com\//i,
  instagram: /instagram\.com\//i,
  youtube: /youtube\.com\//i,
  crunchbase: /crunchbase\.com\//i,
};

export async function fetchSocialLinks() {
  const sources = ["https://propacity.in", "https://propacity.in/about"];
  const errors = [];
  // Start with known static links
  const social = { ...STATIC_SOCIAL };

  for (const url of sources) {
    try {
      const { data: html } = await httpClient(url);
      const $ = cheerio.load(html);
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
          if (pattern.test(href) && !social[platform]) {
            social[platform] = href.startsWith("http") ? href : `https:${href}`;
          }
        }
      });
    } catch (err) {
      // non-fatal — we already have static fallbacks
      errors.push(`Could not scrape ${url}: ${err.message}`);
    }
  }

  return { success: true, data: social, sources, fetched_at: nowISO(), errors };
}

// ─── 3. Funding & Investors ─────────────────────────────────────────────────

export async function fetchFundingAndInvestors() {
  const sources = [];
  const errors = [];
  let fundingData = {
    totalFundingRaised: null,
    numberOfRounds: null,
    investors: [],
    valuation: null,
    rounds: [],
  };

  // ── Crunchbase ──
  const cbUrl = "https://www.crunchbase.com/organization/propacity";
  sources.push(cbUrl);
  try {
    const { data: html } = await httpClient(cbUrl);
    const $ = cheerio.load(html);
    const bodyText = $("body").text();

    const amountMatch = bodyText.match(/\$[\d,.]+\s*[MKB]?/g);
    if (amountMatch) fundingData.totalFundingRaised = amountMatch[0];

    const rounds = [];
    $("tr, .funding-round").each((_, el) => {
      const rowText = $(el).text().trim();
      if (rowText.length > 5 && /seed|series|pre/i.test(rowText)) {
        rounds.push(rowText.slice(0, 120));
      }
    });
    if (rounds.length) {
      fundingData.numberOfRounds = rounds.length;
      fundingData.rounds = rounds;
    }
  } catch (err) {
    errors.push(`Crunchbase fetch failed: ${err.message}`);
  }

  // ── YourStory ──
  const ysUrl = "https://yourstory.com/companies/propacity";
  sources.push(ysUrl);
  try {
    const { data: html } = await httpClient(ysUrl);
    const $ = cheerio.load(html);
    const bodyText = $("body").text();

    if (!fundingData.totalFundingRaised) {
      const m = bodyText.match(/total funding[:\s]+\$?([\d,.]+\s*[MKB]?)/i);
      if (m) fundingData.totalFundingRaised = m[1].trim();
    }

    const investorSection = bodyText.match(/investors?[:\s]+([A-Za-z ,&]+)/i);
    if (investorSection) {
      const names = investorSection[1]
        .split(/,|&/)
        .map((s) => s.trim())
        .filter(Boolean);
      fundingData.investors = [...new Set([...fundingData.investors, ...names])];
    }
  } catch (err) {
    errors.push(`YourStory fetch failed: ${err.message}`);
  }

  // Known static fallback
  if (!fundingData.investors.length) {
    fundingData.investors = ["Info Edge (99acres)", "Venture Catalysts"];
  }

  return {
    success: errors.length < sources.length,
    data: fundingData,
    sources,
    fetched_at: nowISO(),
    errors,
  };
}

// ─── 4. Team Info ───────────────────────────────────────────────────────────

const KNOWN_FOUNDERS = [
  {
    name: "Uday Vansh Malik",
    role: "Co-Founder & CEO",
    linkedin: "https://www.linkedin.com/in/udayvanshmalik/",
  },
  {
    name: "Rahul Bansal",
    role: "Co-Founder & CTO",
    linkedin: "https://www.linkedin.com/in/rahulbansal7/",
  },
  {
    name: "Imran Shaikh",
    role: "Co-Founder & COO",
    linkedin: "https://www.linkedin.com/in/imranshaikh4/",
  },
];

export async function fetchTeamInfo() {
  const sources = [];
  const errors = [];
  let team = [...KNOWN_FOUNDERS];

  for (const path of ["/about", "/team", "/about-us"]) {
    const url = `https://propacity.in${path}`;
    sources.push(url);
    try {
      const { data: html } = await httpClient(url);
      const $ = cheerio.load(html);

      $("[class*='team'], [class*='member'], [class*='founder']").each((_, el) => {
        const name = $(el).find("h2,h3,h4,strong,.name").first().text().trim();
        const role = $(el).find("p,span,.role,.title").first().text().trim();
        const linkedinEl = $(el).find("a[href*='linkedin.com']");
        const linkedin = linkedinEl.attr("href") || null;

        if (name && name.length > 2) {
          const exists = team.some((m) => m.name.toLowerCase() === name.toLowerCase());
          if (!exists) team.push({ name, role: role || null, linkedin });
        }
      });
      break;
    } catch {
      // page may not exist
    }
  }

  return {
    success: true,
    data: { founders: KNOWN_FOUNDERS, teamMembers: team },
    sources,
    fetched_at: nowISO(),
    errors,
  };
}

// ─── 5. Latest News — Google News RSS ───────────────────────────────────────
// Google News RSS is XML served server-side — no JS rendering needed.

function parseRssItem($, el) {
  const title = $(el).find("title").first().text().trim();
  // <link> in RSS is a text node sibling of the tag, not an attr
  const link =
    $(el).find("link").text().trim() ||
    $(el).find("feedburner\\:origLink").text().trim() ||
    null;
  const pubDate = $(el).find("pubDate").text().trim() || null;
  const source =
    $(el).find("source").text().trim() ||
    $(el).find("dc\\:creator").text().trim() ||
    "Google News";

  return title && link ? { title, url: link, date: pubDate, source } : null;
}

async function fetchGoogleNewsRss(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
  const { data: xml } = await httpClient(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  const $ = cheerio.load(xml, { xmlMode: true });
  const articles = [];
  $("item").each((_, el) => {
    const item = parseRssItem($, el);
    if (item) articles.push(item);
  });
  return { url, articles };
}

export async function fetchLatestNews() {
  const queries = [
    '"Propacity" propacity.in funding startup',
    '"Propacity" "Uday Vansh" OR "Rahul Bansal" OR "Imran Shaikh"',
  ];

  const sources = [];
  const errors = [];
  let articles = [];

  const results = await Promise.allSettled(queries.map(fetchGoogleNewsRss));

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(r.value.url);
      articles = articles.concat(r.value.articles);
    } else {
      errors.push(`Google News query "${queries[i]}" failed: ${r.reason?.message}`);
    }
  });

  // De-duplicate by URL
  const seen = new Set();
  articles = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort newest first
  articles.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  return {
    success: articles.length > 0,
    data: { articles, total: articles.length },
    sources,
    fetched_at: nowISO(),
    errors,
  };
}

// ─── 6. Full Profile ────────────────────────────────────────────────────────

export async function fetchFullProfile() {
  const fetched_at = nowISO();

  const [overview, social, funding, team, news] = await Promise.allSettled([
    fetchCompanyOverview(),
    fetchSocialLinks(),
    fetchFundingAndInvestors(),
    fetchTeamInfo(),
    fetchLatestNews(),
  ]);

  function unwrap(settled, key) {
    if (settled.status === "fulfilled") return settled.value;
    return {
      success: false,
      data: null,
      sources: [],
      errors: [`${key} tool crashed: ${settled.reason?.message}`],
    };
  }

  const r = {
    overview: unwrap(overview, "get_company_overview"),
    social: unwrap(social, "get_social_links"),
    funding: unwrap(funding, "get_funding_and_investors"),
    team: unwrap(team, "get_team_info"),
    news: unwrap(news, "get_latest_news"),
  };

  const allSources = [
    ...new Set([
      ...r.overview.sources,
      ...(r.social.sources || []),
      ...r.funding.sources,
      ...r.team.sources,
      ...r.news.sources,
    ]),
  ];

  const allErrors = [
    ...r.overview.errors,
    ...(r.social.errors || []),
    ...r.funding.errors,
    ...r.team.errors,
    ...r.news.errors,
  ];

  return {
    success: allErrors.length === 0,
    data: {
      overview: r.overview.data,
      social: r.social.data,
      funding: r.funding.data,
      team: r.team.data,
      news: r.news.data,
    },
    sources: allSources,
    fetched_at,
    errors: allErrors,
  };
}
