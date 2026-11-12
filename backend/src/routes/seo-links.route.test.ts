/*
 * What a crawler can follow in the raw server HTML, with no script run: a note
 * links to its trail, area, neighbours and related notes; the home page links
 * to the newest notes and the projects. Needs the app (sharp, MCP SDK), so
 * CI runs it.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";
import { INDEX_HTML } from "../testShell.js";

const T = (n: number) => `2026-0${n}-01T00:00:00.000Z`;
const post = (slug: string, n: number, extra: Record<string, unknown> = {}) => ({
  _id: `post:${slug}`,
  type: "post",
  slug,
  title: `Title ${slug}`,
  subtitle: null,
  excerpt: `Excerpt of ${slug}.`,
  body: "Body.",
  status: "published",
  publishedAt: T(n),
  createdAt: T(n),
  updatedAt: T(n),
  tags: [],
  collection: "windom",
  coverImage: null,
  readingMinutes: 1,
  seo: { title: null, description: null, canonical: null, noindex: false },
  ...extra,
});
const AREA = {
  _id: "collection:windom",
  type: "collection",
  slug: "windom",
  title: "Wind<o>M",
  description: "",
  coverImage: null,
  links: [],
  order: 1,
  status: "published",
  kind: "project",
  tagline: "",
  repo: null,
  stats: null,
  createdAt: T(1),
  updatedAt: T(1),
};
const POSTS = [
  post("one", 1, { tags: ["react", "css"] }),
  post("two", 2, { tags: ["react"], title: "Two <b>bold</b>" }),
  post("three", 3, { tags: ["css"], he: { title: "שלוש", subtitle: null, excerpt: null, body: null } }),
  post("four", 4, { collection: "other" }),
  post("draft", 5, { status: "draft" }),
  post("hidden", 6, { seo: { title: null, description: null, canonical: null, noindex: true } }),
];

beforeEach(() => {
  resetShellCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } })),
  );
  vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
    const s = (query as { selector: { type: string; slug?: string } }).selector;
    if (s.type === "post") return { docs: POSTS.filter((p) => !s.slug || p.slug === s.slug) as never[] };
    if (s.type === "collection") return { docs: [AREA].filter((c) => !s.slug || c.slug === s.slug) as never[] };
    return { docs: [] as never[] };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

const body = (html: string) => html.slice(html.indexOf("</head>"));
const hrefs = (html: string) => [...body(html).matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe("a note's server HTML links", () => {
  it("has the trail, area, neighbours, related notes and the other language", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/two");
    const b = body(res.text);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<link rel="canonical" href="[^"]*\/blog\/two" \/>/);
    for (const h of ["/", "/blog", "/blog/area/windom", "/blog/one", "/blog/three"]) expect(hrefs(res.text)).toContain(h);
    expect(b).toContain('<li aria-current="page">Two &lt;b&gt;bold&lt;/b&gt;</li>');
    // "one" is older, "three" newer: previous and next.
    expect(b).toMatch(/Previous note: <a href="\/blog\/one">/);
    expect(b).toMatch(/Next note: <a href="\/blog\/three">/);
    expect(hrefs(res.text)).not.toContain("/blog/draft");
    expect(hrefs(res.text)).not.toContain("/blog/hidden");
  });

  it("shows tags as text and never links a faceted URL", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/two");
    expect(body(res.text)).toContain("Tagged: react");
    expect(hrefs(res.text).filter((h) => h.includes("?") || h.includes("tag="))).toEqual([]);
  });

  it("escapes every stored value", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/two");
    expect(body(res.text)).toContain("Wind&lt;o&gt;M");
    expect(body(res.text)).not.toContain("<b>bold</b>");
  });

  it("is byte-identical on a second request", async () => {
    const a = await request(createApp()).get("/api/seo/render/blog/two");
    const b = await request(createApp()).get("/api/seo/render/blog/two");
    expect(b.text).toBe(a.text);
  });

  it("links within Hebrew on the Hebrew page, and back to English", async () => {
    const res = await request(createApp()).get("/api/seo/render/he/blog/two");
    const h = hrefs(res.text);
    expect(h).toContain("/he/blog");
    expect(h).toContain("/he/blog/area/windom");
    expect(h).toContain("/he/blog/three");
    expect(h).toContain("/blog/two");
    expect(body(res.text)).toContain("שלוש");
  });

  it("names no Hebrew twin from an English note without published Hebrew", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/two");
    expect(hrefs(res.text)).not.toContain("/he/blog/two");
  });
});

describe("the home page's server HTML links", () => {
  it("has one h1, the owner's name, and links to the newest notes and the projects", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    const b = body(res.text);
    expect(b.match(/<h1>/g)).toHaveLength(1);
    expect(b).toContain("<h1>Yehuda Briskman</h1>");
    expect(hrefs(res.text)).toEqual(expect.arrayContaining(["/blog/four", "/blog/three", "/blog/two", "/blog/one", "/projects"]));
    expect(hrefs(res.text)).not.toContain("/blog/draft");
    expect(hrefs(res.text)).not.toContain("/blog/hidden");
    // Newest first.
    expect(b.indexOf("/blog/four")).toBeLessThan(b.indexOf("/blog/one"));
  });

  it("does the same in Hebrew, with Hebrew links", async () => {
    const res = await request(createApp()).get("/api/seo/render/he");
    expect(body(res.text).match(/<h1>/g)).toHaveLength(1);
    expect(hrefs(res.text)).toEqual(expect.arrayContaining(["/he/blog/three", "/he/projects"]));
  });
});
