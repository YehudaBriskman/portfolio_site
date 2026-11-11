import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { analyse, DESCRIPTION_MAX, TITLE_MAX } from "./preview.js";

const T = "2026-11-01T10:00:00.000Z";
const note = (over: Record<string, unknown> = {}) => ({
  _id: "post:hello", type: "post", slug: "hello", title: "Hello", subtitle: null, excerpt: "A summary", body: "b", status: "published",
  publishedAt: T, createdAt: T, updatedAt: T, tags: [], collection: "site", coverImage: null, readingMinutes: 1,
  seo: { title: null, description: null, canonical: null, noindex: false }, he: { title: "שלום", excerpt: "תקציר", body: "גוף" }, ...over,
});
const event = (over: Record<string, unknown> = {}) => ({
  _id: "announce:post:hello:1", type: "announce", kind: "post", ref: "hello", title: "Hello", summary: "A summary", tags: [],
  url: `${env.SITE_URL}/blog/hello`, path: "/blog/hello", langs: ["en", "he"], createdAt: T, done: {}, ...over,
});

let docs: Record<string, unknown>;
let posts: unknown[];
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  docs = { "announce:post:hello:1": event() };
  posts = [note()];
  fetchSpy = vi.fn(async () => { throw new Error("no outbound request allowed"); });
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    if (!docs[id]) throw new CouchError(404, "404");
    return structuredClone(docs[id]) as R;
  });
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const s = (q as { selector: { type: string; slug?: string } }).selector;
    return { docs: (s.type === "post" ? posts.filter((p) => !s.slug || (p as { slug: string }).slug === s.slug) : []) as never[] };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const get = (id: string, q = "") => admin(request(createApp()).get(`/api/admin/announce/${id}/preview${q}`));

describe("GET /api/admin/announce/:id/preview", () => {
  it("401/403 without the admin gate", async () => {
    expect([401, 403]).toContain((await request(createApp()).get("/api/admin/announce/announce:post:hello:1/preview")).status);
  });

  it("404 for an event that does not exist", async () => {
    expect((await get("announce:nope")).status).toBe(404);
  });

  it("returns the head the page writes, and makes no outbound request", async () => {
    const res = await get("announce:post:hello:1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, lang: "en", url: `${env.SITE_URL}/blog/hello`, imageWidth: 1200, imageHeight: 630 });
    expect(res.body.title).toContain("Hello");
    expect(res.body.image).toMatch(/^https?:\/\//);
    expect(res.body.siteName).not.toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the Hebrew head for ?lang=he, and 404s when the event has no Hebrew", async () => {
    const he = await get("announce:post:hello:1", "?lang=he");
    expect(he.status).toBe(200);
    expect(he.body.lang).toBe("he");
    expect(he.body.title).toContain("שלום");
    docs["announce:post:hello:1"] = event({ langs: ["en"] });
    expect((await get("announce:post:hello:1", "?lang=he")).status).toBe(404);
  });

  it("404 when the post is no longer published, 422 for an event with no page", async () => {
    posts = [];
    expect((await get("announce:post:hello:1")).status).toBe(404);
    docs["announce:post:hello:1"] = event({ kind: "release", path: undefined, url: "https://github.com/x/y/releases/tag/v1" });
    expect((await get("announce:post:hello:1")).status).toBe(422);
  });

  it("never dispatches a path that is not a plain post path", async () => {
    docs["announce:post:hello:1"] = event({ path: "/blog/../../api/admin/posts" });
    expect((await get("announce:post:hello:1")).status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("analyse", () => {
  const ok = [
    `<meta property="og:title" content="T &amp; U" />`,
    `<meta property="og:description" content="D" />`,
    `<meta property="og:image" content="https://x.test/i.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
  ];
  it("is clean for a complete head, and decodes entities", () => {
    const p = analyse(ok, "en");
    expect(p.issues).toEqual([]);
    expect(p.title).toBe("T & U");
  });
  it("flags missing fields", () => {
    expect(analyse([], "en").issues.map((i) => i.code)).toEqual(["missing-title", "missing-description", "image-missing"]);
  });
  it("flags long text and a wrong image size", () => {
    const head = [
      `<meta property="og:title" content="${"a".repeat(TITLE_MAX + 1)}" />`,
      `<meta property="og:description" content="${"a".repeat(DESCRIPTION_MAX + 1)}" />`,
      `<meta property="og:image" content="https://x.test/i.png" />`,
      `<meta property="og:image:width" content="800" />`,
      `<meta property="og:image:height" content="800" />`,
    ];
    expect(analyse(head, "en").issues.map((i) => i.code)).toEqual(["title-too-long", "description-too-long", "image-size"]);
  });
});
