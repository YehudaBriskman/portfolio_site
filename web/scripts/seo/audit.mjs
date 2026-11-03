#!/usr/bin/env node
/*
 * The SEO audit's crawler (#308): the site as a search engine's first pass
 * reads it, which is the raw HTML with no JavaScript run.
 *
 *   node scripts/seo/audit.mjs --base http://127.0.0.1:8080 \
 *     --vocab vocab.json [--site https://yehudabriskman.com] [--out audit.json]
 *
 * `--base` is where requests go; `--site` is the canonical origin the pages
 * name in their canonicals, hreflang and sitemap, which is mapped back onto
 * `--base` so a local stack built with the production SITE_URL can be crawled
 * as if it were production. `--vocab` is the output of vocab.mjs, against
 * which every JSON-LD node's @type and properties are checked.
 *
 * It starts at robots.txt, the sitemap, `/` and `/he`, and follows every
 * internal link in the HTML (head alternates included) breadth first, so it
 * reports each page's click depth and every page the sitemap lists but no
 * link reaches (an orphan to a crawler). Per page: status, <html lang>, the
 * count and text of title, description, canonical and robots, hreflang,
 * og:/twitter: completeness, JSON-LD validity, the heading outline and image
 * alt text in the server-rendered body. It prints JSON; report.mjs or a
 * person turns that into prose.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = (args.base ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const SITE = (args.site ?? "https://yehudabriskman.com").replace(/\/+$/, "");
const vocab = args.vocab ? JSON.parse(readFileSync(args.vocab, "utf8")) : null;
const MAX = Number(args.max ?? 400);

const toBase = (u) => (u.startsWith(SITE) ? BASE + u.slice(SITE.length) : u);
const toPath = (u) => {
  const url = new URL(u, SITE);
  return url.origin === new URL(SITE).origin || url.origin === new URL(BASE).origin ? url.pathname : null;
};
const HEBREW = /[֐-׿]/g;
const hebrewShare = (s) => {
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  return letters ? (s.match(HEBREW) ?? []).length / letters : 0;
};

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "seo-audit/1 (+Googlebot-like, no JS)" } });
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") ?? "", xrobots: res.headers.get("x-robots-tag"), body: await res.text() };
}

/* ------------------------------------------------------------ JSON-LD check */

function isA(type, want) {
  if (!vocab?.types[type]) return false;
  if (type === want) return true;
  return vocab.types[type].some((p) => isA(p, want));
}

function checkNode(node, where, problems, seen) {
  if (Array.isArray(node)) return node.forEach((n, i) => checkNode(n, `${where}[${i}]`, problems, seen));
  if (!node || typeof node !== "object") return;
  if (node["@graph"]) return checkNode(node["@graph"], `${where}.@graph`, problems, seen);
  const types = [].concat(node["@type"] ?? []);
  if (types.length) {
    for (const t of types) {
      seen.push(t);
      if (vocab && !vocab.types[t]) problems.push(`${where}: unknown @type ${t}`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("@")) continue;
      if (vocab) {
        const domains = vocab.props[k];
        if (!domains) problems.push(`${where}: unknown property ${k}`);
        else if (!types.some((t) => domains.some((d) => isA(t, d)))) problems.push(`${where}: ${k} is not a property of ${types.join("/")}`);
      }
      if (v === null || v === "") problems.push(`${where}: ${k} is empty`);
      checkNode(v, `${where}.${k}`, problems, seen);
    }
  }
}

/* ---------------------------------------------------------------- one page */

function inspect(path, res) {
  const dom = new JSDOM(res.body);
  const d = dom.window.document;
  const all = (sel) => [...d.querySelectorAll(sel)];
  const meta = (attr, name) => all(`meta[${attr}="${name}"]`).map((m) => m.getAttribute("content") ?? "");
  const titles = all("head title").map((t) => t.textContent ?? "");
  const descriptions = meta("name", "description");
  const canonicals = all('link[rel="canonical"]').map((l) => l.getAttribute("href"));
  const robots = meta("name", "robots");
  const hreflang = Object.fromEntries(all("link[rel=alternate][hreflang]").map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]));
  const og = Object.fromEntries(all('meta[property^="og:"]').map((m) => [m.getAttribute("property"), m.getAttribute("content")]));
  const tw = Object.fromEntries(all('meta[name^="twitter:"]').map((m) => [m.getAttribute("name"), m.getAttribute("content")]));
  const feeds = all('link[rel=alternate][type="application/rss+xml"], link[rel=alternate][type="application/atom+xml"]').map((l) => l.getAttribute("href"));
  const verification = all('meta[name="google-site-verification"], meta[name="msvalidate.01"]').map((m) => m.getAttribute("name"));

  const ld = [];
  const ldProblems = [];
  const ldTypes = [];
  for (const [i, s] of all('script[type="application/ld+json"]').entries()) {
    try {
      const json = JSON.parse(s.textContent ?? "");
      ld.push(json);
      if (!json["@context"]) ldProblems.push(`ld[${i}]: no @context`);
      checkNode(json, `ld[${i}]`, ldProblems, ldTypes);
    } catch (e) {
      ldProblems.push(`ld[${i}]: not JSON (${e.message})`);
    }
  }

  const root = d.querySelector("#root");
  const headings = root ? [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])) : [];
  const skips = headings.filter((lvl, i) => i > 0 && lvl > headings[i - 1] + 1).length;
  const images = root ? [...root.querySelectorAll("img")] : [];
  const links = [
    ...(root ? [...root.querySelectorAll("a[href]")] : []).map((a) => a.getAttribute("href")),
  ];
  const words = (root?.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;
  const lang = d.documentElement.getAttribute("lang");

  return {
    path,
    status: res.status,
    lang,
    dir: d.documentElement.getAttribute("dir"),
    titles,
    descriptions,
    canonicals,
    robots,
    xrobots: res.xrobots,
    hreflang,
    og,
    twitter: tw,
    feeds,
    verification,
    ldTypes,
    ldProblems,
    ld,
    h1: headings.filter((h) => h === 1).length,
    headingSkips: skips,
    images: images.length,
    imagesNoAlt: images.filter((i) => !i.hasAttribute("alt")).length,
    words,
    titleLangMismatch: lang === "he" ? titles.some((t) => hebrewShare(t) < 0.3) : titles.some((t) => hebrewShare(t) > 0.3),
    descriptionLangMismatch: lang === "he" ? descriptions.some((t) => hebrewShare(t) < 0.3) : descriptions.some((t) => hebrewShare(t) > 0.3),
    links,
  };
}

