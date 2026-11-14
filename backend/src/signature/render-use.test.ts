import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { attachments, type NewAttachment } from "../db/attachments.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS } from "../announce/schemas.js";
import { renderCampaignMail } from "../campaigns/render.js";
import { hashEmail } from "../audience/store.js";
import { resolveSignature } from "./resolve.js";

let docs: Map<string, Record<string, unknown>>;
let files: Map<string, Map<string, NewAttachment>>;
let revs = 0;

beforeEach(() => {
  docs = new Map();
  files = new Map();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no outbound request allowed"); }));
  (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
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
const draw = () => put("en", { kind: "strokes", alt: "Yehuda's signature", strokes });
const show = (s: Record<string, boolean>) => admin(request(createApp()).put(`${A}/show`).send({ show: s }));
const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.org" };
const mail = (lang: "en" | "he") =>
  renderCampaignMail({ subject: "S", bodyText: "Body", preheader: undefined, blocks: undefined } as never, { lang }, hashEmail("a@example.org"), sender);
const sigImgs = (html: string) => html.match(/<img [^>]*\/api\/signature\/[^>]*>/g) ?? [];

describe("resolveSignature: language, fallback and the switches", () => {
  it("is null while the use is off, even with a signature saved", async () => {
    await draw();
    expect(await resolveSignature("email", "en")).toBeNull();
    expect(await resolveSignature("posts", "en")).toBeNull();
  });
  it("answers in the reader's language, then the other language, then null", async () => {
    await show({ email: true, posts: true, cards: false });
    expect(await resolveSignature("email", "he")).toBeNull();
    await draw();
    expect(await resolveSignature("email", "he")).toMatchObject({ lang: "en", alt: "Yehuda's signature" });
    await put("he", { kind: "strokes", alt: "חתימה", strokes });
    expect(await resolveSignature("email", "he")).toMatchObject({ lang: "he", alt: "חתימה" });
    expect(await resolveSignature("email", "en")).toMatchObject({ lang: "en" });
  });
});

describe("the newsletter footer", () => {
  it("has no signature image by default (nothing public)", async () => {
    await draw();
    expect(sigImgs((await mail("en")).html)).toHaveLength(0);
  });
  it("shows a light and a dark 2x PNG from the site's own origin, with alt and width/height, before the footer", async () => {
    await draw();
    await show({ email: true, posts: false, cards: false });
    const m = await mail("en");
    const imgs = sigImgs(m.html);
    expect(imgs).toHaveLength(2);
    for (const i of imgs) {
      expect(i).toContain(`src="${env.SITE_URL}/api/signature/en/`);
      expect(i).toMatch(/alt="Yehuda(&#39;|')s signature"/);
      expect(i).toMatch(/ width="\d+"/);
      expect(i).toMatch(/ height="\d+"/);
    }
    /* Dark mail gets the light-ink file; the light mail the dark-ink one. */
    expect(imgs[0]).toContain("-email.png");
    expect(imgs[1]).toContain("-email-light.png");
    expect(m.html).toMatch(/\.sig-l\{display:none !important\}\.sig-d\{display:block !important\}/);
    expect(m.html.indexOf("/api/signature/")).toBeLessThan(m.html.indexOf("/unsubscribe"));
    expect(m.text).toContain("Yehuda's signature");
  });
  it("uses the other language's signature, and the plain footer when there is none", async () => {
    await show({ email: true, posts: false, cards: false });
    expect(sigImgs((await mail("he")).html)).toHaveLength(0);
    await draw();
    expect(sigImgs((await mail("he")).html)[0]).toContain("/api/signature/en/");
  });
  it("never stops a send when the store is down", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(new Error("couch down"));
    expect((await mail("en")).html).toContain("/unsubscribe");
  });
});

describe("GET /api/signature/:lang/current (the post ending)", () => {
  const cur = (l: string) => request(createApp()).get(`/api/signature/${l}/current`);
  it("404s while posts is off, and gives only the public facts when on", async () => {
    await draw();
    expect((await cur("en")).status).toBe(404);
    await show({ email: false, posts: true, cards: false });
    const r = await cur("he");
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(["alt", "format", "height", "src", "width"]);
    expect(r.body.src).toMatch(/^\/api\/signature\/en\/[0-9a-f]{16}\.svg$/);
    expect(r.headers["cache-control"]).toMatch(/max-age=300/);
    expect((await request(createApp()).get(r.body.src)).status).toBe(200);
  });
});
