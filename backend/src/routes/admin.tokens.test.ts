import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { tokensAccepted } from "../middlewares/requireAdmin.js";
import { docHash } from "../services/audit.js";
import { hashToken, newTokenDoc, parseToken, type StoredToken } from "../services/apiTokenFormat.js";

/*
 * Scoped API tokens and the audit log (#252): how automation gets past the
 * admin gate, what a token may not do, and that every write leaves a record.
 */

const NOW = "2026-10-01T10:00:00.000Z";
const notFound = () => new CouchError(404, "couch 404");

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

/* lastUsedAt is "just now" unless a test says otherwise, so the throttled
   lastUsedAt write stays out of the tests that count puts. */
function storedToken(scope: "read" | "write", extra: Partial<StoredToken> = {}) {
  const { token, doc } = newTokenDoc({ name: "mcp-test", scope, createdBy: "tester" });
  return { token, doc: { ...doc, _rev: "1-t", lastUsedAt: new Date().toISOString(), ...extra } };
}

/* Tokens are off by default; these tests are about what happens when on. */
const TOKENS_DEFAULT = env.ADMIN_API_TOKENS;
beforeEach(() => {
  env.ADMIN_API_TOKENS = "on";
});
afterEach(() => {
  env.ADMIN_API_TOKENS = TOKENS_DEFAULT;
});

/* couch.get answering for the token document, and 404 for anything else. */
function storeWith(doc: StoredToken, others: Record<string, unknown> = {}) {
  vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
  return vi.spyOn(couch, "get").mockImplementation(async (id: string) => {
    if (id === doc._id) return doc as never;
    if (id in others) return others[id] as never;
    throw notFound();
  });
}

/* The audit log writes through couch.append, never couch.put. */
const auditLog = () => vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
const auditPuts = (append: ReturnType<typeof auditLog>) =>
  append.mock.calls.map(([, doc]) => doc as Record<string, unknown>);

afterEach(() => vi.restoreAllMocks());

describe("token format", () => {
  it("stores only the hash, and the token names its document", () => {
    const { token, doc } = newTokenDoc({ name: "a", scope: "read", createdBy: "x" });
    expect(JSON.stringify(doc)).not.toContain(token);
    expect(doc.hash).toBe(hashToken(token));
    expect(parseToken(token)).toEqual({ id: doc.id });
    expect(parseToken("ptk_nothex_abc")).toBeNull();
  });
});

describe("ADMIN_API_TOKENS", () => {
  it("defaults to off", () => {
    expect(TOKENS_DEFAULT).toBe("off");
  });

  it("off: a Bearer header is ignored and the store is never asked", async () => {
    env.ADMIN_API_TOKENS = "off";
    const { token, doc } = storedToken("write");
    const get = storeWith(doc);
    const res = await request(createApp()).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "unauthenticated" });
    expect(get).not.toHaveBeenCalled();
  });

  it("tunnel: only a loopback socket, whatever X-Forwarded-For says", () => {
    env.ADMIN_API_TOKENS = "tunnel";
    const from = (remoteAddress: string) => ({ socket: { remoteAddress } }) as never;
    expect(tokensAccepted(from("127.0.0.1"))).toBe(true);
    expect(tokensAccepted(from("::1"))).toBe(true);
    expect(tokensAccepted(from("::ffff:127.0.0.1"))).toBe(true);
    expect(tokensAccepted(from("10.42.0.17"))).toBe(false);
    env.ADMIN_API_TOKENS = "off";
    expect(tokensAccepted(from("127.0.0.1"))).toBe(false);
  });
});

