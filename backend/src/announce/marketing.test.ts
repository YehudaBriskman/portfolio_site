import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { announceOnWrite } from "./hooks.js";
import { renderKit } from "./kit.js";
import { analyse, previewPathOf } from "./preview.js";
import { AnnounceSettingsSchema, DEFAULT_ANNOUNCE_SETTINGS, type AnnounceEvent } from "./schemas.js";

/* Marketing backend: every event kind, custom announcements, drafts, readiness, settings. */

let store: Map<string, Record<string, unknown>>;
let revs = 0;
const T = "2026-11-01T10:00:00.000Z";
const SITE = env.SITE_URL;

beforeEach(() => {
  store = new Map();
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
  vi.spyOn(couch, "find").mockImplementation(async <R>(q: unknown) => {
    const sel = (q as { selector: { _id: { $gt: string; $lt: string } } }).selector._id;
    const docs = [...store.entries()].filter(([id]) => id > sel.$gt && id < sel.$lt).map(([, d]) => structuredClone(d));
    return { docs } as { docs: R[] };
  });
});
afterEach(() => vi.restoreAllMocks());

const events = () => [...store.keys()].filter((k) => k.startsWith("announce:"));
const flush = () => new Promise((r) => setTimeout(r, 30));

/* A stand-in for an admin route: it only reports the audit the real routes set. */
function writeApp() {
  const app = express();
  app.use(express.json());
  app.post("/w", announceOnWrite, (req, res) => {
    res.locals.audit = req.body;
    res.json({ ok: true });
  });
  return app;
}
async function write(audit: Record<string, unknown>) {
  const res = await request(writeApp()).post("/w").send(audit);
  await flush();
  return res;
}

const area = (status: string, extra: Record<string, unknown> = {}) => ({
  _id: "collection:tools", type: "collection", slug: "tools", title: "Tools", tagline: "Things I use", description: "", status, kind: "site", createdAt: T,
  he: { title: "כלים", tagline: "דברים שאני משתמש בהם", description: "" }, ...extra,
});
const project = (slug: string) => ({ slug, title: slug.toUpperCase(), fact: { en: "A fact", he: "עובדה" }, description: { en: "d" }, tech: ["Go"] });
const content = (slugs: string[]) => ({ _id: "content:projects", type: "content", key: "projects", published: { items: slugs.map(project) } });

describe("hooks for the other kinds", () => {
  it("an area going live is one event, deduped on a republish", async () => {
    await write({ before: null, after: area("published") });
    expect(events()).toHaveLength(1);
    expect(store.get(events()[0])).toMatchObject({ kind: "area", ref: "tools", path: "/blog/area/tools", langs: ["en", "he"], titleHe: "כלים" });
    await write({ before: area("hidden"), after: area("published") });
    expect(events()).toHaveLength(1);
  });

  it("an area that stays published, or is saved hidden, is no event", async () => {
    await write({ before: area("published"), after: area("published", { title: "Tools 2" }) });
    await write({ before: null, after: area("hidden") });
    expect(events()).toHaveLength(0);
  });

  it("a project newly in the published list is one event, deduped by slug", async () => {
    await write({ before: content(["a"]), after: content(["a", "b"]) });
    expect(events()).toEqual(["announce:project:b:first"]);
    expect(store.get(events()[0])).toMatchObject({ kind: "project", path: "/projects/b", summary: "A fact", summaryHe: "עובדה", langs: ["en", "he"] });
    await write({ before: content(["a"]), after: content(["a", "b"]) });
    expect(events()).toHaveLength(1);
  });

  it("an unchanged project list, a first write, or another content key is no event", async () => {
    await write({ before: content(["a"]), after: content(["a"]) });
    await write({ before: null, after: content(["a", "b"]) });
    await write({ before: content(["a"]), after: { ...content(["a", "b"]), key: "story" } });
    expect(events()).toHaveLength(0);
  });
});

