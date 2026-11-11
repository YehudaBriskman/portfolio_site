import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";

/* The owner routes for custom announcements, drafts and readiness of every kind. */

const T = "2026-11-01T10:00:00.000Z";
const SITE = env.SITE_URL;
let store: Map<string, Record<string, unknown>>;
let revs = 0;
let collections: unknown[];
let posts: unknown[];

beforeEach(() => {
  store = new Map();
  collections = [{ _id: "collection:tools", type: "collection", slug: "tools", title: "Tools", tagline: "Things I use every day", description: "", status: "published", kind: "site", links: [], order: 1, createdAt: T, updatedAt: T }];
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no outbound request allowed"); }));
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const ex = store.get(id);
    if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
    const rev = `${++revs + 1}-x`;
    store.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as R;
  });
  vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(body), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const s = (q as { selector: { _id?: { $gt: string; $lt: string }; type?: string; slug?: string } }).selector;
    if (s._id) return { docs: [...store.entries()].filter(([id]) => id > s._id!.$gt && id < s._id!.$lt).map(([, d]) => structuredClone(d)) as never[] };
    const pool = s.type === "collection" ? collections : s.type === "post" ? posts : [];
    return { docs: pool.filter((d) => !s.slug || (d as { slug: string }).slug === s.slug) as never[] };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const A = "/api/admin/announce";
const create = (body: unknown) => admin(request(createApp()).post(A).send(body as object));
const ID = (r: request.Response) => encodeURIComponent(r.body.event.id);

describe("POST /api/admin/announce", () => {
  it("401/403 without the admin gate", async () => {
    expect([401, 403]).toContain((await request(createApp()).post(A).send({ title: "x", summary: "" })).status);
  });

  it("creates a custom announcement with the site's own links", async () => {
    const r = await create({ title: "Hello", summary: "Sum", url: `${SITE}/projects/windom?x=1`, imageUrl: `${SITE}/og-blog.png` });
    expect(r.status).toBe(201);
    const ev = store.get(r.body.event.id) as { kind: string; custom: Record<string, string>; url: string; langs: string[] };
    expect(ev).toMatchObject({ kind: "custom", url: `${SITE}/projects/windom?x=1`, langs: ["en"] });
    expect(ev.custom).toEqual({ title: "Hello", summary: "Sum", url: `${SITE}/projects/windom?x=1`, imageUrl: `${SITE}/og-blog.png` });
  });

  it("needs only a title and a summary, and links to the site by default", async () => {
    const r = await create({ title: "Hello", summary: "" });
    expect(r.status).toBe(201);
    expect(store.get(r.body.event.id)).toMatchObject({ url: SITE });
  });

  it.each([
    ["another origin", { url: "https://evil.example/x" }],
    ["a javascript: url", { url: "javascript:alert(1)" }],
    ["a data: image", { imageUrl: "data:image/png;base64,AAAA" }],
    ["an image on another origin", { imageUrl: "https://evil.example/i.png" }],
    ["credentials in the url", { url: SITE.replace("://", "://u:p@") + "/x" }],
    ["a relative url", { url: "/blog/x" }],
    ["a title over 120", { title: "t".repeat(121) }],
    ["a summary over 500", { summary: "s".repeat(501) }],
    ["an empty title", { title: "" }],
    ["an unknown field", { extra: 1 }],
    ["a kind that has a page of its own", { kind: "post" }],
  ])("rejects %s", async (_n, over) => {
    const r = await create({ title: "Hello", summary: "Sum", ...over });
    expect(r.status).toBe(400);
    expect([...store.keys()].filter((k) => k.startsWith("announce:"))).toHaveLength(0);
  });

  it("story and home are fixed pages in both languages", async () => {
    const s = await create({ kind: "story", title: "My story", summary: "s" });
    expect(store.get(s.body.event.id)).toMatchObject({ kind: "story", path: "/story", langs: ["en", "he"] });
    const h = await create({ kind: "home", title: "Home", summary: "s", url: "https://evil.example" });
    expect(h.status).toBe(400);
  });
});

