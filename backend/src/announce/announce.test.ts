import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import type { SiteReleases } from "../schemas/content.js";
import { emailService } from "../services/email.service.js";
import { announceNewReleases } from "./hooks.js";
import { DEFAULT_ANNOUNCE_SETTINGS } from "./schemas.js";

/* CouchDB as an in-memory map: append is create-only, put needs the current _rev. */
let store: Map<string, Record<string, unknown>>;
let revs = 0;

beforeEach(() => {
  store = new Map();
  vi.spyOn(couch, "get").mockImplementation(async <T>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as T;
  });
  vi.spyOn(couch, "put").mockImplementation(async <T>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const ex = store.get(id);
    if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
    const rev = `${++revs + 1}-x`;
    store.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as T;
  });
  vi.spyOn(couch, "append").mockImplementation(async <T>(id: string, body: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(body), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as T;
  });
  vi.spyOn(couch, "find").mockImplementation(async <T>(q: unknown) => {
    const sel = (q as { selector: { _id: { $gt: string; $lt: string } } }).selector._id;
    const docs = [...store.entries()].filter(([id]) => id > sel.$gt && id < sel.$lt).map(([, d]) => structuredClone(d));
    return { docs } as { docs: T[] };
  });
});
afterEach(() => vi.restoreAllMocks());

const asAdmin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const flush = () => new Promise((r) => setTimeout(r, 30));
const events = () => [...store.keys()].filter((k) => k.startsWith("announce:"));

const T = "2026-11-01T10:00:00.000Z";
function post(status: string, extra: Record<string, unknown> = {}) {
  return {
    _id: "post:hello", _rev: "1-a", type: "post", slug: "hello", title: "Hello", subtitle: null, excerpt: "A summary", body: "b",
    bodyFormat: "markdown", status, publishedAt: status === "published" ? T : null, createdAt: T, updatedAt: T, tags: ["Dev"],
    collection: "site", source: "authored", coverImage: null, links: [], readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false }, ...extra,
  };
}

describe("auth", () => {
  it("401/403 without the admin gate", async () => {
    const app = createApp();
    expect([401, 403]).toContain((await request(app).get("/api/admin/announce")).status);
    expect([401, 403]).toContain((await request(app).get("/api/admin/announce/settings")).status);
    expect([401, 403]).toContain((await request(app).post("/api/admin/announce/x/dismiss")).status);
  });
});

describe("publish hook", () => {
  const content = { title: "Hello", body: "New words.", tags: ["ci"], collection: "site", excerpt: "A summary", _rev: "1-a", he: { title: "שלום", body: "מילים." } };
  const publish = (stored: unknown, slug = "hello", body: unknown = content) => send(stored, () => request(createApp()).post(`/api/admin/posts/${slug}/publish`).send(body as object));
  async function send(stored: unknown, send: () => request.Test) {
    store.set("post:hello", structuredClone(stored) as Record<string, unknown>);
    const res = await asAdmin(send());
    await flush();
    return res;
  }

  it("records one event when a draft is published, and dedupes a republish", async () => {
    /* An unpublished note keeps its first publishedAt, so republishing it is the same event id. */
    const draft = post("draft", { publishedAt: T });
    const r = await publish(draft);
    expect(r.status).toBeLessThan(400);
    expect(events()).toHaveLength(1);
    const ev = store.get(events()[0]) as { kind: string; ref: string; path: string; done: object };
    expect(ev).toMatchObject({ kind: "post", ref: "hello", path: "/blog/hello", langs: ["en", "he"], done: {} });
    await publish(draft);
    expect(events()).toHaveLength(1);
  });

  it("records nothing for an already-published post, or a failed (>=400) request", async () => {
    expect((await publish(post("published"))).status).toBeLessThan(400);
    expect(events()).toHaveLength(0);
    expect((await publish(post("draft"), "hello", { ...content, title: "" })).status).toBe(400);
    expect(events()).toHaveLength(0);
  });
});

describe("release-diff hook", () => {
  const rel = (tag: string, at: string) => ({ tag, name: null, url: `https://github.com/o/r/releases/tag/${tag}`, publishedAt: at });
  const doc = (items: ReturnType<typeof rel>[], error: string | null = null): SiteReleases => ({
    _id: "site-releases", type: "site-releases", repo: { owner: "o", name: "r" }, items, fetchedAt: T, error,
  });

  it("seeds silently on the first run, then announces only a new tag, once", async () => {
    const old = [rel("v1.4.0", "2026-10-01T00:00:00Z"), rel("v1.3.0", "2026-09-01T00:00:00Z")];
    await announceNewReleases(doc(old));
    expect(events()).toHaveLength(0);
    await announceNewReleases(doc(old));
    expect(events()).toHaveLength(0);
    const next = [rel("v1.5.0", "2026-11-01T00:00:00Z"), ...old];
    await announceNewReleases(doc(next));
    expect(events()).toEqual(["announce:release:v1.5.0:2026-11-01T00:00:00Z"]);
    await announceNewReleases(doc(next));
    expect(events()).toHaveLength(1);
  });

  it("ignores a failed fetch", async () => {
    await announceNewReleases(doc([rel("v1.0.0", T)]));
    await announceNewReleases(doc([rel("v9.0.0", T)], "Could not reach GitHub"));
    expect(events()).toHaveLength(0);
  });

  it("records nothing when announcing is switched off", async () => {
    store.set("settings:announce", { _id: "settings:announce", _rev: "1-z", type: "settings-announce", updatedAt: T, settings: { ...DEFAULT_ANNOUNCE_SETTINGS, enabled: false } });
    await announceNewReleases(doc([rel("v1.0.0", T)]));
    await announceNewReleases(doc([rel("v1.1.0", T), rel("v1.0.0", T)]));
    expect(events()).toHaveLength(0);
  });
});

