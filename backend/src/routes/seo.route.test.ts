/*
 * The home page has two heads, and they must agree.
 *
 * nginx sends `/` to /api/seo/render/home, which fetches the built shell and
 * rewrites its head; when the API is down nginx serves the shell as built. A
 * scraper therefore reads either one depending on the moment, and every og: and
 * twitter: tag it can see should be the same in both. #125 found two that were
 * not: the render dropped og:image:type (stripped with the other og: tags and
 * never written back) and wrote the search snippet into og:description, where
 * the shell has its own share-card copy.
 *
 * So this renders the real web/index.html — read from the repository, not a
 * fixture that could drift along with the code — and compares tag by tag.
 * og:url is the one tag allowed to differ in principle (the render builds it
 * from SITE_URL), and on the default SITE_URL it does not differ either.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

/** The handful of entities the two heads actually use, decoded so `&middot;` and `·` compare equal. */
function decode(value: string): string {
  return value
    .replace(/&middot;/g, "·")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every og:* and twitter:* tag in a document's <head>, as key → content. */
function socialTags(html: string): Map<string, string> {
  const head = html.slice(0, html.indexOf("</head>"));
  const tags = new Map<string, string>();
  for (const [, key, content] of head.matchAll(
    /<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s+content="([^"]*)"\s*\/?>/g,
  )) {
    tags.set(key, decode(content));
  }
  return tags;
}

describe("GET /api/seo/render/home", () => {
  beforeEach(() => {
    resetShellCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/index.html")) {
          return new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } });
        }
        throw new Error(`unexpected fetch in test: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetShellCache();
  });

  it("writes the same og: and twitter: tags the built shell carries", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.status).toBe(200);

    const shell = socialTags(INDEX_HTML);
    const rendered = socialTags(res.text);

    // The shell is the reference: a tag it declares must be rendered, with the
    // same content. Checked one by one so a failure names the tag.
    expect(shell.size).toBeGreaterThan(10);
    for (const [key, content] of shell) {
      expect({ key, content: rendered.get(key) }).toEqual({ key, content });
    }
  });

  it("re-adds og:image:type, which stripping the shell's og: tags removed", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.text.match(/property="og:image:type"/g)).toHaveLength(1);
    expect(res.text).toContain('<meta property="og:image:type" content="image/png" />');
  });

  it("keeps the search snippet in name=description, distinct from the share copy", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    const snippet = /<meta name="description" content="([^"]*)"/.exec(INDEX_HTML)?.[1];
    expect(snippet).toBeTruthy();
    expect(res.text).toContain(`<meta name="description" content="${snippet}" />`);
  });
});

/*
 * An area's page (#238). nginx sends /blog/area/<slug> here; before that it had
 * no location and every direct load answered 404 with the home page's head.
 *
 * The stub answers posts by `type` alone, ignoring `status`, so a draft handed
 * back by a loosened selector still has to be held back by the route itself;
 * and areas by slug alone, so a hidden one comes back too.
 */
describe("GET /api/seo/render/blog/area/:slug", () => {
  const T = "2026-10-01T00:00:00.000Z";
  const area = (slug: string, extra: Record<string, unknown> = {}) => ({
    _id: `collection:${slug}`,
    type: "collection",
    slug,
    title: `Area ${slug}`,
    description: "",
    coverImage: null,
    links: [],
    order: 50,
    status: "published",
    kind: "project",
    tagline: "",
    repo: null,
    stats: null,
    createdAt: T,
    updatedAt: T,
    ...extra,
  });
  const post = (slug: string, collection: string, extra: Record<string, unknown> = {}) => ({
    _id: `post:${slug}`,
    type: "post",
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    excerpt: `Excerpt of ${slug}.`,
    body: "Body.",
    status: "published",
    publishedAt: T,
    createdAt: T,
    updatedAt: T,
    tags: [],
    collection,
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...extra,
  });
  const STORE = {
    collections: [
      area("windom", { title: "WindoM", tagline: "Every new tab becomes a <dashboard>" }),
      area("site", { kind: "site", title: "The site" }),
      area("secret-area", { status: "hidden", title: "Secret area" }),
    ],
    posts: [
      post("windom-note", "windom"),
      post("windom-draft", "windom", { status: "draft", title: "Unfinished draft" }),
      post("site-note", "site"),
    ],
  };

  beforeEach(() => {
    resetShellCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } })),
    );
    vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
      const s = (query as { selector: { type: string; slug?: string } }).selector;
      if (s.type === "post") return { docs: STORE.posts as never[] };
      return { docs: STORE.collections.filter((c) => c.slug === s.slug) as never[] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetShellCache();
  });

  const get = (slug: string) => request(createApp()).get(`/api/seo/render/blog/area/${slug}`);

  it("is a 200 with the area's own head", async () => {
    const res = await get("windom");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(res.text).toContain("<title>WindoM · Notes · Yehuda Briskman</title>");
    expect(res.text).toContain('<meta name="description" content="Every new tab becomes a &lt;dashboard&gt;" />');
    expect(res.text).toMatch(/<link rel="canonical" href="[^"]*\/blog\/area\/windom" \/>/);
    expect(res.text).toContain('<meta name="robots" content="index, follow, max-image-preview:large" />');

    const tags = socialTags(res.text);
    expect(tags.get("og:title")).toBe("WindoM · Notes · Yehuda Briskman");
    expect(tags.get("og:url")).toMatch(/\/blog\/area\/windom$/);
    expect(tags.get("og:image")).toMatch(/\/api\/seo\/og\/projects\/windom\.png$/);
    expect(tags.get("twitter:title")).toBe("WindoM · Notes · Yehuda Briskman");
    expect(tags.get("twitter:description")).toBe("Every new tab becomes a <dashboard>");
  });

  it("advertises the area's own feed", async () => {
    const res = await get("windom");
    expect(res.text).toMatch(
      /<link rel="alternate" type="application\/rss\+xml" title="Yehuda Briskman · WindoM" href="[^"]*\/api\/seo\/feed\/windom\.xml" \/>/,
    );
  });

  it("lists the area's published notes for a crawler, and never a draft or another area's", async () => {
    const res = await get("windom");
    const body = res.text.slice(res.text.indexOf("</head>"));
    expect(body).toContain('<a href="/blog/windom-note">Title windom-note</a>');
    expect(body).not.toContain("windom-draft");
    expect(body).not.toContain("Unfinished draft");
    expect(body).not.toContain("site-note");
  });

  it("gives the site's own area the notes card rather than a project card", async () => {
    const res = await get("site");
    expect(res.status).toBe(200);
    expect(socialTags(res.text).get("og:image")).toMatch(/\/og-blog\.png$/);
  });

  it("is an uncached, noindex 404 for an area that does not exist", async () => {
    const res = await get("no-such-area");
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text).toContain("<title>Not found · Yehuda Briskman</title>");
    expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
    expect(res.text).not.toContain("/api/seo/feed/no-such-area.xml");
  });

  it("is the same 404 for a hidden area, and says nothing about it", async () => {
    const res = await get("secret-area");
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text).toContain("<title>Not found · Yehuda Briskman</title>");
    expect(res.text).not.toContain("Secret area");
    expect(res.text).not.toContain("feed/secret-area.xml");
  });

  it("answers a slug no area could have without asking the database", async () => {
    const res = await get("Not_A-Slug");
    expect(res.status).toBe(404);
    expect(couch.find).not.toHaveBeenCalled();
  });
});
