import { escapeXml, validDate } from "./escape.js";
import { env } from "../env.js";
import type { Collection, Post } from "../schemas/content.js";
import type { SiteSettings } from "../schemas/site-settings.js";

/**
 * Server-side SEO: sitemap, feed, and per-URL metadata.
 *
 * The site is a single-page app, and crawlers do not run JavaScript. Without
 * this, every URL on the domain reports the index shell's title and image — so
 * a shared post looks identical to the home page, and Google indexes a hundred
 * duplicates of one document. The fix is to serve the shell with its head
 * rewritten per URL, which is what `renderShellWithMeta` does.
 */

const SITE_AUTHOR = "Yehuda Briskman";
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** Search engines and social crawlers both need absolute URLs, never paths. */
export const SITE_URL = env.SITE_URL;

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/*
 * The site's two languages (#248). English is the bare address and Hebrew the
 * same address under `/he` (web/src/i18n/routing.ts), so a page's two
 * versions are each other's `hreflang` alternates.
 */
export type Lang = "en" | "he";
export const LANGS: readonly Lang[] = ["en", "he"];

/** An unprefixed path in a language: (`/blog`, `he`) → `/he/blog`, (`/`, `he`) → `/he`. */
export function pathIn(pathname: string, lang: Lang): string {
  if (lang === "en") return pathname;
  return pathname === "/" ? "/he" : `/he${pathname}`;
}

function escapeAttr(s: string): string {
  return escapeXml(s.replace(/\s+/g, " ").trim());
}

/**
 * Google truncates descriptions around 155-160 characters. Cutting on a word
 * boundary keeps the snippet readable instead of ending mid-word.
 */
export function clampDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Reduce Markdown to the handful of tags a crawler cares about: headings,
 * paragraphs and list items. This is not a Markdown renderer and does not try
 * to be — the browser gets the real thing from react-markdown. Everything is
 * escaped first, so nothing from the database can inject markup here.
 */
export function markdownToFallbackHtml(markdown: string, maxBlocks = 40): string {
  const stripInline = (line: string): string =>
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      .trim();

  const blocks: string[] = [];
  let paragraph: string[] = [];
  let inFence = false;

  const flush = (): void => {
    if (!paragraph.length) return;
    const text = escapeXml(stripInline(paragraph.join(" ")));
    if (text) blocks.push(`<p>${text}</p>`);
    paragraph = [];
  };

  for (const raw of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length, 4);
      const text = escapeXml(stripInline(heading[2]));
      if (text) blocks.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const item = /^[-*+]\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const text = escapeXml(stripInline(item[1]));
      if (text) blocks.push(`<li>${text}</li>`);
      continue;
    }

    // A lone "# Title" repeats the H1 the page already has.
    if (/^#\s+/.test(line)) continue;

    paragraph.push(line);
    if (blocks.length >= maxBlocks) break;
  }
  flush();

  return blocks.slice(0, maxBlocks).join("\n");
}

