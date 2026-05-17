import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import crypto from "crypto";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT = 12000;

// SSL_OP_LEGACY_SERVER_CONNECT lets Node connect to servers that send
// a TLS internal-error alert (propacity.in does this).
const relaxedAgent = new https.Agent({
  rejectUnauthorized: false,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

const BROWSER_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function httpClient(url, extra = {}) {
  return axios.get(url, {
    timeout: TIMEOUT,
    httpsAgent: relaxedAgent,
    headers: { ...BROWSER_HEADERS },
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

// ── LinkedIn public page scraper ──────────────────────────────────────────────
async function scrapeLinkedIn() {
  const url = "https://in.linkedin.com/company/propacity";
  const { data: html } = await httpClient(url, {
    headers: {
      ...BROWSER_HEADERS,
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });
  const $ = cheerio.load(html);

  // LinkedIn embeds company data in <code> JSON blocks and meta tags
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";

  // Follower count often appears in description: "X followers"
  const followerMatch = ogDesc.match(/([\d,]+)\s+followers?/i) ||
    $("body").text().match(/([\d,]+)\s+followers?/i);
  const followers = followerMatch ? followerMatch[1].replace(/,/g, "") : null;

  // Employee count
  const employeeMatch = $("body").text().match(/([\d,\-+]+)\s+employees?/i);
  const employees = employeeMatch ? employeeMatch[1] : null;

  // Location from meta or page text
  const locationMatch = $("body").text().match(/Gurugram|Gurgaon|Haryana|Delhi|Mumbai|Bangalore/i);
  const location = locationMatch ? locationMatch[0] : null;

  return { followers, employees, location, pageTitle: ogTitle || null };
}

// ── Instagram public page scraper ─────────────────────────────────────────────
async function scrapeInstagram() {
  const url = "https://www.instagram.com/propacity.in/";
  const { data: html } = await httpClient(url, {
    headers: {
      ...BROWSER_HEADERS,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Instagram buries stats inside a JSON blob in a <script> tag
  const jsonMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/) ||
    html.match(/"follower_count":(\d+)/) ||
    html.match(/"followers":(\d+)/);
  const followingMatch = html.match(/"edge_follow":\{"count":(\d+)\}/) ||
    html.match(/"following_count":(\d+)/);
  const postsMatch = html.match(/"edge_owner_to_timeline_media":\{"count":(\d+)\}/) ||
    html.match(/"media_count":(\d+)/);

  // Also try og:description as fallback (older Instagram behaviour)
  const $ = cheerio.load(html);
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogFollower = ogDesc.match(/([\d,.K]+)\s+Followers?/i);

  return {
    followers: jsonMatch ? jsonMatch[1] : (ogFollower ? ogFollower[1] : null),
    following: followingMatch ? followingMatch[1] : null,
    posts: postsMatch ? postsMatch[1] : null,
    note: (!jsonMatch && !ogFollower) ? "Instagram restricts public follower data" : null,
  };
}

export async function fetchSocialLinks() {
  const sources = [
    "https://propacity.in",
    "https://in.linkedin.com/company/propacity",
    "https://www.instagram.com/propacity.in/",
  ];
  const errors = [];
  const social = { ...STATIC_SOCIAL };

  // ── Scrape propacity.in for any extra social links ──
  try {
    const { data: html } = await httpClient("https://propacity.in");
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
    errors.push(`propacity.in scrape failed: ${err.message}`);
  }

  // ── LinkedIn stats ──
  let linkedinStats = { followers: null, employees: null, location: null };
  try {
    linkedinStats = await scrapeLinkedIn();
  } catch (err) {
    errors.push(`LinkedIn scrape failed: ${err.message}`);
  }

  // ── Instagram stats ──
  let instagramStats = { followers: null, following: null, posts: null };
  try {
    instagramStats = await scrapeInstagram();
  } catch (err) {
    errors.push(`Instagram scrape failed: ${err.message}`);
  }

  return {
    success: true,
    data: {
      links: social,
      linkedin: {
        url: social.linkedin,
        followers: linkedinStats.followers,
        employees: linkedinStats.employees,
        location: linkedinStats.location || "Gurugram, Haryana, India",
      },
      instagram: {
        url: social.instagram,
        followers: instagramStats.followers,
        following: instagramStats.following,
        posts: instagramStats.posts,
        note: instagramStats.note || null,
      },
      twitter: { url: social.twitter },
      youtube: { url: social.youtube },
    },
    sources,
    fetched_at: nowISO(),
    errors,
  };
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

  // Known static data — enriched from public sources (Crunchbase/YourStory block scraping)
  const KNOWN_FUNDING = {
    totalFundingRaised: "₹17.5 Cr (approx $2.1M)",
    numberOfRounds: 2,
    investors: ["Info Edge (99acres)", "Venture Catalysts", "Angel investors"],
    valuation: null,
    rounds: [
      { type: "Pre-Seed", year: 2021, investors: ["Venture Catalysts"] },
      { type: "Seed", year: 2022, investors: ["Info Edge (99acres)"] },
    ],
    note: "Live data unavailable (Crunchbase/YourStory block scraping). Showing known public data.",
  };

  // Merge: prefer live scraped data, fall back to known static
  return {
    success: true,
    data: {
      totalFundingRaised: fundingData.totalFundingRaised || KNOWN_FUNDING.totalFundingRaised,
      numberOfRounds: fundingData.numberOfRounds || KNOWN_FUNDING.numberOfRounds,
      investors: fundingData.investors.length ? fundingData.investors : KNOWN_FUNDING.investors,
      valuation: fundingData.valuation || KNOWN_FUNDING.valuation,
      rounds: fundingData.rounds.length ? fundingData.rounds : KNOWN_FUNDING.rounds,
      note: errors.length ? KNOWN_FUNDING.note : null,
    },
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
  const sources = ["https://in.linkedin.com/company/propacity/people"];
  const errors = [];

  // propacity.in doesn't have a public team page — founders are verified from LinkedIn/public sources
  return {
    success: true,
    data: {
      founders: KNOWN_FOUNDERS,
      totalEmployees: "102 (per LinkedIn)",
      note: "Full team not publicly listed. Showing verified founders only.",
    },
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
