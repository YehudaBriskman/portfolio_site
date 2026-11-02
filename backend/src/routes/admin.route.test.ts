import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { fetchRepoStats } from "../services/github.js";

/*
 * The authoring API: the gate in front of it, the optimistic lock, and what a
 * failure looks like to the admin client.
 *
 * fetchRepoStats is imported by name into admin.route.ts, so a spy on the
 * module object would not reach the route's binding; a module mock does. The
 * rest of services/github.ts stays real, because app.ts wires its refresh and
 * the contributions router through the same graph.
 */
vi.mock(import("../services/github.js"), async (importOriginal) => ({
  ...(await importOriginal()),
  fetchRepoStats: vi.fn(),
}));

const NOW = "2026-10-01T10:00:00.000Z";

/* The two facts requireAdmin demands. Read from env rather than restated, so a
   developer whose .env sets a real secret still passes. */
function asAdmin(req: request.Test) {
  return req
    .set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET)
    .set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

function storedPost(slug: string) {
  return {
    _id: `post:${slug}`,
    _rev: "3-abc",
    type: "post",
    slug,
    title: "Stored",
    subtitle: null,
    excerpt: "e",
    body: "b",
    bodyFormat: "markdown",
    status: "published",
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    tags: [],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
  };
}

function storedCollection(slug: string, repo: unknown = null) {
  return {
    _id: `collection:${slug}`,
    _rev: "1-x",
    type: "collection",
    slug,
    title: "Area",
    description: "",
    coverImage: null,
    links: [],
    order: 10,
    status: "published",
    kind: "project",
    tagline: "",
    repo,
    stats: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const notFound = () => new CouchError(404, "couch 404");

afterEach(() => vi.restoreAllMocks());

describe("the admin gate", () => {
  it("refuses a request without the proxy secret, whatever user it claims", async () => {
    const find = vi.spyOn(couch, "find");
    const res = await request(createApp())
      .get("/api/admin/posts")
      .set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "unauthenticated" });
    expect(find).not.toHaveBeenCalled();
  });

  it("refuses the right secret with the wrong user", async () => {
    const res = await request(createApp())
      .get("/api/admin/posts")
      .set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET)
      .set("X-Auth-Request-User", "somebody-else");
    expect(res.status).toBe(403);
  });

  it("lets the owner through and says who they are", async () => {
    const res = await asAdmin(request(createApp()).get("/api/admin/me"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, login: env.ADMIN_GITHUB_LOGIN });
  });
});

describe("admin posts", () => {
  it("lists every post, drafts included", async () => {
    const find = vi.spyOn(couch, "find").mockResolvedValue({ docs: [storedPost("one-post")] });
    const res = await asAdmin(request(createApp()).get("/api/admin/posts"));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect((find.mock.calls[0][0] as { selector: object }).selector).toEqual({ type: "post" });
  });

  it("is a 404 for an unknown slug, and passes any other store failure on as 502", async () => {
    const get = vi.spyOn(couch, "get").mockRejectedValueOnce(notFound());
    const app = createApp();

    const missing = await asAdmin(request(app).get("/api/admin/posts/no-such-post"));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ ok: false, error: "Not Found" });

    get.mockRejectedValueOnce(new CouchError(401, "couch 401"));
    const broken = await asAdmin(request(app).get("/api/admin/posts/any-post"));
    expect(broken.status).toBe(502);
    expect(broken.body).toMatchObject({ ok: false, error: "The content store is unavailable." });
  });

  it("creates a new post as a draft", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(notFound());
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });

    const res = await asAdmin(
      request(createApp()).put("/api/admin/posts/new-post").send({ title: "New", body: "Some words." }),
    );

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ slug: "new-post", status: "draft", publishedAt: null });
    expect(put).toHaveBeenCalledWith("post:new-post", expect.objectContaining({ type: "post" }));
  });

  it("names the rejected field on an invalid write", async () => {
    const res = await asAdmin(request(createApp()).put("/api/admin/posts/windom.app").send({ title: "x" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid");
    // admin.ts in the web client turns exactly this into per-field messages.
    expect(res.body.details.fieldErrors).toHaveProperty("slug");
  });

  it("refuses to overwrite an existing post when the write names no revision", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(storedPost("taken-post"));
    const put = vi.spyOn(couch, "put");

    const res = await asAdmin(request(createApp()).put("/api/admin/posts/taken-post").send({ title: "Mine" }));

    expect(res.status).toBe(409);
    expect(put).not.toHaveBeenCalled();
  });

  it("reports a lost race at the store as 409, not as a store failure", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(storedPost("raced-post"));
    vi.spyOn(couch, "put").mockRejectedValue(new CouchError(409, "conflict"));

    const res = await asAdmin(
      request(createApp()).put("/api/admin/posts/raced-post").send({ title: "Mine", _rev: "2-old" }),
    );
    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
  });

  it("archives rather than deletes", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(storedPost("old-post"));
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });

    const res = await asAdmin(request(createApp()).delete("/api/admin/posts/old-post"));
    expect(res.status).toBe(200);
    expect(put).toHaveBeenCalledWith("post:old-post", expect.objectContaining({ status: "archived" }));
  });
});

