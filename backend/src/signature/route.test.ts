import request from "supertest";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { attachments, type NewAttachment } from "../db/attachments.js";
import { env } from "../env.js";

let docs: Map<string, Record<string, unknown>>;
let files: Map<string, Map<string, NewAttachment>>;
let revs = 0;

beforeEach(() => {
  docs = new Map();
  files = new Map();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no outbound request allowed"); }));
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = docs.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const ex = docs.get(id);
    if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
    const rev = `${++revs + 1}-x`;
    docs.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as R;
  });
  vi.spyOn(couch, "del").mockImplementation(async (id: string) => {
    docs.delete(id);
    files.delete(id);
    return { ok: true };
  });
  vi.spyOn(attachments, "putWith").mockImplementation(async (id, doc, list) => {
    const ex = docs.get(id);
    if (ex ? (doc as { _rev?: string })._rev !== ex._rev : (doc as { _rev?: string })._rev !== undefined) throw new CouchError(409, "409");
    const rev = `${++revs + 1}-x`;
    docs.set(id, { ...structuredClone(doc), _rev: rev });
    files.set(id, new Map(list.map((f) => [f.name, f])));
    return { rev };
  });
  vi.spyOn(attachments, "get").mockImplementation(async (id, name) => {
    const f = files.get(id)?.get(name);
    return f ? { data: f.data, contentType: f.contentType } : null;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const A = "/api/admin/signature";
const strokes = { w: 600, h: 240, pen: 4, strokes: [[[10, 100], [40, 60], [90, 120], [140, 80]], [[20, 150], [200, 150]]] };
const put = (lang: string, body: unknown) => admin(request(createApp()).put(`${A}/${lang}`).send(body as object));
const draw = (over: Record<string, unknown> = {}) => put("en", { kind: "strokes", alt: "Yehuda's signature", strokes, ...over });
const pngB64 = async () =>
  (await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 200, height: 8, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } }, left: 50, top: 40 }])
    .png()
    .toBuffer()).toString("base64");
const showAll = (show: Record<string, boolean>) => admin(request(createApp()).put(`${A}/show`).send({ show }));

describe("the admin gate", () => {
  it("refuses every route without it", async () => {
    for (const r of [request(createApp()).get(A), request(createApp()).put(`${A}/en`).send({}), request(createApp()).delete(`${A}/en`), request(createApp()).put(`${A}/show`).send({})]) {
      expect([401, 403]).toContain((await r).status);
    }
  });
});