describe("PUT /api/admin/announce/:id/draft", () => {
  const put = (id: string, body: unknown) => admin(request(createApp()).put(`${A}/${id}/draft`).send(body as object));
  const get = (id: string) => admin(request(createApp()).get(`${A}/${id}`));
  async function made() {
    const r = await create({ title: "Hello", summary: "Sum" });
    return ID(r);
  }

  it("401/403 without the admin gate", async () => {
    expect([401, 403]).toContain((await request(createApp()).put(`${A}/x/draft`).send({})).status);
  });

  it("stores a draft per language and channel, which the kit then uses", async () => {
    const id = await made();
    const r = await put(id, { lang: "he", channel: "x", text: "שלום עולם" });
    expect(r.status).toBe(200);
    const g = await get(id);
    expect(g.body.event.drafts).toEqual({ he: { x: "שלום עולם" } });
    expect(g.body.kit.he.x).toMatchObject({ text: "שלום עולם", draft: true });
    expect(g.body.kit.en.x.draft).toBe(false);
  });

  it("clears with null, and drops the empty containers", async () => {
    const id = await made();
    await put(id, { lang: "en", channel: "x", text: "mine" });
    await put(id, { lang: "en", channel: "linkedin", text: "mine too" });
    await put(id, { lang: "en", channel: "x", text: null });
    expect((await get(id)).body.event.drafts).toEqual({ en: { linkedin: "mine too" } });
    await put(id, { lang: "en", channel: "linkedin", text: null });
    expect((await get(id)).body.event.drafts).toEqual({});
  });

  it("validates the body, and 404s an unknown event", async () => {
    const id = await made();
    expect((await put(id, { lang: "fr", channel: "x", text: "a" })).status).toBe(400);
    expect((await put(id, { lang: "en", channel: "tiktok", text: "a" })).status).toBe(400);
    expect((await put(id, { lang: "en", channel: "x", text: "a".repeat(3001) })).status).toBe(400);
    expect((await put(id, { lang: "en", channel: "x", text: "a".repeat(3000) })).status).toBe(200);
    expect((await put(id, { lang: "en", channel: "x" })).status).toBe(400);
    expect((await put("announce:nope", { lang: "en", channel: "x", text: "a" })).status).toBe(404);
  });

  it("409 on a stale _rev, and accepts the current one", async () => {
    const id = await made();
    const rev = (await get(id)).body.event._rev as string;
    expect((await put(id, { lang: "en", channel: "x", text: "a", _rev: rev })).status).toBe(200);
    const stale = await put(id, { lang: "en", channel: "x", text: "b", _rev: rev });
    expect(stale.status).toBe(409);
    expect((await get(id)).body.event.drafts.en.x).toBe("a");
  });
});

