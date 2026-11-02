/*
 * The channel log's feed (#226): /api/seo/feed/log.xml, and the page that
 * advertises it, /api/seo/render/blog/log, against a stubbed store.
 *
 * Like activity.route.test.ts, the stub answers by the selector's `type` and
 * ignores `status`, so a draft or a hidden area handed back by a loosened
 * selector still has to be held back by the builder.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";

const T = "2026-10-01T00:00:00.000Z";

function post(slug: string, publishedAt: string, extra: Record<string, unknown> = {}) {
  return {
    _id: `post:${slug}`,
    _rev: "1-abc",
    type: "post",
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    excerpt: `Excerpt of ${slug}.`,
    body: "Body.",
    bodyFormat: "markdown",
    status: "published",
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    tags: [],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...extra,
  };
}

function area(slug: string, extra: Record<string, unknown> = {}) {
  return {
    _id: `collection:${slug}`,
    _rev: "1-abc",
    type: "collection",
    slug,
    title: `Area ${slug}`,
    description: "",
    coverImage: null,
    links: [],
    order: 50,
    status: "published",
    kind: slug === "site" ? "site" : "project",
    tagline: "",
    repo: null,
    stats: null,
    createdAt: T,
    updatedAt: T,
    ...extra,
  };
}

const STORE = {
  posts: [
    post("site-note", "2026-10-20T10:00:00.000Z"),
    post("windom-note", "2026-10-10T10:00:00.000Z", { collection: "windom" }),
    post("secret-draft", "2026-10-25T10:00:00.000Z", { status: "draft" }),
  ],
  collections: [
    area("site"),
    area("windom", {
      repo: { owner: "someone", name: "windom", branch: "main", docPaths: [] },
      stats: {
        stars: 1,
        forks: 0,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        pushedAt: "2026-10-28T08:00:00.000Z",
        latestRelease: {
          tag: "v2.0.0",
          publishedAt: "2026-10-15T12:00:00.000Z",
          url: "https://github.com/someone/windom/releases/tag/v2.0.0",
        },
        fetchedAt: T,
        error: null,
      },
    }),
    area("secret-area", { status: "hidden" }),
  ],
};

function stubStore() {
  vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
    const type = (query as { selector: { type: string } }).selector.type;
    return { docs: (type === "post" ? STORE.posts : STORE.collections) as never[] };
  });
  vi.spyOn(couch, "get").mockImplementation(async () => {
    throw new CouchError(404, "couch 404");
  });
}

const items = (xml: string) => [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);
const guids = (xml: string) => items(xml).map((i) => /<guid[^>]*>([^<]*)<\/guid>/.exec(i)?.[1]);

afterEach(() => vi.restoreAllMocks());

describe("GET /api/seo/feed/log.xml", () => {
  it("is every public event, newest first, as RSS in the shape of the other feeds", async () => {
    stubStore();
    const res = await request(createApp()).get("/api/seo/feed/log.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/rss\+xml/);
    expect(res.headers["cache-control"]).toBe("public, max-age=600");
    expect(res.text).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(res.text).toContain("<title>Yehuda Briskman · Channel log</title>");
    expect(res.text).toMatch(/<atom:link href="[^"]*\/api\/seo\/feed\/log\.xml" rel="self"/);
    expect(guids(res.text)).toEqual([
      "push:windom:2026-10-28",
      "post:site-note",
      "release:windom:v2.0.0",
      "post:windom-note",
      "area:windom",
      "area:site",
    ]);
    expect(res.text).not.toContain("secret");
  });

  it("writes each kind's label, an absolute link for a site path and the GitHub link as it is", async () => {
    stubStore();
    const res = await request(createApp()).get("/api/seo/feed/log.xml");
    const note = items(res.text).find((i) => i.includes("post:site-note"))!;
    const release = items(res.text).find((i) => i.includes("release:windom"))!;

    expect(note).toContain("<title>New note: Title site-note</title>");
    expect(note).toMatch(/<link>https?:\/\/[^<]+\/blog\/site-note<\/link>/);
    expect(note).toContain("<description>Excerpt of site-note.</description>");
    expect(release).toContain("<link>https://github.com/someone/windom/releases/tag/v2.0.0</link>");
    expect(release).toContain("<category>Release</category>");
    expect(release).toContain("<category>Area windom</category>");
    expect(release).toContain('<guid isPermaLink="false">');
  });

  it("takes the page's filters, and says so in its own links", async () => {
    stubStore();
    const res = await request(createApp()).get("/api/seo/feed/log.xml?kind=release&kind=post&area=windom");

    expect(res.status).toBe(200);
    expect(guids(res.text)).toEqual(["release:windom:v2.0.0", "post:windom-note"]);
    expect(res.text).toContain("/blog/log?kind=release&amp;kind=post&amp;area=windom</link>");
    expect(res.text).toContain("/api/seo/feed/log.xml?kind=release&amp;kind=post&amp;area=windom");
  });

  it("is an uncached 400 for a filter that is not one", async () => {
    stubStore();
    const res = await request(createApp()).get("/api/seo/feed/log.xml?kind=gossip");
    expect(res.status).toBe(400);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("leaves an area's own feed where it was", async () => {
    vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
      const s = (query as { selector: Record<string, unknown> }).selector;
      return { docs: (s.type === "collection" ? [area("windom")] : [STORE.posts[1]]) as never[] };
    });
    const res = await request(createApp()).get("/api/seo/feed/windom.xml");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Yehuda Briskman · Area windom</title>");
  });
});

describe("GET /api/seo/render/blog/log", () => {
  const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

  afterEach(() => {
    vi.unstubAllGlobals();
    resetShellCache();
  });

  it("is the log page, a 200 that advertises its feed, not a post's 404", async () => {
    resetShellCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } })),
    );
    const find = vi.spyOn(couch, "find");
    const res = await request(createApp()).get("/api/seo/render/blog/log");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Channel log · Yehuda Briskman</title>");
    expect(res.text).toMatch(
      /<link rel="alternate" type="application\/rss\+xml" title="Yehuda Briskman · Channel log" href="[^"]*\/api\/seo\/feed\/log\.xml" \/>/,
    );
    expect(find).not.toHaveBeenCalled();
  });
});