describe("GET /api/admin/signature", () => {
  it("starts empty with every use switched off", async () => {
    const r = await admin(request(createApp()).get(A));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, show: { email: false, posts: false, cards: false }, slots: { en: null, he: null } });
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("PUT /api/admin/signature/:lang", () => {
  it("makes the SVG from the strokes, the email PNGs from the SVG, and keeps the strokes to edit again", async () => {
    const r = await draw();
    expect(r.status).toBe(200);
    expect(r.body.slot).toMatchObject({ lang: "en", mode: "drawn", format: "svg", light: true, strokes: { pen: 4 } });
    expect(r.body.slot.urls.web).toMatch(/^\/api\/signature\/en\/[0-9a-f]{16}\.svg$/);
    const f = files.get("signature:en")!;
    expect([...f.keys()].sort()).toEqual(["email-light.png", "email.png", "web.svg"]);
    expect(f.get("web.svg")!.data.toString()).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox=/);
    expect(f.get("email.png")!.contentType).toBe("image/png");
    expect((await sharp(f.get("email.png")!.data).metadata()).hasAlpha).toBe(true);
  });

  it("keeps Hebrew and English apart", async () => {
    await draw();
    await put("he", { kind: "strokes", alt: "חתימה", strokes });
    const r = await admin(request(createApp()).get(A));
    expect(r.body.slots.en.alt).toBe("Yehuda's signature");
    expect(r.body.slots.he.alt).toBe("חתימה");
  });

  it("takes an uploaded SVG rebuilt from the allow-list, recoloured to the ink", async () => {
    const r = await put("en", { kind: "svg", alt: "sig", recolor: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><title>x</title><path d="M5 20L95 20" stroke="#ff0000" stroke-width="3" fill="none" inkscape:foo="1" xmlns:inkscape="http://www.inkscape.org"/></svg>' });
    expect(r.status).toBe(200);
    const svg = files.get("signature:en")!.get("web.svg")!.data.toString();
    expect(svg).toContain("currentColor");
    expect(svg).not.toMatch(/ff0000|title|inkscape/);
    expect(r.body.slot).toMatchObject({ mode: "uploaded", format: "svg" });
  });

  it("refuses a hostile SVG with a reason, and stores nothing", async () => {
    const r = await put("en", { kind: "svg", alt: "sig", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0L9 9"/></svg>' });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/script/);
    expect(docs.has("signature:en")).toBe(false);
  });

  it("takes an uploaded PNG and serves it as a PNG", async () => {
    const r = await put("he", { kind: "png", alt: "sig", png: await pngB64() });
    expect(r.status).toBe(200);
    expect(r.body.slot).toMatchObject({ mode: "uploaded", format: "png" });
    expect([...files.get("signature:he")!.keys()].sort()).toEqual(["email-light.png", "email.png", "web.png"]);
  });

  it.each([
    ["bytes that are not a PNG", { kind: "png", alt: "x", png: Buffer.from("GIF89a-not-a-png-at-all").toString("base64") }],
    ["an unknown key", { kind: "strokes", alt: "x", strokes, extra: 1 }],
    ["no alt text", { kind: "strokes", alt: "  ", strokes }],
    ["an ink that is not a colour", { kind: "strokes", alt: "x", strokes, ink: "red; background:url(x)" }],
    ["a kind it does not know", { kind: "image", alt: "x" }],
    ["base64 with markup in it", { kind: "png", alt: "x", png: "<script>alert(1)</script>AAAA" }],
  ])("refuses %s", async (_what, body) => {
    const r = await put("en", body);
    expect([400, 415, 422]).toContain(r.status);
    expect(docs.has("signature:en")).toBe(false);
  });

  it("404s a language it does not have", async () => {
    expect((await put("fr", { kind: "strokes", alt: "x", strokes })).status).toBe(404);
  });

  it("does not put the alt text or the drawing in the audit record", async () => {
    const r = await draw();
    expect(r.status).toBe(200);
    // The audit middleware reads res.locals.audit; the response must not echo secrets elsewhere.
    expect(JSON.stringify(r.headers)).not.toMatch(/Yehuda/);
  });
});

describe("GET /api/admin/signature/:lang/file/:name", () => {
  it("lets the owner see a saved slot while every public use is off", async () => {
    await draw();
    const r = await admin(request(createApp()).get(`${A}/en/file/web`));
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/svg/);
    expect(r.headers["content-security-policy"]).toMatch(/default-src 'none'/);
    expect((await admin(request(createApp()).get(`${A}/en/file/email-light`))).headers["content-type"]).toBe("image/png");
    expect((await admin(request(createApp()).get(`${A}/en/file/strokes`))).status).toBe(404);
    expect((await request(createApp()).get(`${A}/en/file/web`)).status).toBeGreaterThanOrEqual(401);
  });
});

describe("PUT /api/admin/signature/show and DELETE", () => {
  it("saves the three switches, strictly", async () => {
    expect((await showAll({ email: true, posts: false, cards: false })).body.show).toEqual({ email: true, posts: false, cards: false });
    expect((await showAll({ email: true, posts: false, cards: false, sms: true })).status).toBe(400);
    expect((await showAll({ email: "yes" as never, posts: false, cards: false })).status).toBe(400);
  });

  it("removes one language and its files", async () => {
    await draw();
    const r = await admin(request(createApp()).delete(`${A}/en`));
    expect(r.status).toBe(200);
    expect(docs.has("signature:en")).toBe(false);
    expect((await admin(request(createApp()).delete(`${A}/en`))).status).toBe(404);
  });
});

describe("GET /api/signature/:lang/:file (public)", () => {
  const publicGet = (path: string) => request(createApp()).get(`/api/signature/${path}`);
  const hashOf = async () => ((await draw()).body.slot.hash as string);

  it("serves nothing until a use is switched on", async () => {
    const h = await hashOf();
    expect((await publicGet(`en/${h}.svg`)).status).toBe(404);
    expect((await publicGet(`en/${h}-email.png`)).status).toBe(404);
  });

  it("serves the SVG with a locked-down CSP once a website use is on, and the email PNG once email is", async () => {
    const h = await hashOf();
    await showAll({ email: false, posts: true, cards: false });
    const svg = await publicGet(`en/${h}.svg`);
    expect(svg.status).toBe(200);
    expect(svg.headers["content-type"]).toMatch(/image\/svg\+xml/);
    expect(svg.headers["x-content-type-options"]).toBe("nosniff");
    expect(svg.headers["content-security-policy"]).toMatch(/default-src 'none'/);
    expect(svg.headers["cache-control"]).toMatch(/immutable/);
    expect((await publicGet(`en/${h}-email.png`)).status).toBe(404);
    await showAll({ email: true, posts: true, cards: false });
    const png = await publicGet(`en/${h}-email.png`);
    expect(png.status).toBe(200);
    expect(png.headers["content-type"]).toBe("image/png");
    expect((await publicGet(`en/${h}-email-light.png`)).status).toBe(200);
  });

  it("sends a stale hash to the current file, so an old email still shows", async () => {
    await showAll({ email: true, posts: true, cards: false });
    const h = await hashOf();
    const r = await publicGet(`en/0123456789abcdef-email.png`);
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(`/api/signature/en/${h}-email.png`);
  });

  it("never exposes the settings or anything that is not a rendered file", async () => {
    await draw();
    await showAll({ email: true, posts: true, cards: true });
    for (const p of ["en/settings", "en/strokes.json", "en/../show", "en/web.svg", "fr/0123456789abcdef.svg", "en/0123456789abcdef.exe"]) {
      expect([404, 400]).toContain((await publicGet(p)).status);
    }
    expect(JSON.stringify((await publicGet("en/nothing")).body)).not.toMatch(/strokes|alt|show/);
  });
});