/* ------------------------------------------------------------------- crawl */

const robots = await get("/robots.txt");
const sitemapRes = await get("/sitemap.xml");
const sitemapUrls = [...sitemapRes.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const sitemapIndex = /<sitemapindex/.test(sitemapRes.body);
let sitemapPaths = [];
const sitemapLastmod = (sitemapRes.body.match(/<lastmod>/g) ?? []).length;
const sitemapAlternates = (sitemapRes.body.match(/<xhtml:link/g) ?? []).length;
if (sitemapIndex) {
  for (const child of sitemapUrls) {
    const body = (await get(toPath(child))).body;
    sitemapPaths.push(...[...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toPath(m[1].replace(/&amp;/g, "&"))));
  }
} else sitemapPaths = sitemapUrls.map(toPath);

const depth = new Map([["/", 0], ["/he", 0]]);
const queue = ["/", "/he"];
const pages = new Map();
const inbound = new Map();
const isPage = (p) => p && !/\.(xml|png|jpe?g|svg|webp|ico|json|txt|js|css)$/.test(p) && !p.startsWith("/api/") && !p.startsWith("/admin") && !p.startsWith("/mcp");

while (queue.length && pages.size < MAX) {
  const path = queue.shift();
  const res = await get(path);
  const page = inspect(path, res);
  page.depth = depth.get(path);
  page.location = res.location;
  pages.set(path, page);
  const outs = [...page.links, ...Object.values(page.hreflang), ...(res.location ? [res.location] : [])];
  for (const href of outs) {
    if (!href) continue;
    const p = toPath(href);
    if (!isPage(p)) continue;
    if (p !== path) inbound.set(p, (inbound.get(p) ?? 0) + 1);
    if (!depth.has(p)) {
      depth.set(p, page.depth + 1);
      queue.push(p);
    }
  }
}

/*
 * Every sitemap URL is fetched too, reached by a link or not, and so is
 * every route the app's own router serves (web/src/App.tsx): a page only the
 * JavaScript navigation links to is invisible to a raw-HTML crawl, and this
 * is how the audit finds it.
 */
const APP_ROUTES = ["/", "/blog", "/blog/log", "/projects", "/story", "/accessibility", "/developers/mcp"];
for (const slug of (args.areas ?? "").split(",").filter(Boolean)) APP_ROUTES.push(`/blog/area/${slug}`);
const appPaths = APP_ROUTES.flatMap((r) => [r, r === "/" ? "/he" : `/he${r}`]);
for (const p of [...sitemapPaths, ...appPaths]) {
  if (pages.has(p)) continue;
  const res = await get(p);
  const page = inspect(p, res);
  page.depth = null;
  pages.set(p, page);
}

/* A missing page: does the site answer 404, or a soft 404? */
const probes = {};
for (const p of ["/blog/no-such-note-xyz", "/he/blog/no-such-note-xyz", "/projects/no-such-project", "/no-such-page", "/he/no-such-page"]) {
  const r = await get(p);
  probes[p] = { status: r.status, robots: inspect(p, r).robots };
}

/* ----------------------------------------------------------------- summary */

const list = [...pages.values()];
const indexable = list.filter((p) => p.status === 200 && !p.robots.some((r) => /noindex/.test(r)));
const dupes = (key) => {
  const by = new Map();
  for (const p of indexable) for (const v of p[key]) by.set(v, [...(by.get(v) ?? []), p.path]);
  return [...by.entries()].filter(([, ps]) => ps.length > 1).map(([v, ps]) => ({ value: v, paths: ps }));
};
const OG_KEYS = ["og:type", "og:title", "og:description", "og:url", "og:image", "og:image:alt", "og:locale", "og:site_name"];
const TW_KEYS = ["twitter:card", "twitter:title", "twitter:description", "twitter:image"];
const sitemapSet = new Set(sitemapPaths);
const summary = {
  base: BASE,
  robots: { status: robots.status, sitemapLine: /^Sitemap:/m.test(robots.body), disallow: [...robots.body.matchAll(/^Disallow:\s*(.*)$/gm)].map((m) => m[1]) },
  sitemap: { status: sitemapRes.status, index: sitemapIndex, urls: sitemapPaths.length, lastmod: sitemapLastmod, alternates: sitemapAlternates },
  pages: list.length,
  byStatus: list.reduce((a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }), {}),
  indexable: indexable.length,
  noindex: list.filter((p) => p.robots.some((r) => /noindex/.test(r))).map((p) => p.path),
  notOneTitle: indexable.filter((p) => p.titles.length !== 1).map((p) => p.path),
  notOneDescription: indexable.filter((p) => p.descriptions.length !== 1).map((p) => p.path),
  notOneCanonical: indexable.filter((p) => p.canonicals.length !== 1).map((p) => p.path),
  canonicalElsewhere: indexable.filter((p) => p.canonicals[0] && toPath(p.canonicals[0]) !== p.path).map((p) => ({ path: p.path, canonical: p.canonicals[0] })),
  titleLong: indexable.filter((p) => (p.titles[0] ?? "").length > 60).map((p) => ({ path: p.path, len: p.titles[0].length })),
  titleShort: indexable.filter((p) => (p.titles[0] ?? "").length < 15).map((p) => p.path),
  descriptionLong: indexable.filter((p) => (p.descriptions[0] ?? "").length > 160).map((p) => p.path),
  descriptionShort: indexable.filter((p) => (p.descriptions[0] ?? "").length < 70).map((p) => ({ path: p.path, len: (p.descriptions[0] ?? "").length })),
  duplicateTitles: dupes("titles"),
  duplicateDescriptions: dupes("descriptions"),
  titleLangMismatch: indexable.filter((p) => p.titleLangMismatch).map((p) => p.path),
  descriptionLangMismatch: indexable.filter((p) => p.descriptionLangMismatch).map((p) => p.path),
  heIndexableEnglish: indexable.filter((p) => p.lang === "he" && p.titleLangMismatch && p.descriptionLangMismatch).map((p) => p.path),
  noHreflang: indexable.filter((p) => Object.keys(p.hreflang).length === 0).map((p) => p.path),
  noJsonLd: indexable.filter((p) => p.ld.length === 0).map((p) => p.path),
  jsonLdProblems: list.filter((p) => p.ldProblems.length).map((p) => ({ path: p.path, problems: p.ldProblems })),
  jsonLdTypes: [...new Set(list.flatMap((p) => p.ldTypes))].sort(),
  ogIncomplete: indexable.filter((p) => OG_KEYS.some((k) => !p.og[k])).map((p) => ({ path: p.path, missing: OG_KEYS.filter((k) => !p.og[k]) })),
  twitterIncomplete: indexable.filter((p) => TW_KEYS.some((k) => !p.twitter[k])).map((p) => p.path),
  ogLocaleVsLang: indexable.filter((p) => (p.lang === "he") !== (p.og["og:locale"] === "he_IL")).map((p) => p.path),
  noH1: indexable.filter((p) => p.h1 === 0).map((p) => p.path),
  manyH1: indexable.filter((p) => p.h1 > 1).map((p) => p.path),
  headingSkips: indexable.filter((p) => p.headingSkips).map((p) => p.path),
  imagesNoAlt: list.reduce((a, p) => a + p.imagesNoAlt, 0),
  thin: indexable.filter((p) => p.words < 50).map((p) => ({ path: p.path, words: p.words })),
  feedsInHead: indexable.filter((p) => p.feeds.length).length,
  verification: [...new Set(list.flatMap((p) => p.verification))],
  maxDepth: Math.max(...list.map((p) => p.depth ?? 0)),
  depthHistogram: list.reduce((a, p) => ({ ...a, [p.depth ?? "unlinked"]: (a[p.depth ?? "unlinked"] ?? 0) + 1 }), {}),
  orphans: sitemapPaths.filter((p) => !inbound.has(p) && p !== "/" && p !== "/he"),
  indexableNotInSitemap: indexable.map((p) => p.path).filter((p) => !sitemapSet.has(p)),
  appRoutesUnlinked: appPaths.filter((p) => pages.get(p)?.depth === null),
  sitemapNot200:sitemapPaths.filter((p) => pages.get(p)?.status !== 200),
  sitemapNoindex: sitemapPaths.filter((p) => pages.get(p)?.robots.some((r) => /noindex/.test(r))),
  probes,
};

const out = { summary, pages: list.map(({ ld, links, ...rest }) => ({ ...rest, ld, links: links.length })) };
if (args.out) writeFileSync(args.out, JSON.stringify(out, null, 2));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
