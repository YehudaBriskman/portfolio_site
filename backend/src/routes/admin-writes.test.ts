import { EventEmitter } from "node:events";
import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { auditWrites } from "../services/audit.js";
import { DEFAULT_SETTINGS } from "../schemas/site-settings.js";
import { newTokenDoc } from "../services/apiTokenFormat.js";

/*
 * Admin writes: link schemes, the draft lock on translations, the audit
 * target, a kept publish date and revision races on deletes.
 */

const NOW = "2026-10-01T10:00:00.000Z";
const conflict = () => new CouchError(409, "couch 409");
const missing = () => new CouchError(404, "couch 404");

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

const post = (over: Record<string, unknown> = {}) => ({
  _id: "post:a-note",
  _rev: "3-abc",
  type: "post",
  slug: "a-note",
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
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("link schemes", () => {
  it("refuses javascript: and data: links and covers on posts and areas", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(missing());
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();
    const bad = "javascript:alert(1)";

    const p = await asAdmin(
      request(app).put("/api/admin/posts/a-note").send({ title: "T", links: [{ label: "x", url: bad }] }),
    );
    expect(p.status).toBe(400);
    const c = await asAdmin(
      request(app).put("/api/admin/collections/an-area").send({ title: "T", links: [{ label: "x", url: bad }] }),
    );
    expect(c.status).toBe(400);
    const icon = await asAdmin(
      request(app).put("/api/admin/collections/an-area").send({ title: "T", icon: "data:text/html,x" }),
    );
    expect(icon.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});

describe("PUT /posts/:slug publishedAt", () => {
  it("keeps the publish date when a published note goes back to draft", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(post());
    vi.spyOn(couch, "put").mockResolvedValue({ ok: true, rev: "4-x" });
    const res = await asAdmin(
      request(createApp()).put("/api/admin/posts/a-note").send({ title: "T", status: "draft", _rev: "3-abc" }),
    );
    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ status: "draft", publishedAt: NOW });
  });
});

describe("PUT /translations/draft lock", () => {
  it("refuses a real write that names no rev, and lets a dry run through", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(post());
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true, rev: "4-x" });
    const app = createApp();
    const body = { type: "post", id: "a-note", units: [{ path: "title", he: "כותרת" }] };

    const real = await asAdmin(request(app).put("/api/admin/translations/draft").send({ ...body, dryRun: false }));
    expect(real.status).toBe(409);
    expect(put).not.toHaveBeenCalled();

    const dry = await asAdmin(request(app).put("/api/admin/translations/draft").send(body));
    expect(dry.status).not.toBe(409);
  });
});

describe("audit target for settings", () => {
  it("records the settings document and its hashes", async () => {
    const append = vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
    vi.spyOn(couch, "get").mockRejectedValue(missing());
    vi.spyOn(couch, "put").mockResolvedValue({ ok: true, rev: "1-a" });
    const res = await asAdmin(request(createApp()).put("/api/admin/settings").send({ settings: DEFAULT_SETTINGS }));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(append).toHaveBeenCalled());
    const entry = append.mock.calls[0][1] as { target: string | null; afterHash: string | null };
    expect(entry.target).toMatch(/^settings/);
    expect(entry.afterHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("audit when the client drops", () => {
  it("writes an entry on close even though finish never fires", async () => {
    const append = vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
    const res = Object.assign(new EventEmitter(), { statusCode: 200, writableFinished: false, locals: {} });
    const req = { method: "PUT", originalUrl: "/api/admin/posts/x?y=1", admin: { login: "o", via: "token", tokenId: "t" } };
    const next = vi.fn();
    auditWrites(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    res.emit("close");
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][1]).toMatchObject({ method: "PUT", path: "/api/admin/posts/x", status: 499 });
  });
});

describe("revision races on deletes", () => {
  it("revokes a token on the second try when its own touch won the first", async () => {
    vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
    const { doc } = newTokenDoc({ name: "t", scope: "read", createdBy: "x" });
    const gets = [{ ...doc, _rev: "1-a" }, { ...doc, _rev: "2-b" }];
    vi.spyOn(couch, "get").mockImplementation(async () => (gets.length > 1 ? gets.shift() : gets[0]) as never);
    const put = vi.spyOn(couch, "put").mockRejectedValueOnce(conflict()).mockResolvedValue({ ok: true });
    const res = await asAdmin(request(createApp()).delete(`/api/admin/tokens/${doc.id}`));
    expect(res.status).toBe(200);
    expect(put).toHaveBeenCalledTimes(2);
    expect((put.mock.calls[1][1] as { _rev: string; revokedAt?: string })).toMatchObject({ _rev: "2-b" });
    expect((put.mock.calls[1][1] as { revokedAt?: string }).revokedAt).toBeTruthy();
  });

  it("answers 409, not 502, when archiving keeps losing the race", async () => {
    vi.spyOn(couch, "get").mockResolvedValue(post());
    vi.spyOn(couch, "put").mockRejectedValue(conflict());
    const res = await asAdmin(request(createApp()).delete("/api/admin/posts/a-note"));
    expect(res.status).toBe(409);
  });
});