export type PageMeta = {
  title: string;
  description: string;
  /** Absolute canonical URL. */
  canonical: string;
  /**
   * What og:description and twitter:description say, when it should not be the
   * search snippet. A share card already shows the title and the image, so the
   * shell's own copy (web/index.html) words it differently from the
   * `description` a search result shows under the title. Defaulting to
   * `description` keeps every other page exactly as it was.
   */
  socialDescription?: string;
  /** Absolute image URL, 1200x630. */
  image: string;
  imageAlt: string;
  type: "website" | "article";
  publishedAt?: string | null;
  modifiedAt?: string | null;
  tags?: string[];
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  /**
   * Content placed inside #root for clients that do not run JavaScript, so a
   * crawler reading the raw HTML finds a real H1 and real prose instead of an
   * empty div. React's createRoot clears the container on its first render,
   * but a browser paints the HTML before the bundle runs — so this is wrapped
   * and covered for script-running visitors; see FALLBACK_STYLE.
   */
  bodyHtml?: string;
  /**
   * The site's visual settings (#254), written into the shell's three
   * `site-*` metas so the theme default, the motion default and the accent
   * are in the page before its first paint. Omitted, the shell keeps the
   * values it was built with, which are the defaults.
   */
  visuals?: SiteSettings["visuals"];
  /**
   * The lazy page this URL renders (`Project`, `BlogPost`, …), so its chunk can
   * be preloaded from the head instead of being discovered after React mounts.
   * See routePreloadLinks.
   */
  route?: string;
  /**
   * The page's feeds, as `<link rel="alternate">` (#226). A feed reader finds
   * a feed in the raw HTML and never runs the app, so the page's own
   * client-side link is not enough on its own. Paths, made absolute here.
   */
  feeds?: { title: string; href: string }[];
  /** The page's language (#248). English when absent. */
  lang?: Lang;
  /**
   * The page's unprefixed path, when it exists in both languages: the head
   * then carries `hreflang` alternates for each, and `x-default` → English.
   */
  path?: string;
  /**
   * An image the page is known to paint as its largest element, preloaded
   * from the head with its own srcset and sizes so the browser starts it
   * with the HTML rather than after React has mounted (#308).
   */
  preloadImage?: { href: string; srcset: string; sizes: string };
  /**
   * False for a note, project or area with no published Hebrew (#304): see
   * metaLines. Hub pages leave it unset; they are always both languages.
   */
  translated?: boolean;
};

/* ------------------------------------------------------------------ sitemap */

export type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  /** False when the page has no published Hebrew (#304): English only, no alternates. */
  hebrew?: boolean;
};

/**
 * The pages that always exist, independent of what is in the database: every
 * public route in web/src/App.tsx that is not a single post, project or area.
 * Until #308 this left out the story, the accessibility statement and the
 * channel log, and named two projects by hand; the projects now come from
 * the content store, as the pages themselves do.
 */
const STATIC_ENTRIES: SitemapEntry[] = [
  { loc: "/", changefreq: "monthly", priority: 1.0 },
  { loc: "/blog", changefreq: "weekly", priority: 0.8 },
  { loc: "/projects", changefreq: "weekly", priority: 0.8 },
  { loc: "/story", changefreq: "monthly", priority: 0.7 },
  { loc: "/blog/log", changefreq: "daily", priority: 0.4 },
  // The remote MCP server's page (#263): the one place to learn how to connect.
  { loc: "/developers/mcp", changefreq: "monthly", priority: 0.5 },
  { loc: "/accessibility", changefreq: "yearly", priority: 0.3 },
];

/** What the sitemap lists beyond the posts and the published collections. */
export type SitemapExtras = {
  /** The content store's projects, which render with or without a collection row. */
  projects?: { slug: string; hebrew: boolean }[];
  /** Whether a post, an area or a collection's project page has published Hebrew (#304). */
  postHebrew?: (p: Post) => boolean;
  areaHebrew?: (c: Collection) => boolean;
};

/**
 * @param collections every published collection: each is an area page
 *   (`/blog/area/<slug>`), and a project one is a project page as well.
 */
export function buildSitemap(posts: Post[], collections: Collection[], extras: SitemapExtras = {}): string {
  return buildSitemapEntries(sitemapEntries(posts, collections, extras));
}