describe("GET /api/admin/announce/:id/preview for every kind", () => {
  const prev = async (body: Record<string, unknown>, q = "") => {
    const r = await create(body);
    return admin(request(createApp()).get(`${A}/${ID(r)}/preview${q}`));
  };

  it("custom: judged on its own fields, with the contract's codes", async () => {
    const r = await prev({ title: "t".repeat(100), summary: "" });
    expect(r.status).toBe(200);
    expect(r.body.issues.map((i: { code: string }) => i.code)).toEqual(["title-long", "description-missing", "image-missing", "no-hebrew-translation"]);
    const ok = await prev({ title: "Fine", summary: "A summary", imageUrl: `${SITE}/og-blog.png` });
    expect(ok.body.issues.map((i: { code: string }) => i.code)).toEqual(["no-hebrew-translation"]);
    expect(ok.body.image).toBe(`${SITE}/og-blog.png`);
    expect((await prev({ title: "Fine", summary: "s" }, "?lang=he")).status).toBe(200);
  });

  it.each([["story", "/story"], ["home", "/"]])("%s: reads the page's own head", async (kind) => {
    const r = await prev({ kind, title: "T", summary: "s" });
    expect(r.status).toBe(200);
    expect(r.body.title).not.toBe("");
    expect(r.body.issues.map((i: { code: string }) => i.code)).not.toContain("no-hebrew-translation");
    expect((await prev({ kind, title: "T", summary: "s" }, "?lang=he")).status).toBe(200);
  });

  it("area: reads /blog/area/:slug and flags a missing Hebrew page", async () => {
    store.set("announce:area:tools:1", { _id: "announce:area:tools:1", type: "announce", kind: "area", ref: "tools", title: "Tools", summary: "s", tags: [], url: `${SITE}/blog/area/tools`, path: "/blog/area/tools", langs: ["en"], createdAt: T, done: {} });
    const r = await admin(request(createApp()).get(`${A}/announce:area:tools:1/preview`));
    expect(r.status).toBe(200);
    expect(r.body.title).toContain("Tools");
    expect(r.body.issues.map((i: { code: string }) => i.code)).toContain("no-hebrew-translation");
    collections = [];
    expect((await admin(request(createApp()).get(`${A}/announce:area:tools:1/preview`))).status).toBe(404);
  });

  it("project: reads /projects/:slug; an unknown project is unpublished", async () => {
    store.set("announce:project:nope:first", { _id: "announce:project:nope:first", type: "announce", kind: "project", ref: "nope", title: "Nope", summary: "s", tags: [], url: `${SITE}/projects/nope`, path: "/projects/nope", langs: ["en", "he"], createdAt: T, done: {} });
    expect((await admin(request(createApp()).get(`${A}/announce:project:nope:first/preview`))).status).toBe(404);
  });

  it("note: reads a post's page like a post", async () => {
    posts = [{ _id: "post:hello", type: "post", slug: "hello", title: "Hello", subtitle: null, excerpt: "A summary", body: "b", status: "published", publishedAt: T, createdAt: T, updatedAt: T, tags: [], collection: "site", coverImage: null, readingMinutes: 1, seo: { title: null, description: null, canonical: null, noindex: false } }];
    store.set("announce:note:hello:1", { _id: "announce:note:hello:1", type: "announce", kind: "note", ref: "hello", title: "Hello", summary: "s", tags: [], url: `${SITE}/blog/hello`, path: "/blog/hello", langs: ["en"], createdAt: T, done: {} });
    const r = await admin(request(createApp()).get(`${A}/announce:note:hello:1/preview`));
    expect(r.status).toBe(200);
    expect(r.body.issues.map((i: { code: string }) => i.code)).toContain("no-hebrew-translation");
  });
});

describe("settings", () => {
  const rawSettings = { enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["x"], templates: { en: {}, he: {} } };

  it("an old document reads with defaults; a stale _rev is still 409; saves the new groups", async () => {
    store.set("settings:announce", { _id: "settings:announce", _rev: "1-a", type: "settings-announce", settings: rawSettings, updatedAt: T });
    const g = await admin(request(createApp()).get(`${A}/settings`));
    expect(g.body.settings).toMatchObject({ snippets: [], library: [], advanced: { utm: { enabled: false } } });
    const next = { ...g.body.settings, snippets: [{ id: "s1", name: "Tags", kind: "hashtags", text: "#a #b" }], advanced: { utm: { enabled: true, source: "news", mediumByChannel: { x: "tw" } } } };
    expect((await admin(request(createApp()).put(`${A}/settings`).send({ settings: next, _rev: "0-stale" }))).status).toBe(409);
    const ok = await admin(request(createApp()).put(`${A}/settings`).send({ settings: next, _rev: "1-a" }));
    expect(ok.status).toBe(200);
    expect(ok.body.settings.snippets).toHaveLength(1);
  });

  it("/api/settings never contains announce data", async () => {
    store.set("settings:announce", { _id: "settings:announce", _rev: "1-a", type: "settings-announce", settings: { ...rawSettings, snippets: [{ id: "s1", name: "SECRETNAME", kind: "cta", text: "SECRETTEXT" }], library: [{ id: "l1", name: "n", channel: "x", lang: "en", text: "SECRETLIB" }], advanced: { utm: { enabled: true, source: "secretsrc", mediumByChannel: {} } } }, updatedAt: T });
    const body = JSON.stringify((await request(createApp()).get("/api/settings")).body);
    for (const w of ["SECRETNAME", "SECRETTEXT", "SECRETLIB", "secretsrc", "snippets", "library", "mediumByChannel"]) expect(body).not.toContain(w);
  });
});