describe("routes", () => {
  async function seed() {
    await announceNewReleases({ _id: "site-releases", type: "site-releases", repo: { owner: "o", name: "r" }, items: [], fetchedAt: T, error: null });
    await announceNewReleases({ _id: "site-releases", type: "site-releases", repo: { owner: "o", name: "r" }, items: [{ tag: "v2.0.0", name: null, url: "https://github.com/o/r/releases/tag/v2.0.0", publishedAt: T }], fetchedAt: T, error: null });
    return encodeURIComponent(events()[0]);
  }

  it("lists with unread, renders the kit, marks read/done/dismiss", async () => {
    const app = createApp();
    const id = await seed();
    const list = await asAdmin(request(app).get("/api/admin/announce"));
    expect(list.body).toMatchObject({ ok: true, unread: 1 });
    const one = await asAdmin(request(app).get(`/api/admin/announce/${id}`));
    expect(one.body.kit.en.linkedin.text).toContain("v2.0.0");
    expect(one.body.kit.en.x.limit).toBe(280);
    expect((await asAdmin(request(app).post(`/api/admin/announce/${id}/done`).send({ channel: "myspace" }))).status).toBe(400);
    const done = await asAdmin(request(app).post(`/api/admin/announce/${id}/done`).send({ channel: "linkedin" }));
    expect(done.body.event.done.linkedin).toBeTruthy();
    expect((await asAdmin(request(app).get("/api/admin/announce"))).body.unread).toBe(0);
    await asAdmin(request(app).post(`/api/admin/announce/${id}/dismiss`));
    expect((await asAdmin(request(app).get("/api/admin/announce"))).body.items).toHaveLength(0);
    expect((await asAdmin(request(app).post("/api/admin/announce/announce:nope/read"))).status).toBe(404);
  });

  it("settings: defaults (email off), strict validation, 409 on a stale _rev", async () => {
    const app = createApp();
    const got = await asAdmin(request(app).get("/api/admin/announce/settings"));
    expect(got.body.settings.email.enabled).toBe(false);
    expect((await asAdmin(request(app).put("/api/admin/announce/settings").send({ settings: { ...got.body.settings, extra: 1 } }))).status).toBe(400);
    const next = { ...got.body.settings, signature: "-- Y" };
    const first = await asAdmin(request(app).put("/api/admin/announce/settings").send({ settings: next }));
    expect(first.status).toBe(200);
    const stale = await asAdmin(request(app).put("/api/admin/announce/settings").send({ settings: next, _rev: "0-stale" }));
    expect(stale.status).toBe(409);
    const ok = await asAdmin(request(app).put("/api/admin/announce/settings").send({ settings: next, _rev: first.body._rev }));
    expect(ok.status).toBe(200);
  });

  it("/api/settings never contains announce data", async () => {
    const app = createApp();
    await asAdmin(request(app).put("/api/admin/announce/settings").send({ settings: { ...DEFAULT_ANNOUNCE_SETTINGS, signature: "SECRET-SIG-XYZ", hashtags: ["owneronly"] } }));
    const pub = await request(app).get("/api/settings");
    expect(pub.status).toBe(200);
    const text = JSON.stringify(pub.body);
    expect(text).not.toMatch(/announce|SECRET-SIG-XYZ|owneronly|signature/i);
  });
});

describe("owner email", () => {
  const rel = (tag: string) => ({ tag, name: null, url: `https://github.com/o/r/releases/tag/${tag}`, publishedAt: T });
  const doc = (tags: string[]): SiteReleases => ({ _id: "site-releases", type: "site-releases", repo: { owner: "o", name: "r" }, items: tags.map(rel), fetchedAt: T, error: null });
  const enable = (on: boolean) =>
    store.set("settings:announce", { _id: "settings:announce", _rev: "1-z", type: "settings-announce", updatedAt: T, settings: { ...DEFAULT_ANNOUNCE_SETTINGS, email: { enabled: on, events: ["post", "release"] } } });

  it("sends nothing by default", async () => {
    const send = vi.spyOn(emailService, "send").mockResolvedValue({ ok: true } as never);
    await announceNewReleases(doc(["v1.0.0"]));
    await announceNewReleases(doc(["v1.1.0", "v1.0.0"]));
    expect(events()).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends one mail per event, with no replyTo, once", async () => {
    enable(true);
    const send = vi.spyOn(emailService, "send").mockResolvedValue({ ok: true } as never);
    await announceNewReleases(doc(["v1.0.0"]));
    await announceNewReleases(doc(["v1.1.0", "v1.0.0"]));
    await announceNewReleases(doc(["v1.1.0", "v1.0.0"]));
    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0][0];
    expect(arg).not.toHaveProperty("replyTo");
    expect(arg.subject).toContain("v1.1.0");
    expect(arg.text).toContain("/admin/announce");
  });

  it("logs a send failure instead of throwing, and keeps the event", async () => {
    enable(true);
    vi.spyOn(emailService, "send").mockRejectedValue(new Error("smtp down"));
    await announceNewReleases(doc(["v1.0.0"]));
    await expect(announceNewReleases(doc(["v1.1.0", "v1.0.0"]))).resolves.toBeUndefined();
    expect(events()).toHaveLength(1);
  });
});