function sitemapEntries(posts: Post[], collections: Collection[], extras: SitemapExtras): SitemapEntry[] {
  /*
   * The static routes carry the most recent content date rather than nothing.
   * A <url> with no <lastmod> gives a crawler no reason to come back, and these
   * are the pages whose contents change whenever a post or project does.
   */
  const newest = [...posts, ...collections]
    .map((d) => d.updatedAt)
    .filter(Boolean)
    .sort()
    .pop();
  const entries: SitemapEntry[] = STATIC_ENTRIES.map((e) => ({ ...e, lastmod: e.lastmod ?? newest }));
  const add = (e: SitemapEntry) => {
    // A real collection replaces its store entry rather than duplicating it.
    const at = entries.findIndex((x) => x.loc === e.loc);
    if (at === -1) entries.push(e);
    else entries[at] = { ...entries[at], ...(e.lastmod ? { lastmod: e.lastmod } : {}), ...(e.hebrew === undefined ? {} : { hebrew: e.hebrew }) };
  };

  const areaHebrew = extras.areaHebrew ?? (() => true);
  const postHebrew = extras.postHebrew ?? (() => true);
  const storeHebrew = new Map((extras.projects ?? []).map((p) => [p.slug, p.hebrew]));
  for (const p of extras.projects ?? []) {
    add({ loc: `/projects/${p.slug}`, lastmod: newest, changefreq: "monthly", priority: 0.7, hebrew: p.hebrew });
  }

  for (const c of collections) {
    if (c.kind === "project") {
      /* The project page reads the store's entry when there is one, so its
         Hebrew is the entry's; otherwise the collection's own. */
      const hebrew = storeHebrew.get(c.slug) ?? areaHebrew(c);
      add({ loc: `/projects/${c.slug}`, lastmod: c.updatedAt, changefreq: "weekly", priority: 0.7, hebrew });
    }
    add({ loc: `/blog/area/${c.slug}`, lastmod: c.updatedAt, changefreq: "weekly", priority: 0.5, hebrew: areaHebrew(c) });
  }

  for (const p of posts) {
    // A post marked noindex must not be advertised in the sitemap either —
    // otherwise the two signals contradict each other and Google trusts neither.
    if (p.seo.noindex) continue;
    add({
      loc: `/blog/${p.slug}`,
      lastmod: p.updatedAt ?? p.publishedAt,
      changefreq: "monthly",
      priority: 0.6,
      hebrew: postHebrew(p),
    });
  }

  return entries;
}

/*
 * Every page twice, once per language, each listing both as alternates
 * (#248): the sitemap form of `hreflang`, which Google reads in place of, or
 * as well as, the tags in each page's head.
 */