describe("admin collections", () => {
  it("lists areas in their order", async () => {
    vi.spyOn(couch, "find").mockResolvedValue({
      docs: [{ ...storedCollection("bbb"), order: 2 }, { ...storedCollection("aaa"), order: 1 }],
    });
    const res = await asAdmin(request(createApp()).get("/api/admin/collections"));
    expect(res.body.items.map((c: { slug: string }) => c.slug)).toEqual(["aaa", "bbb"]);
  });

  it("will not remove the site's own collection", async () => {
    const res = await asAdmin(request(createApp()).delete("/api/admin/collections/site"));
    expect(res.status).toBe(400);
  });

  it("hides rather than deletes, and 404s an unknown area", async () => {
    const get = vi.spyOn(couch, "get").mockResolvedValueOnce(storedCollection("an-area"));
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();

    const ok = await asAdmin(request(app).delete("/api/admin/collections/an-area"));
    expect(ok.status).toBe(200);
    expect(put).toHaveBeenCalledWith("collection:an-area", expect.objectContaining({ status: "hidden" }));

    get.mockRejectedValueOnce(notFound());
    const missing = await asAdmin(request(app).delete("/api/admin/collections/gone-area"));
    expect(missing.status).toBe(404);
  });

  it("refuses to sync an area with no repository", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(storedCollection("no-repo"));
    const res = await asAdmin(request(createApp()).post("/api/admin/collections/no-repo/sync"));
    expect(res.status).toBe(400);
    expect(fetchRepoStats).not.toHaveBeenCalled();
  });

  it("stores fresh repository numbers on sync", async () => {
    const repo = { owner: "someone", name: "thing", branch: "main", docPaths: [] };
    vi.spyOn(couch, "get").mockResolvedValue(storedCollection("with-repo", repo));
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const stats = { stars: 3, forks: 0, openIssues: 0, language: "TypeScript", license: null, pushedAt: NOW, latestRelease: null, fetchedAt: NOW, error: null };
    vi.mocked(fetchRepoStats).mockResolvedValueOnce(stats);

    const res = await asAdmin(request(createApp()).post("/api/admin/collections/with-repo/sync"));
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual(stats);
    expect(put).toHaveBeenCalledWith("collection:with-repo", expect.objectContaining({ stats }));
  });

  it("answers a failed sync with JSON 500", async () => {
    const repo = { owner: "someone", name: "thing", branch: "main", docPaths: [] };
    vi.spyOn(couch, "get").mockResolvedValue(storedCollection("with-repo", repo));
    vi.mocked(fetchRepoStats).mockRejectedValueOnce(new Error("GitHub said no"));

    const res = await asAdmin(request(createApp()).post("/api/admin/collections/with-repo/sync"));
    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ ok: false, error: "Internal Server Error" });
  });
});