describe("kit", () => {
  const ev = (kind: AnnounceEvent["kind"], over: Partial<AnnounceEvent> = {}): AnnounceEvent => ({
    _id: `announce:${kind}:x:1`, type: "announce", kind, ref: "x", title: "Title", titleHe: "כותרת", summary: "Sum", summaryHe: "תקציר", tags: [],
    url: `${SITE}/p`, path: "/p", langs: ["en", "he"], createdAt: T, done: {}, ...over,
  });

  it.each(["post", "release", "note", "project", "area", "story", "home", "custom"] as const)("has a default template for %s in both languages", (kind) => {
    const kit = renderKit(ev(kind, { version: "v1" }), DEFAULT_ANNOUNCE_SETTINGS);
    for (const lang of ["en", "he"] as const) {
      for (const ch of DEFAULT_ANNOUNCE_SETTINGS.channels) {
        const text = kit[lang][ch]!.text;
        expect(text, `${kind} ${lang} ${ch}`).not.toBe("");
        expect(text).not.toMatch(/\{(title|summary|url|tags|version|site)\}/);
      }
    }
    expect(kit.he.linkedin!.text).toMatch(/[֐-׿]/);
  });

  it("a draft wins over the template, verbatim and with no signature", () => {
    const s = { ...DEFAULT_ANNOUNCE_SETTINGS, signature: "-- me" };
    const kit = renderKit(ev("project", { drafts: { en: { x: "my own words" } } }), s);
    expect(kit.en.x).toMatchObject({ text: "my own words", draft: true });
    expect(kit.en.linkedin!.draft).toBe(false);
    expect(kit.en.linkedin!.text).toContain("-- me");
  });

  it("shows a language that only has a draft, and tags links only when utm is on", () => {
    const e = ev("custom", { langs: ["en"], drafts: { he: { x: "שלום" } } });
    expect(renderKit(e, DEFAULT_ANNOUNCE_SETTINGS).he.x!.text).toBe("שלום");
    expect(renderKit(e, DEFAULT_ANNOUNCE_SETTINGS).en.x!.text).not.toContain("utm_");
    const on = { ...DEFAULT_ANNOUNCE_SETTINGS, advanced: { utm: { enabled: true, source: "news", mediumByChannel: { x: "tw" } } } };
    expect(renderKit(ev("post"), on).en.x!.text).toContain("utm_source=news&utm_medium=tw");
    expect(renderKit(ev("post", { url: "https://example.org/a", path: undefined }), on).en.x!.text).not.toContain("utm_");
  });
});

describe("preview paths and issues", () => {
  const e = (kind: AnnounceEvent["kind"], ref: string, path?: string) => ({ kind, ref, path }) as AnnounceEvent;
  it("derives the page per kind from fixed shapes", () => {
    expect(previewPathOf(e("post", "a", "/blog/a"))).toBe("/blog/a");
    expect(previewPathOf(e("note", "a", "/blog/a"))).toBe("/blog/a");
    expect(previewPathOf(e("project", "windom"))).toBe("/projects/windom");
    expect(previewPathOf(e("area", "tools"))).toBe("/blog/area/tools");
    expect(previewPathOf(e("story", "story"))).toBe("/story");
    expect(previewPathOf(e("home", "home"))).toBe("/");
    expect(previewPathOf(e("custom", "custom"))).toBeNull();
    expect(previewPathOf(e("project", "../x"))).toBeNull();
    expect(previewPathOf(e("post", "a", "/blog/../admin"))).toBeNull();
  });

  it("uses the contract's issue codes", () => {
    const head = [`<meta property="og:title" content="${"t".repeat(80)}">`, `<meta property="og:description" content="${"d".repeat(200)}">`, `<meta property="og:image" content="${SITE}/i.png">`];
    expect(analyse(head, "en").issues.map((i) => i.code)).toEqual(["title-long", "description-long", "image-size"]);
    expect(analyse([], "en").issues.map((i) => i.code)).toEqual(["title-missing", "description-missing", "image-missing"]);
  });
});

describe("settings", () => {
  it("an old document parses with defaults for the new groups", () => {
    const old = { enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["x"], templates: { en: {}, he: {} } };
    const p = AnnounceSettingsSchema.parse(old);
    expect(p.snippets).toEqual([]);
    expect(p.library).toEqual([]);
    expect(p.advanced.utm).toEqual({ enabled: false, source: "announce", mediumByChannel: {} });
  });

  it("is strict about the new groups", () => {
    const base = { ...DEFAULT_ANNOUNCE_SETTINGS };
    const bad = (over: Record<string, unknown>) => expect(AnnounceSettingsSchema.safeParse({ ...base, ...over }).success).toBe(false);
    bad({ snippets: [{ id: "a", name: "n", kind: "other", text: "t" }] });
    bad({ snippets: [{ id: "a", name: "n", kind: "cta", text: "t".repeat(1001) }] });
    bad({ snippets: Array.from({ length: 51 }, (_, i) => ({ id: `s${i}`, name: "n", kind: "cta", text: "t" })) });
    bad({ library: [{ id: "a", name: "n", channel: "tiktok", lang: "en", text: "t" }] });
    bad({ library: [{ id: "a", name: "n", channel: "x", lang: "fr", text: "t" }] });
    bad({ library: [{ id: "a", name: "n", channel: "x", lang: "en", text: "t".repeat(2001) }] });
    bad({ advanced: { utm: { enabled: true, source: "a b", mediumByChannel: {} } } });
    bad({ advanced: { utm: { enabled: true, source: "a", mediumByChannel: {}, extra: 1 }, other: 1 } });
    expect(AnnounceSettingsSchema.safeParse({ ...base, snippets: [{ id: "a", name: "n", kind: "hashtags", text: "#a" }], library: [{ id: "b", name: "n", channel: "x", lang: "he", text: "t" }] }).success).toBe(true);
  });
});
