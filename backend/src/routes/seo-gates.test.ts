/*
 * The SEO gates (#308): what every change to the site has to keep true.
 *
 * Every public route in web/src/App.tsx is rendered, in both languages, from
 * fixtures that cover each page state (a note and an area with Hebrew and
 * without), and then:
 *
 *  1. every page has exactly one title, one description and one canonical,
 *     and JSON-LD that parses, names schema.org and types every node;
 *  2. a page is noindex only when it is meant to be: a Hebrew page whose item
 *     has no published Hebrew (#304), or a post its author marked noindex;
 *  3. the sitemap lists every indexable page, and nothing that is not one.
 *
 * A new public route in App.tsx with no render, a page that loses its
 * canonical, a JSON-LD node with no type, a noindex that leaks onto a page
 * that should be found, or a sitemap that drifts from the site fails here.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { resetShellCache, SITE_URL } from "../services/seo.js";

const ROOT = path.resolve(__dirname, "../../..");
const INDEX_HTML = fs.readFileSync(path.join(ROOT, "web/index.html"), "utf8");
const APP_TSX = fs.readFileSync(path.join(ROOT, "web/src/App.tsx"), "utf8");

const T = "2026-10-01T00:00:00.000Z";

const post = (slug: string, extra: Record<string, unknown> = {}) => ({
  _id: `post:${slug}`,
  type: "post",
  slug,
  title: `Note ${slug}`,
  subtitle: null,
  excerpt: "An excerpt long enough to stand as a description in a result.",
  body: "Body.",
  status: "published",
  publishedAt: T,
  createdAt: T,
  updatedAt: T,
  tags: [],
  collection: "windom",
  coverImage: null,
  readingMinutes: 1,
  seo: { title: null, description: null, canonical: null, noindex: false },
  he: null,
  ...extra,
});

const NOTES = [
  post("in-hebrew", { he: { title: "רשימה", excerpt: "תקציר ארוך מספיק כדי לשמש תיאור בתוצאת חיפוש.", body: "גוף." } }),
  post("english-only"),
  post("hidden", { seo: { title: null, description: null, canonical: null, noindex: true } }),
];

const collection = (slug: string, extra: Record<string, unknown> = {}) => ({
  _id: `collection:${slug}`,
  type: "collection",
  slug,
  kind: "project",
  title: slug,
  tagline: "A tagline",
  description: "A description of the work.",
  status: "published",
  coverImage: null,
  repo: null,
  stats: null,
  createdAt: T,
  updatedAt: T,
  he: null,
  ...extra,
});

const AREAS = [collection("windom", { he: { title: "WindoM", tagline: "לוח מחוונים" } }), collection("site", { kind: "topic" })];

beforeEach(() => {
  resetShellCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/index.html")) return new Response(INDEX_HTML, { status: 200 });
      throw new Error(`unexpected fetch in test: ${url}`);
    }),
  );
  vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
    const s = (query as { selector: { type: string; slug?: string; collection?: string } }).selector;
    const docs: Record<string, unknown>[] = s.type === "post" ? NOTES : s.type === "collection" ? AREAS : [];
    return {
      docs: docs.filter((d) => (s.slug === undefined || d.slug === s.slug) && (s.collection === undefined || d.collection === s.collection)) as never[],
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

/* ------------------------------------------------------------- the routes */

/** The public routes App.tsx renders a page for: not a redirect, not the admin, not the 404. */
function publicRoutes(): string[] {
  return [...APP_TSX.matchAll(/<Route path="([^"]+)" element=\{([^\n]*)\} \/>/g)]
    .filter(([, p, el]) => !p.startsWith("/admin") && p !== "*" && !/Navigate|Redirect|NotFound/.test(el))
    .map(([, p]) => p);
}

/** Each route made concrete with the fixtures, so every page state is rendered. */
const FILL: Record<string, string[]> = {
  "/projects/:project": ["/projects/windom", "/projects/icaros"],
  "/blog/area/:slug": ["/blog/area/windom", "/blog/area/site"],
  "/blog/:slug": NOTES.map((n) => `/blog/${n.slug}`),
};

/**
 * The pages whose Hebrew twin is meant to be noindex (#304), and the ones
 * always noindex. The seeded projects are not among them: they have Hebrew.
 */
const HEBREW_FALLBACK = new Set(["/blog/area/site", "/blog/english-only"]);
const ALWAYS_NOINDEX = new Set(["/blog/hidden", "/follow", "/subscribe/confirm", "/unsubscribe", "/subscribe/manage"]);

