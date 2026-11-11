import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";

/*
 * The public reading routes, against a stubbed store.
 *
 * `couch` is a plain object, so spying on its methods replaces the network
 * call without mocking the module: the routes, the selectors they build and
 * the public projections all run for real. What these pin is the contract the
 * web client in web/src/services/blog.ts depends on — the envelope keys, the
 * 404 for anything not published, and JSON (never HTML) when the store fails.
 */

const NOW = "2026-10-01T10:00:00.000Z";

function post(slug: string, extra: Record<string, unknown> = {}) {
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
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
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

function collection(slug: string, order: number) {
  return {
    _id: `collection:${slug}`,
    type: "collection",
    slug,
    title: `Area ${slug}`,
    description: "",
    coverImage: null,
    links: [],
    order,
    status: "published",
    kind: "project",
    tagline: "",
    repo: { owner: "someone", name: slug, branch: "main", docPaths: [] },
    stats: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("GET /api/blog/posts", () => {
  it("returns public summaries and asks the store for published posts only", async () => {
    const find = vi.spyOn(couch, "find").mockResolvedValue({ docs: [post("first-post")] });
    const res = await request(createApp()).get("/api/blog/posts?tag=craft");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toHaveLength(1);
    // The public projection: no status, no _rev, no body in a summary.
    expect(res.body.items[0]).not.toHaveProperty("_rev");
    expect(res.body.items[0]).not.toHaveProperty("status");
    expect(res.body.items[0]).not.toHaveProperty("body");
    // `featured` is public, and null on a document written before it existed.
    expect(res.body.items[0].featured).toBeNull();

    // Drafts are excluded in the selector, so they never cross the wire.
    const query = find.mock.calls[0][0] as { selector: Record<string, unknown> };
    expect(query.selector).toMatchObject({ type: "post", status: "published" });
    expect(query.selector.tags).toEqual({ $elemMatch: { $eq: "craft" } });
  });

  it("walks past the first 100 posts instead of dropping them", async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => post(`p-${from + i}`));
    const find = vi
      .spyOn(couch, "find")
      .mockResolvedValueOnce({ docs: page(0, 100) })
      .mockResolvedValueOnce({ docs: page(100, 30) });
    const res = await request(createApp()).get("/api/blog/posts");

    expect(res.body.items).toHaveLength(130);
    expect(find).toHaveBeenCalledTimes(2);
    expect((find.mock.calls[1][0] as { skip: number }).skip).toBe(100);
  });

  it("answers a store failure with JSON 502, and logs it through pino", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new CouchError(400, "couch 400 on /_find"));
    const error = vi.spyOn(logger, "error");

    const res = await request(createApp()).get("/api/blog/posts");

    expect(res.status).toBe(502);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ ok: false, error: "The content store is unavailable." });
    // The store's own path and status are for the log, not the reader.
    expect(JSON.stringify(res.body.error)).not.toContain("_find");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 502, url: "/api/blog/posts" }),
      "request failed",
    );
  });

  it("answers an unexpected throw with JSON 500 and a fixed message", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.7:5984"));
    const res = await request(createApp()).get("/api/blog/posts");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ ok: false, error: "Internal Server Error" });
    expect(res.body.error).not.toContain("10.0.0.7");
  });
});

describe("GET /api/blog/tags", () => {
  it("counts tags across published posts, most used first", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({
      docs: [post("aaa", { tags: ["a", "b"] }), post("bbb", { tags: ["b"] })],
    });
    const res = await request(createApp()).get("/api/blog/tags");

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([
      { tag: "b", count: 2 },
      { tag: "a", count: 1 },
    ]);
  });

  it("fails as JSON when the store does", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new CouchError(503, "couch 503"));
    const res = await request(createApp()).get("/api/blog/tags");
    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
  });
});

describe("GET /api/blog/posts/:slug", () => {
  it("returns the public post", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [post("first-post")] });
    const res = await request(createApp()).get("/api/blog/posts/first-post");

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ slug: "first-post", body: "Body text." });
    expect(res.body.post).not.toHaveProperty("status");
  });

  it("is a 404 when nothing published matches", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
    const res = await request(createApp()).get("/api/blog/posts/a-draft");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "Not Found" });
  });

  it("is a 404, not a 500, when the stored document is malformed", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [post("broken-post", { createdAt: "yesterday" })] });
    const res = await request(createApp()).get("/api/blog/posts/broken-post");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/blog/collections", () => {
  it("returns published areas in their order, without the repo config", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [collection("later", 20), collection("first", 10)] });
    const res = await request(createApp()).get("/api/blog/collections");

    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { slug: string }) => c.slug)).toEqual(["first", "later"]);
    expect(res.body.items[0]).not.toHaveProperty("repo");
    expect(res.body.items[0].repoUrl).toBe("https://github.com/someone/first");
  });

  it("returns one area by slug, and 404 for an unknown one", async () => {
    const find = vi.spyOn(couch, "find").mockResolvedValueOnce({ docs: [collection("first", 10)] });
    const app = createApp();

    const hit = await request(app).get("/api/blog/collections/first");
    expect(hit.status).toBe(200);
    expect(hit.body.collection.slug).toBe("first");

    find.mockResolvedValueOnce({ docs: [] });
    const miss = await request(app).get("/api/blog/collections/nowhere");
    expect(miss.status).toBe(404);
    expect(miss.body).toEqual({ ok: false, error: "Not Found" });
  });

  it("fails as JSON when the store does", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new TypeError("fetch failed"));
    const res = await request(createApp()).get("/api/blog/collections/first");
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});
