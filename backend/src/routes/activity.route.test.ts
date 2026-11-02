import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { decodeCursor } from "../services/activity.js";

/*
 * The activity feed and the ranked areas (#223), against a stubbed store.
 *
 * The stub answers by the selector's `type`, the way the store would, and it
 * deliberately ignores `status`: drafts, archived posts and hidden areas are
 * handed back anyway, so the tests prove the builder holds the public boundary
 * on its own and not only because the selector asked nicely.
 */

function post(slug: string, publishedAt: string, extra: Record<string, unknown> = {}) {
  return {
    _id: `post:${slug}`,
    _rev: "1-abc",
    type: "post",
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    excerpt: "An excerpt.",
    body: "Body text.",
    bodyFormat: "markdown",
    status: "published",
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    tags: ["craft"],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...extra,
  };
}

function area(slug: string, createdAt: string, extra: Record<string, unknown> = {}) {
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
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

const stats = (pushedAt: string | null, release: { tag: string; publishedAt: string } | null) => ({
  stars: 3,
  forks: 0,
  openIssues: 0,
  language: "TypeScript",
  license: "MIT",
  pushedAt,
  latestRelease: release ? { ...release, url: `https://github.com/someone/windom/releases/tag/${release.tag}` } : null,
  fetchedAt: "2026-10-30T00:00:00.000Z",
  error: null,
});

type Store = { posts: unknown[]; collections: unknown[]; site?: unknown };

function stubStore(store: Store) {
  vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
    const type = (query as { selector: { type: string } }).selector.type;
    return { docs: (type === "post" ? store.posts : store.collections) as never[] };
  });
  vi.spyOn(couch, "get").mockImplementation(async () => {
    if (store.site === undefined) throw new CouchError(404, "couch 404");
    return store.site as never;
  });
}

const FULL: Store = {
  posts: [
    post("newest-note", "2026-10-20T10:00:00.000Z", { featured: 1 }),
    post("windom-note", "2026-10-10T10:00:00.000Z", { collection: "windom", tags: ["infra", "ci"] }),
    post("old-note", "2026-09-01T10:00:00.000Z"),
    post("secret-draft", "2026-10-25T10:00:00.000Z", { status: "draft" }),
    post("gone-note", "2026-10-24T10:00:00.000Z", { status: "archived" }),
    post("hidden-shelf-note", "2026-10-23T10:00:00.000Z", { collection: "secret-area" }),
  ],
  collections: [
    area("site", "2026-01-01T00:00:00.000Z"),
    area("windom", "2026-03-01T00:00:00.000Z", {
      repo: { owner: "someone", name: "windom", branch: "main", docPaths: [] },
      stats: stats("2026-10-28T08:00:00.000Z", { tag: "v2.0.0", publishedAt: "2026-10-15T12:00:00.000Z" }),
    }),
    area("secret-area", "2026-10-22T00:00:00.000Z", {
      status: "hidden",
      repo: { owner: "someone", name: "secret", branch: "main", docPaths: [] },
      stats: stats("2026-10-29T08:00:00.000Z", { tag: "v9.9.9", publishedAt: "2026-10-29T09:00:00.000Z" }),
    }),
  ],
  site: {
    _id: "site-releases",
    _rev: "3-abc",
    type: "site-releases",
    repo: { owner: "YehudaBriskman", name: "portfolio_site" },
    items: [{ tag: "v1.4.0", name: "v1.4.0", url: "https://github.com/x/y/releases/tag/v1.4.0", publishedAt: "2026-10-26T00:00:00.000Z" }],
    fetchedAt: "2026-10-30T00:00:00.000Z",
    error: null,
  },
};

afterEach(() => vi.restoreAllMocks());