describe("bearer tokens at the admin gate", () => {
  it("refuses an expired token", async () => {
    const { token, doc } = storedToken("write", { expiresAt: new Date(Date.now() - 1000).toISOString() });
    storeWith(doc);
    const res = await request(createApp()).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("refuses a token stored without an expiry", async () => {
    const { token, doc } = storedToken("write", { expiresAt: undefined as never });
    storeWith(doc);
    const res = await request(createApp()).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("records lastUsedAt, at most once a minute", async () => {
    const { token, doc } = storedToken("read", { lastUsedAt: null });
    storeWith(doc);
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();
    await request(app).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    await request(app).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    const touches = put.mock.calls.filter(([id]) => id === doc._id);
    expect(touches).toHaveLength(1);
    expect((touches[0][1] as StoredToken).lastUsedAt).toEqual(expect.any(String));
  });

  it("logs a refusal with the id prefix only, never the token", async () => {
    const { token, doc } = storedToken("write");
    storeWith(doc);
    const warn = vi.spyOn(logger, "warn");
    const wrong = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    await request(createApp()).get("/api/admin/me").set("Authorization", `Bearer ${wrong}`);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "mismatch", tokenIdPrefix: doc.id.slice(0, 6) }),
      "admin bearer token refused",
    );
    const logged = JSON.stringify(warn.mock.calls);
    // The secret is everything after `ptk_<16 hex>_`. It may itself contain
    // `_` (base64url), so splitting on `_` sometimes yielded "" and failed.
    expect(logged).not.toContain(wrong.slice("ptk_".length + 17));
    expect(logged).not.toContain(doc.id);
  });

  it("limits failed bearer attempts to ten per fifteen minutes", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(notFound());
    const app = createApp();
    const bad = `ptk_${"f".repeat(16)}_${"A".repeat(43)}`;
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/api/admin/me").set("Authorization", `Bearer ${bad}`);
      expect(res.status).toBe(401);
    }
    const res = await request(app).get("/api/admin/me").set("Authorization", `Bearer ${bad}`);
    expect(res.status).toBe(429);
    // The browser session is not counted against, and not blocked by, it.
    const owner = await asAdmin(request(app).get("/api/admin/me"));
    expect(owner.status).toBe(200);
  });

  it("lets a valid write token through and says who it is", async () => {
    const { token, doc } = storedToken("write");
    storeWith(doc);
    const res = await request(createApp()).get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ login: "token:mcp-test", via: "token", tokenId: doc.id, scope: "write" });
  });

  it("refuses a wrong secret, an unknown id, a revoked token and a malformed one", async () => {
    const { token, doc } = storedToken("write");
    storeWith(doc);
    const app = createApp();
    const wrong = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const unknown = `ptk_${"0".repeat(16)}_${token.split("_").slice(2).join("_")}`;
    for (const t of [wrong, unknown, "not-a-token"]) {
      const res = await request(app).get("/api/admin/me").set("Authorization", `Bearer ${t}`);
      expect(res.status).toBe(401);
    }
    vi.restoreAllMocks();
    const revoked = storedToken("write", { revokedAt: NOW });
    storeWith(revoked.doc);
    const res = await request(app).get("/api/admin/me").set("Authorization", `Bearer ${revoked.token}`);
    expect(res.status).toBe(401);
  });

  it("lets a read token read and refuses it a write", async () => {
    const { token, doc } = storedToken("read");
    storeWith(doc);
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();

    const read = await request(app).get("/api/admin/posts").set("Authorization", `Bearer ${token}`);
    expect(read.status).toBe(200);

    const write = await request(app)
      .put("/api/admin/posts/a-post")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "x" });
    expect(write.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("never lets a token manage tokens, whatever its scope", async () => {
    const { token, doc } = storedToken("write");
    storeWith(doc);
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();
    const list = await request(app).get("/api/admin/tokens").set("Authorization", `Bearer ${token}`);
    const mint = await request(app)
      .post("/api/admin/tokens")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "another", scope: "write" });
    expect(list.status).toBe(403);
    expect(mint.status).toBe(403);
    expect(put.mock.calls.filter(([id]) => String(id).startsWith("apitoken:"))).toHaveLength(0);
  });
});