const renderUrl = (p: string, lang: "en" | "he") =>
  lang === "he" ? `/api/seo/render/he${p === "/" ? "" : p}` : `/api/seo/render${p === "/" ? "/home" : p}`;

type Page = { path: string; lang: "en" | "he"; status: number; html: string };

async function renderAll(): Promise<Page[]> {
  const app = createApp();
  const paths = publicRoutes().flatMap((r) => (r.includes(":") ? (FILL[r] ?? [r]) : [r]));
  const out: Page[] = [];
  for (const p of paths) {
    for (const lang of ["en", "he"] as const) {
      const res = await request(app).get(renderUrl(p, lang));
      out.push({ path: p, lang, status: res.status, html: res.text });
    }
  }
  return out;
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const canonicalOf = (html: string) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
const noindex = (html: string) => /<meta name="robots" content="[^"]*noindex/.test(html);

/* The types the site may write. A typo, or a type schema.org does not have,
   is a structured-data error Search Console would report. */
const TYPES = new Set([
  "Person",
  "WebSite",
  "WebPage",
  "ProfilePage",
  "CollectionPage",
  "ItemList",
  "ListItem",
  "BreadcrumbList",
  "BlogPosting",
  "SoftwareSourceCode",
  "CreativeWork",
  "ImageObject",
  "PostalAddress",
  "Place",
]);

function typesIn(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => typesIn(x, out));
  else if (v && typeof v === "object") {
    const t = (v as Record<string, unknown>)["@type"];
    if (typeof t === "string") out.push(t);
    Object.values(v).forEach((x) => typesIn(x, out));
  }
  return out;
}

/* ---------------------------------------------------------------- the gates */

describe("SEO gates (#308)", () => {
  it("knows every public route in App.tsx", () => {
    const routes = publicRoutes();
    expect(routes).toEqual(expect.arrayContaining(["/", "/blog", "/projects", "/story", "/blog/log", "/accessibility", "/privacy", "/developers/mcp"]));
    for (const r of routes) if (r.includes(":")) expect(FILL[r], `no fixture fills ${r}`).toBeDefined();
  });

  it("renders every public page in both languages with one title, description and canonical", async () => {
    for (const page of await renderAll()) {
      const at = `${page.lang} ${page.path}`;
      expect(page.status, at).toBe(200);
      expect(count(page.html, /<title>/g), at).toBe(1);
      expect(count(page.html, /<meta name="description"/g), at).toBe(1);
      expect(count(page.html, /<link rel="canonical"/g), at).toBe(1);
      expect(/<meta name="description" content="([^"]{20,})"/.test(page.html), `${at}: a description worth showing`).toBe(true);
    }
  });

  it("writes JSON-LD that parses, names schema.org and types every node", async () => {
    for (const page of await renderAll()) {
      const at = `${page.lang} ${page.path}`;
      const blocks = [...page.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(blocks.length, `${at}: one JSON-LD block`).toBe(1);
      const doc = JSON.parse(blocks[0][1]) as Record<string, unknown>;
      expect(doc["@context"], at).toBe("https://schema.org");
      const nodes = (doc["@graph"] as Record<string, unknown>[] | undefined) ?? [doc];
      for (const n of nodes) expect(typeof n["@type"], `${at}: a node with no @type`).toBe("string");
      for (const t of typesIn(doc)) expect(TYPES.has(t), `${at}: unknown type ${t}`).toBe(true);
    }
  });

  it("is noindex only where it is meant to be", async () => {
    for (const page of await renderAll()) {
      const meant = ALWAYS_NOINDEX.has(page.path) || (page.lang === "he" && HEBREW_FALLBACK.has(page.path));
      expect(noindex(page.html), `${page.lang} ${page.path}`).toBe(meant);
    }
  });

  it("lists every indexable page in the sitemap, and nothing else", async () => {
    const pages = await renderAll();
    const indexable = new Set(pages.filter((p) => !noindex(p.html)).map((p) => canonicalOf(p.html)!));
    const xml = (await request(createApp()).get("/api/seo/sitemap.xml")).text;
    const listed = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    /* The store's other projects are pages too; the fixtures render two. */
    const rendered = new Set(pages.map((p) => canonicalOf(p.html)!));
    const missing = [...indexable].filter((u) => !listed.has(u));
    const extra = [...listed].filter((u) => rendered.has(u) && !indexable.has(u));
    expect(missing, "indexable but not in the sitemap").toEqual([]);
    expect(extra, "in the sitemap but noindex").toEqual([]);
    for (const u of listed) expect(u.startsWith(SITE_URL), u).toBe(true);
  });
});