describe("GET /api/activity", () => {
  it("returns every kind, newest first, in the documented event shape", async () => {
    stubStore(FULL);
    const res = await request(createApp()).get("/api/activity");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.body.ok).toBe(true);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items.map((e: { id: string }) => e.id)).toEqual([
      "push:windom:2026-10-28",
      "site:v1.4.0",
      "post:newest-note",
      "release:windom:v2.0.0",
      "post:windom-note",
      "post:old-note",
      "area:windom",
      "area:site",
    ]);
    for (const e of res.body.items) {
      expect(Object.keys(e).sort()).toEqual(["area", "at", "href", "id", "kind", "meta", "title"]);
    }
    const note = res.body.items.find((e: { id: string }) => e.id === "post:windom-note");
    expect(note).toMatchObject({
      kind: "post",
      area: { slug: "windom", title: "Area windom" },
      href: "/blog/windom-note",
      meta: { tags: ["infra", "ci"], readingMinutes: 1 },
    });
    expect(res.body.items.find((e: { id: string }) => e.id === "site:v1.4.0").area).toEqual({ slug: "site", title: "Area site" });
  });

  it("never lets a draft, an archived post or anything in a hidden area through", async () => {
    stubStore(FULL);
    const res = await request(createApp()).get("/api/activity?limit=50");
    const text = JSON.stringify(res.body);

    for (const leak of ["secret-draft", "gone-note", "hidden-shelf-note", "secret-area", "v9.9.9", "Body text.", "_rev", "status"]) {
      expect(text).not.toContain(leak);
    }
    // The selectors still ask for published posts only.
    const postQuery = vi.mocked(couch.find).mock.calls
      .map((c) => c[0] as { selector: Record<string, unknown> })
      .find((q) => q.selector.type === "post")!;
    expect(postQuery.selector.status).toBe("published");
  });

  it("pages with an opaque cursor, without repeating or skipping an event", async () => {
    stubStore(FULL);
    const app = createApp();
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/api/activity?limit=3${cursor ? `&before=${cursor}` : ""}`;
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(3);
      seen.push(...res.body.items.map((e: { id: string }) => e.id));
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(8);
    expect(new Set(seen).size).toBe(8);
    expect(seen[0]).toBe("push:windom:2026-10-28");
  });

  it("filters by area and by one or more kinds", async () => {
    stubStore(FULL);
    const app = createApp();

    const windom = await request(app).get("/api/activity?area=windom");
    expect(windom.body.items.map((e: { kind: string }) => e.kind)).toEqual(["push", "release", "post", "area"]);

    const releases = await request(app).get("/api/activity?kind=release,site");
    expect(releases.body.items.map((e: { id: string }) => e.id)).toEqual(["site:v1.4.0", "release:windom:v2.0.0"]);

    const repeated = await request(app).get("/api/activity?kind=post&kind=area&area=site");
    expect(repeated.body.items.map((e: { id: string }) => e.id)).toEqual(["post:newest-note", "post:old-note", "area:site"]);

    // A hidden area filters to nothing rather than confirming it exists.
    const hidden = await request(app).get("/api/activity?area=secret-area");
    expect(hidden.status).toBe(200);
    expect(hidden.body.items).toEqual([]);
  });

  it("is an empty page, not an error, when nothing has happened yet", async () => {
    stubStore({ posts: [], collections: [] });
    const res = await request(createApp()).get("/api/activity");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [], nextCursor: null });
  });

  it.each([
    ["limit=0"],
    ["limit=51"],
    ["limit=ten"],
    ["kind=comment"],
    ["kind="],
    ["area=Not%20A%20Slug"],
    ["before=not-a-cursor"],
  ])("rejects %s with a 400", async (qs) => {
    stubStore(FULL);
    const res = await request(createApp()).get(`/api/activity?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("returns a cursor that names the last event on the page", async () => {
    stubStore(FULL);
    const res = await request(createApp()).get("/api/activity?limit=2");
    expect(decodeCursor(res.body.nextCursor)).toEqual({ at: res.body.items[1].at, id: res.body.items[1].id });
  });

  it("goes without the site's releases when they have never been fetched", async () => {
    stubStore({ ...FULL, site: undefined });
    const res = await request(createApp()).get("/api/activity?kind=site");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("fails as JSON when the store does", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new CouchError(503, "couch 503"));
    vi.spyOn(couch, "get").mockRejectedValue(new CouchError(503, "couch 503"));
    const res = await request(createApp()).get("/api/activity");
    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
  });
});

describe("GET /api/areas", () => {
  it("returns public areas with counts, most recently active first", async () => {
    stubStore(FULL);
    const res = await request(createApp()).get("/api/areas");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.body.items.map((a: { slug: string }) => a.slug)).toEqual(["windom", "site"]);
    const [windom, site] = res.body.items;
    expect(windom).toMatchObject({
      noteCount: 1,
      lastActivityAt: "2026-10-28T08:00:00.000Z",
      repoUrl: "https://github.com/someone/windom",
      topics: [
        { tag: "ci", count: 1 },
        { tag: "infra", count: 1 },
      ],
    });
    expect(windom).not.toHaveProperty("repo");
    // Drafts and archived posts are not counted.
    expect(site).toMatchObject({ noteCount: 2, lastActivityAt: "2026-10-26T00:00:00.000Z" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("is an empty list when there are no areas", async () => {
    stubStore({ posts: [], collections: [] });
    const res = await request(createApp()).get("/api/areas");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [] });
  });
});

describe("GET /api/seo/feed/:slug.xml", () => {
  it("is the area's notes only, as RSS", async () => {
    stubStore(FULL);
    vi.mocked(couch.find).mockImplementation(async (query: unknown) => {
      const s = (query as { selector: Record<string, unknown> }).selector;
      if (s.type === "collection") return { docs: [area("windom", "2026-03-01T00:00:00.000Z")] as never[] };
      return { docs: [FULL.posts[1], FULL.posts[3]] as never[] };
    });
    const res = await request(createApp()).get("/api/seo/feed/windom.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/rss\+xml/);
    expect(res.headers["cache-control"]).toBe("public, max-age=600");
    expect(res.text).toContain("<title>Yehuda Briskman · Area windom</title>");
    expect(res.text).toContain("/blog/windom-note");
    expect(res.text).toContain("/api/seo/feed/windom.xml");
    expect(res.text).not.toContain("secret-draft");
  });

  it("is an uncached 404 for an unknown or hidden area", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
    const res = await request(createApp()).get("/api/seo/feed/secret-area.xml");
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("leaves the site-wide feed where it was", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
    const res = await request(createApp()).get("/api/seo/feed.xml");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Yehuda Briskman · Notes</title>");
  });
});