describe("token management from the admin session", () => {
  it("creates a token, returns it once, and stores only its hash", async () => {
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const res = await asAdmin(request(createApp()).post("/api/admin/tokens")).send({ name: "mcp-prod", scope: "write" });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^ptk_[0-9a-f]{16}_/);
    const [id, stored] = put.mock.calls.find(([k]) => String(k).startsWith("apitoken:"))!;
    expect(id).toBe(`apitoken:${res.body.item.id}`);
    expect(JSON.stringify(stored)).not.toContain(res.body.token);
    expect((stored as StoredToken).hash).toBe(hashToken(res.body.token));
    expect(res.body.item).not.toHaveProperty("hash");
  });

  it("revokes a token", async () => {
    const { doc } = storedToken("write");
    storeWith(doc);
    const put = vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const res = await asAdmin(request(createApp()).delete(`/api/admin/tokens/${doc.id}`));
    expect(res.status).toBe(200);
    expect(res.body.item.revokedAt).toEqual(expect.any(String));
    expect((put.mock.calls.find(([k]) => k === doc._id)![1] as StoredToken).revokedAt).toEqual(expect.any(String));
  });

  it("rejects an unknown scope", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/tokens")).send({ name: "x", scope: "admin" });
    expect(res.status).toBe(400);
  });

  it("mints read for 30 days unless asked, and never past 90", async () => {
    vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const app = createApp();
    const res = await asAdmin(request(app).post("/api/admin/tokens")).send({ name: "plain" });
    expect(res.status).toBe(201);
    expect(res.body.item.scope).toBe("read");
    const days = (Date.parse(res.body.item.expiresAt) - Date.parse(res.body.item.createdAt)) / 86_400_000;
    expect(days).toBe(30);

    const long = await asAdmin(request(app).post("/api/admin/tokens")).send({ name: "long", expiresInDays: 91 });
    expect(long.status).toBe(400);
    expect(() => newTokenDoc({ name: "x", scope: "read", createdBy: "x", ttlDays: 91 })).toThrow(RangeError);
  });
});

describe("the audit log", () => {
  it("records a token's write with who, what, and before/after hashes", async () => {
    const { token, doc } = storedToken("write");
    const existing = {
      _id: "collection:tools",
      _rev: "2-c",
      type: "collection",
      slug: "tools",
      title: "Old",
      description: "",
      coverImage: null,
      links: [],
      order: 10,
      status: "published",
      kind: "project",
      tagline: "",
      repo: null,
      stats: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    storeWith(doc, { "collection:tools": existing });
    vi.spyOn(couch, "put").mockResolvedValue({ ok: true });
    const put = auditLog();

    const res = await request(createApp())
      .put("/api/admin/collections/tools")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New", _rev: "2-c" });
    expect(res.status).toBe(200);

    await vi.waitFor(() => expect(auditPuts(put)).toHaveLength(1));
    const [entry] = auditPuts(put);
    expect(entry).toMatchObject({
      type: "audit",
      actor: { login: "token:mcp-test", via: "token", tokenId: doc.id },
      method: "PUT",
      path: "/api/admin/collections/tools",
      status: 200,
      target: "collection:tools",
      beforeHash: docHash(existing),
      afterHash: docHash(res.body.collection),
    });
    expect(entry.beforeHash).not.toBe(entry.afterHash);
    // Created, never updated: no revision on an audit write.
    expect(entry).not.toHaveProperty("_rev");
  });

  it("records a refused write too, and not a read", async () => {
    const put = auditLog();
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
    const app = createApp();
    await asAdmin(request(app).get("/api/admin/posts"));
    const bad = await asAdmin(request(app).put("/api/admin/posts/BAD SLUG")).send({});
    expect(bad.status).toBe(400);
    await vi.waitFor(() => expect(auditPuts(put)).toHaveLength(1));
    expect(auditPuts(put)[0]).toMatchObject({ method: "PUT", status: 400, target: null, beforeHash: null });
  });

  it("is readable, newest first, with a cursor", async () => {
    const items = [
      { _id: "audit:2026-10-02T00:00:00.000Z:0000000b", type: "audit", at: "2026-10-02T00:00:00.000Z" },
      { _id: "audit:2026-10-01T00:00:00.000Z:0000000a", type: "audit", at: "2026-10-01T00:00:00.000Z" },
    ];
    const find = vi.spyOn(couch, "find").mockResolvedValue({ docs: items });
    const res = await asAdmin(request(createApp()).get("/api/admin/audit?limit=2"));
    expect(res.status).toBe(200);
    expect(res.body.items[0].id).toBe(items[0]._id);
    expect(res.body.next).toBe(items[1]._id);
    expect(find.mock.calls[0][0]).toMatchObject({ sort: [{ _id: "desc" }], limit: 2 });

    const bad = await asAdmin(request(createApp()).get("/api/admin/audit?before=post:x"));
    expect(bad.status).toBe(400);
  });
});