function buildSitemapEntries(entries: SitemapEntry[]): string {
  const alternates = (loc: string) =>
    [
      ...LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(absoluteUrl(pathIn(loc, l)))}" />`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(loc))}" />`,
    ];
  const urls = entries
    .flatMap((e) => (e.hebrew === false ? [{ ...e, lang: "en" as Lang }] : LANGS.map((lang) => ({ ...e, lang }))))
    .map((e) => {
      const parts = [`    <loc>${escapeXml(absoluteUrl(pathIn(e.loc, e.lang)))}</loc>`, ...(e.hebrew === false ? [] : alternates(e.loc))];
      const lastmod = validDate(e.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

/* --------------------------------------------------------------------- feed */

/** What a feed says about itself. The defaults are the site-wide /feed.xml. */
export type FeedChannel = { title: string; link: string; description: string; self: string };

const SITE_CHANNEL: FeedChannel = {
  title: "Yehuda Briskman · Notes",
  link: "/blog",
  description: "Writing on frontend engineering, infrastructure, and shipping products end to end.",
  self: "/feed.xml",
};

/** One area's channel: its notes only, linking to the area's history page. */
export function areaChannel(c: Pick<Collection, "slug" | "title" | "tagline" | "description">): FeedChannel {
  return {
    title: `Yehuda Briskman · ${c.title}`,
    link: `/blog/area/${c.slug}`,
    description: c.tagline || c.description || `Notes on ${c.title}.`,
    self: `/api/seo/feed/${c.slug}.xml`,
  };
}

export function buildFeed(posts: Post[], channel: FeedChannel = SITE_CHANNEL): string {
  const published = posts
    .filter((p) => !p.seo.noindex)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 30);

  const items = published
    .map((p) => {
      const url = absoluteUrl(`/blog/${p.slug}`);
      const date = (validDate(p.publishedAt) ?? validDate(p.createdAt) ?? new Date(0)).toUTCString();
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(date)}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
${p.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  const updated = validDate(published[0]?.publishedAt) ?? new Date();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(absoluteUrl(channel.link))}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl(channel.self))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

/* ---------------------------------------------------------- the channel log */

/** What the log feed needs from an activity event (`services/activity.ts`). */
export type FeedEvent = {
  id: string;
  kind: string;
  at: string;
  area: { slug: string; title: string } | null;
  title: string;
  href: string;
  meta: Record<string, unknown>;
};

/** The words a feed reader shows before an event's title, per kind. */
const LOG_KIND: Record<string, string> = {
  post: "New note",
  release: "Release",
  push: "Pushed",
  site: "Site release",
  area: "New area",
};

/** The channel log's channel (#226): every kind of event, linking to /blog/log. */
export const LOG_CHANNEL: FeedChannel = {
  title: "Yehuda Briskman · Channel log",
  link: "/blog/log",
  description: "Everything that happens on the site: notes, releases, pushes, site releases and new areas.",
  self: "/api/seo/feed/log.xml",
};

/**
 * The channel log as RSS 2.0, in the same shape as `buildFeed` (#226).
 *
 * An event's `href` is a site path for notes and areas and a GitHub URL for
 * repo events; the first is made absolute and the second passed through. The
 * guid is the event's own id, not its link: a push and a release can link to
 * the same repository, and a reader must not fold them into one item.
 */
export function buildActivityFeed(events: FeedEvent[], channel: FeedChannel = LOG_CHANNEL): string {
  const latest = events.slice(0, 50);
  const items = latest
    .map((e) => {
      const url = /^https?:\/\//.test(e.href) ? e.href : absoluteUrl(e.href);
      const kind = LOG_KIND[e.kind] ?? e.kind;
      const excerpt = typeof e.meta.excerpt === "string" ? e.meta.excerpt : "";
      const description = excerpt || (e.area ? `${kind} in ${e.area.title}.` : `${kind}.`);
      const categories = [kind, ...(e.area ? [e.area.title] : [])];
      return `    <item>
      <title>${escapeXml(`${kind}: ${e.title}`)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">${escapeXml(e.id)}</guid>
      <pubDate>${(validDate(e.at) ?? new Date(0)).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
${categories.map((c) => `      <category>${escapeXml(c)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  const updated = validDate(latest[0]?.at) ?? new Date();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(absoluteUrl(channel.link))}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl(channel.self))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

/* ------------------------------------------------------------------- robots */

/** Whether a host asks to be crawled. */
export type RobotsStance = "open" | "closed";
/** What ROBOTS_POLICY may say: a stance, or "work it out from SITE_URL". */
export type RobotsPolicy = "auto" | RobotsStance;

/**
 * The hosts that may ask to be indexed. Everything else is a copy: preprod
 * serves URLs byte-identical to production's apart from the hostname, which is
 * the worst kind of duplicate to hand a crawler.
 *
 * Both spellings of the canonical name, because a redirect from www to the
 * apex does not stop a crawler reading www's robots.txt first.
 */
const CANONICAL_HOST = "yehudabriskman.com";
const INDEXABLE_HOSTS: ReadonlySet<string> = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

/**
 * Closed is the right answer for every host but one, and getting it wrong on
 * the one deindexes the site — so each step here fails towards open:
 *
 *   - SITE_URL's own default in env.ts is the production canonical, so a deploy
 *     that sets nothing at all is open rather than closed.
 *   - Only the hostname is compared, lowercased, so a trailing slash, an
 *     explicit :443, a path or a capital letter cannot flip production shut.
 *   - A SITE_URL that will not parse returns open. It is a misconfigured host
 *     either way, and production is the only host where robots.txt is read by
 *     a crawler at all — preprod has two further layers outside this app.
 */
export function robotsStance(siteUrl: string, policy: RobotsPolicy): RobotsStance {
  if (policy !== "auto") return policy;
  let hostname: string;
  try {
    hostname = new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return "open";
  }
  return INDEXABLE_HOSTS.has(hostname) ? "open" : "closed";
}

/** The blog's filter parameters: views of /blog, which canonicalise to it. */
export const FACET_PARAMS = ["tag", "year", "collection", "view", "open"] as const;
// Two rules per name, first-in-query and later-in-query, because a bare `*?*tag=`
// would also match `?mytag=`. `*` matches any run of characters (RFC 9309).
const FACET_DISALLOWS = FACET_PARAMS.flatMap((k) => [`Disallow: /*?${k}=`, `Disallow: /*&${k}=`]).join("\n");

/**
 * nginx serves /robots.txt from here on every host, so this is what tells the
 * hosts apart. It used to say `Allow: /` on all of them and differ only in the
 * Sitemap line, which left preprod inviting crawlers in; that was safe solely
 * because of a Traefik ipAllowList and an X-Robots-Tag middleware this app
 * cannot see, and defence that exists only outside the app is one relaxed
 * annotation away from not existing.
 *
 * No Sitemap line on a closed host, deliberately: a sitemap is a list of URLs
 * to go and fetch, which contradicts the Disallow directly above it.
 */
export function buildRobots(stance: RobotsStance = robotsStance(SITE_URL, env.ROBOTS_POLICY)): string {
  if (stance === "closed") {
    return `# Not the canonical host for this site. Its pages are a copy of
# ${CANONICAL_HOST}'s and must not be indexed in their own right.
User-agent: *
Disallow: /
`;
  }

  return `User-agent: *
Allow: /

# The admin surface sits on its own host behind GitHub SSO. Listing it here
# would only advertise it; it is disallowed for the crawlers that do look.
Disallow: /admin

# The remote MCP endpoint and its OAuth pages are an authenticated API for
# agents, not documents: a crawler that reaches /mcp gets a 401 (earlier, a 404)
# and reports it as an indexing problem. /developers/mcp is the page about it
# and stays crawlable; it does not start with this prefix.
Disallow: /mcp

# Blog filters (tag, year, collection, view, open) are views of /blog, which
# every one of them canonicalises to. \`*\` matches any run of characters, so
# the rule catches the parameter anywhere in the query string and under /he/.
# Only these names: ?lang and utm_* tracking on shared links stay crawlable.
${FACET_DISALLOWS}

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}

/* ------------------------------------------------------- head meta injection */

const MANAGED_TAG_PATTERNS: RegExp[] = [
  /<title>[\s\S]*?<\/title>/i,
  /<meta\s+name=["']description["'][^>]*>/gi,
  /<link\s+rel=["']canonical["'][^>]*>/gi,
  /<meta\s+property=["']og:[^"']*["'][^>]*>/gi,
  /<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi,
  /<meta\s+name=["']robots["'][^>]*>/gi,
  /<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi,
  /<link\s+rel=["']alternate["']\s+hreflang=[^>]*>/gi,
];

/*
 * og:image:type, read off the image URL rather than declared per page.
 *
 * The shell declares `og:image:type`, and MANAGED_TAG_PATTERNS strips every og:
 * tag before the block below is written — so until #125 the rendered pages were
 * the only ones on the site without it. Every card this API points at is a PNG
 * (/og.png, /og-blog.png and the cards rendered under /api/seo/og/), but the
 * type follows the extension so that a JPEG card one day cannot be announced as
 * a PNG. An extension this does not know omits the tag, which is what a scraper
 * copes with best: no type is a guess, a wrong type is a broken preview.
 */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function imageTypeFor(url: string): string | null {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // A relative path: take it as it is.
  }
  const ext = /\.([a-z0-9]+)$/i.exec(pathname)?.[1]?.toLowerCase();
  return (ext && IMAGE_TYPES[ext]) || null;
}

/**
 * The managed head tags for a page, one per entry, as the server render
 * writes them: what the app swaps in after a client-side navigation
 * (web/src/components/HeadSync.tsx), so both ways of arriving get one head.
 */
export function metaLines(meta: PageMeta): string[] {
  /* An item with no published Hebrew: its Hebrew page is the English under
     Hebrew chrome, so it is noindex, names no alternates and says en_US; its
     English page names no Hebrew alternate. */
  const path = meta.translated === false ? undefined : meta.path;
  const isEnglishFallback = meta.lang === "he" && meta.translated === false;
  const lines: string[] = [
    `<title>${escapeXml(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(clampDescription(meta.description))}" />`,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`,
    ...hreflangLines(path),
    meta.noindex || isEnglishFallback
      ? `<meta name="robots" content="noindex, follow" />`
      : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    ...openGraphLines(meta, path !== undefined, isEnglishFallback),
    ...twitterLines(meta),
    ...articleLines(meta),
  ];

  for (const f of meta.feeds ?? []) {
    lines.push(
      `<link rel="alternate" type="application/rss+xml" title="${escapeAttr(f.title)}" href="${escapeAttr(absoluteUrl(f.href))}" />`,
    );
  }

  if (meta.jsonLd) {
    // "</script>" inside a JSON string would close the tag early.
    const json = JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c");
    lines.push(`<script type="application/ld+json">${json}</script>`);
  }

  return lines;
}

/** The English and Hebrew twins of a page; none when it has no Hebrew twin. */
function hreflangLines(path: string | undefined): string[] {
  if (path === undefined) return [];
  return [
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${escapeAttr(absoluteUrl(pathIn(path, l)))}" />`),
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(absoluteUrl(path))}" />`,
  ];
}

function openGraphLines(meta: PageMeta, hasHebrewTwin: boolean, isEnglishFallback: boolean): string[] {
  const imageType = imageTypeFor(meta.image);
  return [
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:site_name" content="${SITE_AUTHOR}" />`,
    `<meta property="og:locale" content="${meta.lang === "he" && !isEnglishFallback ? "he_IL" : "en_US"}" />`,
    ...(hasHebrewTwin
      ? [`<meta property="og:locale:alternate" content="${meta.lang === "he" ? "en_US" : "he_IL"}" />`]
      : []),
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(clampDescription(meta.socialDescription ?? meta.description))}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(meta.image)}" />`,
    ...(imageType ? [`<meta property="og:image:type" content="${imageType}" />`] : []),
    `<meta property="og:image:width" content="${OG_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(meta.imageAlt)}" />`,
  ];
}

// X does not read Open Graph by default, so the same facts are repeated
// under its own prefix rather than assumed to carry over.
function twitterLines(meta: PageMeta): string[] {
  return [
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(clampDescription(meta.socialDescription ?? meta.description))}" />`,
    `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(meta.imageAlt)}" />`,
  ];
}

function articleLines(meta: PageMeta): string[] {
  if (meta.type !== "article") return [];
  return [
    ...(meta.publishedAt ? [`<meta property="article:published_time" content="${escapeAttr(meta.publishedAt)}" />`] : []),
    ...(meta.modifiedAt ? [`<meta property="article:modified_time" content="${escapeAttr(meta.modifiedAt)}" />`] : []),
    `<meta property="article:author" content="${SITE_AUTHOR}" />`,
    ...(meta.tags ?? []).map((tag) => `<meta property="article:tag" content="${escapeAttr(tag)}" />`),
  ];
}

function metaBlock(meta: PageMeta): string {
  return metaLines(meta)
    .map((l) => `    ${l}`)
    .join("\n");
}

/*
 * The crawler fallback paints as the entry shutter's first frame (a black sheet
 * over hidden text) so a visitor never sees raw text before the app loads. Hidden
 * by default, shown by <noscript>: the `scripting` media feature is missing before
 * Chrome 120 / Safari 17. Not cloaking: every client gets the same DOM. After
 * FALLBACK_REVEAL_MS the text shows anyway, in case the bundle never runs. Inline
 * <style> only: the CSP allows it, not inline script.
 */
export const FALLBACK_ATTR = "data-seo-fallback";
export const FALLBACK_REVEAL_MS = 8000;
const FALLBACK_STYLE =
  `<style ${FALLBACK_ATTR}>` +
  `[${FALLBACK_ATTR}]{visibility:hidden;animation:seo-fallback-show 0s ${FALLBACK_REVEAL_MS}ms forwards}` +
  `[${FALLBACK_ATTR}]::before{content:"";position:fixed;inset:0;z-index:200;background:#000;visibility:visible;animation:seo-fallback-hide 0s ${FALLBACK_REVEAL_MS}ms forwards}` +
  `@keyframes seo-fallback-show{to{visibility:visible}}` +
  `@keyframes seo-fallback-hide{to{visibility:hidden}}` +
  `@media (prefers-reduced-motion:reduce){[${FALLBACK_ATTR}]::before{display:none}}` +
  `</style>`;
const FALLBACK_NOSCRIPT =
  `<noscript><style>[${FALLBACK_ATTR}]{visibility:visible;animation:none}[${FALLBACK_ATTR}]::before{display:none}</style></noscript>`;

/*
 * The route's own chunk, preloaded from the head.
 *
 * Every page but the home is a lazy route, so on a cold load the browser
 * fetched the entry, ran it, rendered the route, and only then discovered the
 * page's chunk — one round trip after the bundle, behind the entry shutter.
 * The build writes one `<meta name="route-preload">` per lazy page into the
 * shell (web/vite.config.ts, routePreloadPlugin), naming its chunk, the
 * chunks it imports and its CSS. Here the one for this URL becomes real
 * preload links, and every other one is dropped. A shell without the metas
 * (the dev server) simply gets no preloads.
 */
const ROUTE_PRELOAD_META = /<meta\s+name=["']route-preload["'][^>]*>\s*/gi;
const ASSET_PATH = /^\/assets\/[\w.-]+\.(?:js|css)$/;

export function routePreloadLinks(shell: string, route: string): string[] {
  for (const tag of shell.match(ROUTE_PRELOAD_META) ?? []) {
    const name = /data-route=["']([^"']*)["']/i.exec(tag)?.[1];
    if (name !== route) continue;
    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    // Only the build's own hashed asset paths: this is HTML written into the
    // head, and the shell is fetched over the network.
    return content
      .split(/\s+/)
      .filter((p) => ASSET_PATH.test(p))
      .map((p) =>
        p.endsWith(".css")
          ? `<link rel="preload" as="style" crossorigin href="${p}" />`
          : `<link rel="modulepreload" crossorigin href="${p}" />`,
      );
  }
  return [];
}

/**
 * Replace the shell's build-time head tags with the ones for this URL. The rest
 * of the document is untouched, so the app boots exactly as it does normally —
 * this changes what a crawler reads, not what a browser runs.
 */
/*
 * The three visual settings' metas (#254). Each value has already passed the
 * settings schema's enum, and is escaped anyway; a meta the shell does not
 * carry is left out rather than invented, so an older shell keeps working.
 */
const VISUAL_METAS = [
  ["theme", /<meta\s+name=["']site-theme-default["'][^>]*>/i, "site-theme-default"],
  ["motion", /<meta\s+name=["']site-motion-default["'][^>]*>/i, "site-motion-default"],
  ["accent", /<meta\s+name=["']site-accent["'][^>]*>/i, "site-accent"],
] as const;

export function applyVisuals(html: string, visuals: SiteSettings["visuals"]): string {
  let out = html;
  for (const [key, tag, name] of VISUAL_METAS) {
    out = out.replace(tag, () => `<meta name="${name}" content="${escapeAttr(visuals[key])}" />`);
  }
  return out;
}

/**
 * The search consoles' ownership tags (#308), from the environment. In the
 * served head of every rendered page, since a console may check any URL of
 * the property, and left out of the head the app swaps after a navigation:
 * they never change, and a console reads only the HTML it fetched.
 */
export function verificationTags(e: { GOOGLE_SITE_VERIFICATION?: string; BING_SITE_VERIFICATION?: string } = env): string[] {
  return [
    ...(e.GOOGLE_SITE_VERIFICATION ? [`<meta name="google-site-verification" content="${escapeAttr(e.GOOGLE_SITE_VERIFICATION)}" />`] : []),
    ...(e.BING_SITE_VERIFICATION ? [`<meta name="msvalidate.01" content="${escapeAttr(e.BING_SITE_VERIFICATION)}" />`] : []),
  ];
}

export function renderShellWithMeta(shell: string, meta: PageMeta): string {
  const preloads = meta.route ? routePreloadLinks(shell, meta.route) : [];
  let html = shell.replace(ROUTE_PRELOAD_META, "");
  /* The document's language and direction (#248): the shell ships English,
     and a Hebrew page has to say so before any script runs. */
  if (meta.lang === "he") {
    html = html.replace(/<html\b[^>]*>/i, '<html lang="he" dir="rtl">');
  }
  if (meta.visuals) html = applyVisuals(html, meta.visuals);
  for (const pattern of MANAGED_TAG_PATTERNS) html = html.replace(pattern, "");

  // Matches the empty root div the build emits. If the shell ever stops
  // shipping one, the page still renders — it just loses the fallback.
  const root = /<div id=["']root["']\s*>\s*<\/div>/i;
  const fallback = Boolean(meta.bodyHtml) && root.test(html);

  const head = [metaBlock(meta), ...verificationTags().map((t) => `    ${t}`)];
  if (fallback) head.push(`    ${FALLBACK_STYLE}`, `    ${FALLBACK_NOSCRIPT}`);
  for (const link of preloads) head.push(`    ${link}`);
  if (meta.preloadImage) {
    const p = meta.preloadImage;
    head.push(
      `    <link rel="preload" as="image" href="${escapeAttr(p.href)}" imagesrcset="${escapeAttr(p.srcset)}" imagesizes="${escapeAttr(p.sizes)}" fetchpriority="high" />`,
    );
  }
  const block = head.join("\n");

  html = html.includes("</head>")
    ? html.replace("</head>", () => `${block}\n  </head>`)
    : `${block}\n${html}`;

  if (fallback) {
    // A function, so a "$&" or "$1" in the content is text, not a pattern.
    html = html.replace(root, () => `<div id="root"><div ${FALLBACK_ATTR}>${meta.bodyHtml}</div></div>`);
  }

  return html;
}

/* --------------------------------------------------------------- shell cache */

type CachedShell = { html: string; etag: string | null; at: number };
let shellCache: CachedShell | null = null;

/*
 * Ten seconds, and then revalidate rather than refetch.
 *
 * This used to hold the shell for five minutes. Asset filenames are content
 * hashed, so during a rolling deploy the API would cache the outgoing web pod's
 * HTML and then serve <script src> URLs that no longer existed — the app never
 * booted, and every visitor got the crawler fallback on a blank page for up to
 * five minutes after each release. Observed in production, not theorised.
 *
 * A conditional GET makes correctness cheap: nginx returns 304 with no body for
 * an unchanged file, which in-cluster costs well under a millisecond, so the
 * window where the two can disagree is now seconds rather than minutes.
 */
const SHELL_TTL_MS = 10_000;

export async function fetchShell(): Promise<string> {
  const now = Date.now();
  if (shellCache && now - shellCache.at < SHELL_TTL_MS) return shellCache.html;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const headers: Record<string, string> = {};
    if (shellCache?.etag) headers["If-None-Match"] = shellCache.etag;

    const res = await fetch(`${env.WEB_ORIGIN}/index.html`, { signal: controller.signal, headers });

    // Unchanged: keep the body we already have, just mark it as fresh.
    if (res.status === 304 && shellCache) {
      shellCache.at = now;
      return shellCache.html;
    }
    if (!res.ok) throw new Error(`shell fetch failed: ${res.status}`);

    const html = await res.text();
    shellCache = { html, etag: res.headers.get("etag"), at: now };
    return html;
  } finally {
    clearTimeout(timer);
  }
}

/** Drops the cached shell. Exported for tests. */
export function resetShellCache(): void {
  shellCache = null;
}
