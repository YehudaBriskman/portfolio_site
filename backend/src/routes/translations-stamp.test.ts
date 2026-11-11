import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { CONTENT_SEED } from "../content/seed.js";
import { fp } from "../schemas/i18n.js";
import type { ContentBundle } from "../schemas/site-content.js";
import { backfillDoc } from "../services/he-backfill.js";
import { attachments } from "../db/attachments.js";

/*
 * Fingerprints stamped on save, the "still correct" acknowledgement and the
 * backfill (#303). CouchDB is an in-memory map with its two behaviours that
 * matter: a PUT naming a stale revision is 409, a missing id is 404.
 */

const NOW = "2026-11-03T08:00:00.000Z";
type Doc = Record<string, unknown> & { _id: string; _rev?: string };

let store: Map<string, Doc>;
let revs = 0;

beforeEach(() => {
  store = new Map();
  vi.spyOn(couch, "get").mockImplementation(async <T>(id: string) => {
    const doc = store.get(id);
    if (!doc) throw new CouchError(404, "couch 404");
    return structuredClone(doc) as T;
  });
  vi.spyOn(couch, "put").mockImplementation(async <T>(id: string, body: unknown) => {
    const doc = body as Doc;
    const existing = store.get(id);
    if (existing ? doc._rev !== existing._rev : doc._rev !== undefined) throw new CouchError(409, "couch 409");
    const rev = `${++revs + 1}-x`;
    store.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as T;
  });
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => ({
    docs: [...store.values()].filter((d) => d.type === (q as { selector: { type: string } }).selector.type),
  }));
  vi.spyOn(couch, "append").mockResolvedValue(undefined as never);
});

afterEach(() => vi.restoreAllMocks());

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

const app = () => createApp();
const seed = () => structuredClone(CONTENT_SEED) as ContentBundle;

function content(over: Record<string, unknown> = {}) {
  return {
    title: "A note",
    subtitle: null,
    excerpt: "The lede.",
    body: "The body.",
    tags: [],
    collection: "site",
    coverImage: null,
    links: [],
    featured: null,
    publishedAt: null,
    seo: { title: null, description: null, canonical: null, noindex: false },
    he: null,
    ...over,
  };
}

const HE = { title: "רשימה", subtitle: "", excerpt: "הפתיח.", body: "הגוף." };

async function publish(slug: string, body: Record<string, unknown>) {
  const rev = store.get(`post:${slug}`)?._rev;
  return asAdmin(request(app()).post(`/api/admin/posts/${slug}/publish`)).send({ ...body, _rev: rev });
}

async function saveDraft(slug: string, body: Record<string, unknown>) {
  const rev = store.get(`post:${slug}`)?._rev;
  return asAdmin(request(app()).put(`/api/admin/posts/${slug}/draft`)).send({ ...body, _rev: rev });
}

async function statusOf(type: string, id: string) {
  const res = await asAdmin(request(app()).get(`/api/admin/translations?type=${type}`));
  return res.body.items.find((i: { id: string }) => i.id === id) as { status: string; units: { path: string; status: string }[] };
}

describe("a note's Hebrew is stamped on save (#303)", () => {
  it("stamps new Hebrew with the English beside it, and the body's English base", async () => {
    const res = await publish("a-note", content({ he: HE }));
    expect(res.status).toBe(200);
    const doc = store.get("post:a-note")!;
    expect(doc.heMeta).toEqual({
      src: { title: fp("A note"), excerpt: fp("The lede."), body: fp("The body.") },
      bodyBase: "The body.",
    });
    expect((await statusOf("post", "a-note")).status).toBe("translated");
  });

  it("ignores a fingerprint the client sends", async () => {
    await publish("a-note", content({ he: HE, heMeta: { src: { title: "000000000000" }, bodyBase: "lies" } }));
    expect((store.get("post:a-note")!.heMeta as { src: { title: string } }).src.title).toBe(fp("A note"));
  });

  it("keeps the fingerprint when only the English changes, so the Hebrew turns stale", async () => {
    await publish("a-note", content({ he: HE }));
    /* A draft that edits the English and leaves the Hebrew alone... */
    await saveDraft("a-note", content({ title: "A note, renamed", he: HE }));
    const draft = store.get("post:a-note")!.draft as { heMeta: { src: Record<string, string> } };
    expect(draft.heMeta.src.title).toBe(fp("A note"));
    /* ...and its publish: the Hebrew title now translates the old English. */
    await publish("a-note", content({ title: "A note, renamed", he: HE }));
    const s = await statusOf("post", "a-note");
    expect(s.status).toBe("stale");
    expect(s.units.find((u) => u.path === "title")!.status).toBe("stale");
    expect(s.units.find((u) => u.path === "body")!.status).toBe("translated");
  });

  it("restamps when the Hebrew changes too", async () => {
    await publish("a-note", content({ he: HE }));
    await publish("a-note", content({ title: "A note, renamed", he: { ...HE, title: "רשימה, בשם חדש" } }));
    expect((await statusOf("post", "a-note")).status).toBe("translated");
  });

  it("does not restamp for whitespace around the Hebrew", async () => {
    await publish("a-note", content({ he: HE }));
    await publish("a-note", content({ body: "A new body.", he: { ...HE, body: " הגוף. " } }));
    const meta = store.get("post:a-note")!.heMeta as { src: Record<string, string>; bodyBase: string };
    expect(meta.src.body).toBe(fp("The body."));
    expect(meta.bodyBase).toBe("The body.");
  });

  it("carries the fingerprints through the whole-note write, which does not touch the Hebrew", async () => {
    await publish("a-note", content({ he: HE }));
    const before = store.get("post:a-note")!;
    const res = await asAdmin(request(app()).put("/api/admin/posts/a-note")).send({
      title: "A note",
      excerpt: "The lede.",
      body: "The body.",
      status: "published",
      _rev: before._rev,
    });
    expect(res.status).toBe(200);
    expect(store.get("post:a-note")!.heMeta).toEqual(before.heMeta);
  });

  it("never sends the fingerprints to a reader", async () => {
    await publish("a-note", content({ he: HE }));
    const res = await request(app()).get("/api/blog/posts/a-note");
    expect(res.status).toBe(200);
    expect(res.body.post.he.title).toBe("רשימה");
    expect(JSON.stringify(res.body)).not.toMatch(/heMeta|bodyBase|heSrc/);
  });
});

describe("an area's Hebrew is stamped on save (#303)", () => {
  async function saveArea(over: Record<string, unknown>) {
    const rev = store.get("collection:bothy")?._rev;
    return asAdmin(request(app()).put("/api/admin/collections/bothy")).send({ title: "Bothy", tagline: "A dev box", _rev: rev, ...over });
  }

  it("stamps the fields sent, and keeps them across a save that does not send Hebrew", async () => {
    expect((await saveArea({ he: { title: "Bothy", tagline: "שרת פיתוח", description: null } })).status).toBe(200);
    expect(store.get("collection:bothy")!.heMeta).toEqual({ src: { title: fp("Bothy"), tagline: fp("A dev box") } });
    await saveArea({ tagline: "A dev box, at home" });
    expect(store.get("collection:bothy")!.heMeta).toEqual({ src: { title: fp("Bothy"), tagline: fp("A dev box") } });
    expect((await statusOf("area", "bothy")).status).toBe("stale");
  });

  it("keeps each link label as Text, stamped, and gives the public a string label and the Hebrew beside it (#306)", async () => {
    const links = [
      { label: { en: "Source", he: "קוד מקור" }, url: "https://example.com/src" },
      { label: "Docs", url: "https://example.com/docs" },
    ];
    expect((await saveArea({ links })).status).toBe(200);
    const stored = store.get("collection:bothy")!.links as { label: { en: string; he?: string; heSrc?: string } }[];
    expect(stored[0].label).toEqual({ en: "Source", he: "קוד מקור", heSrc: fp("Source") });
    expect(stored[1].label).toEqual({ en: "Docs" });
    let units = (await statusOf("area", "bothy")).units;
    expect(units.find((u) => u.path === "links.0.label")?.status).toBe("translated");
    expect(units.find((u) => u.path === "links.1.label")?.status).toBe("missing");

    /* A client that knows only English (the MCP tools) sends strings: the Hebrew stays. */
    await saveArea({ links: [{ label: "Source", url: "https://example.com/src" }, links[1]] });
    expect((store.get("collection:bothy")!.links as typeof stored)[0].label.he).toBe("קוד מקור");

    /* The English changes: stale, until "still correct". */
    await saveArea({ links: [{ label: { en: "Source code", he: "קוד מקור" }, url: "https://example.com/src" }, links[1]] });
    units = (await statusOf("area", "bothy")).units;
    expect(units.find((u) => u.path === "links.0.label")?.status).toBe("stale");
    const ack = await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "area", id: "bothy", path: "links.0.label", rev: store.get("collection:bothy")!._rev });
    expect(ack.status).toBe(200);
    expect((await statusOf("area", "bothy")).units.find((u) => u.path === "links.0.label")?.status).toBe("translated");

    const pub = await request(app()).get("/api/blog/collections/bothy");
    expect(pub.body.collection.links[0]).toEqual({ label: "Source code", url: "https://example.com/src" });
    expect(pub.body.collection.he["links.0.label"]).toBe("קוד מקור");
    expect(JSON.stringify(pub.body)).not.toContain("heSrc");
  });
});

describe("structured copy is stamped on save (#303)", () => {
  function storeSiteCopy(published: unknown, draft: unknown = null) {
    store.set("content:site-copy", {
      _id: "content:site-copy",
      _rev: "1-sc",
      type: "content",
      key: "site-copy",
      published,
      draft,
      createdAt: NOW,
      updatedAt: NOW,
      publishedAt: NOW,
      source: "seed",
    });
  }

  it("stamps new Hebrew, keeps an unchanged one's, and never publishes the fingerprints", async () => {
    const s = seed().siteCopy;
    storeSiteCopy(s);
    const data = structuredClone(s);
    data.hero.title = { en: data.hero.title.en, he: "כותרת חדשה" };
    data.hero.fact = { en: "A new fact.", he: data.hero.fact.he };
    const res = await asAdmin(request(app()).post("/api/admin/content/site-copy/publish")).send({ data, _rev: "1-sc" });
    expect(res.status).toBe(200);
    const published = store.get("content:site-copy")!.published as ContentBundle["siteCopy"];
    expect((published.hero.title as { heSrc?: string }).heSrc).toBe(fp(data.hero.title.en));
    /* Unchanged Hebrew from before #303 keeps no fingerprint: still unverified, not falsely current. */
    expect((published.hero.fact as { heSrc?: string }).heSrc).toBeUndefined();

    const pub = await request(app()).get("/api/content");
    expect(JSON.stringify(pub.body)).not.toContain("heSrc");
    const one = await request(app()).get("/api/content/site-copy");
    expect(JSON.stringify(one.body)).not.toContain("heSrc");
  });

  it("follows a project by its slug, not its position, when the list is reordered", async () => {
    const p = seed().projects;
    const first = p.items[0];
    first.fact = { en: first.fact.en, he: "עובדה.", heSrc: fp(first.fact.en) } as typeof first.fact;
    store.set("content:projects", { _id: "content:projects", _rev: "1-p", type: "content", key: "projects", published: p, draft: null });
    const data = structuredClone(p);
    data.items.reverse();
    const moved = data.items.find((x) => x.slug === first.slug)!;
    moved.fact = { en: "Edited English.", he: "עובדה." };
    const res = await asAdmin(request(app()).put("/api/admin/content/projects/draft")).send({ data, _rev: "1-p" });
    expect(res.status).toBe(200);
    const draft = store.get("content:projects")!.draft as ContentBundle["projects"];
    expect((draft.items.find((x) => x.slug === first.slug)!.fact as { heSrc?: string }).heSrc).toBe(fp(first.fact.en));
  });
});

describe("POST /api/admin/translations/ack (#303)", () => {
  it("restamps one stale unit of a note to today's English, and its draft when it matches", async () => {
    await publish("a-note", content({ he: HE }));
    await publish("a-note", content({ title: "A note, typo fixed", he: HE }));
    await saveDraft("a-note", content({ title: "A note, typo fixed", he: HE, excerpt: "A newer lede." }));
    expect((await statusOf("post", "a-note")).status).toBe("stale");

    const rev = store.get("post:a-note")!._rev;
    const res = await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "post", id: "a-note", path: "title", rev });
    expect(res.status).toBe(200);
    expect(res.body.rev).toBe(store.get("post:a-note")!._rev);
    expect((await statusOf("post", "a-note")).status).toBe("translated");
    const doc = store.get("post:a-note")!;
    expect((doc.draft as { heMeta: { src: Record<string, string> } }).heMeta.src.title).toBe(fp("A note, typo fixed"));
    /* No word changed. */
    expect((doc.he as { title: string }).title).toBe("רשימה");
  });

  it("is 409 on a revision the owner did not see, 404 on an unknown unit, 400 with no Hebrew", async () => {
    await publish("a-note", content({ he: { ...HE, excerpt: "" } }));
    const rev = store.get("post:a-note")!._rev;
    const ack = (body: Record<string, unknown>) => asAdmin(request(app()).post("/api/admin/translations/ack")).send(body);
    expect((await ack({ type: "post", id: "a-note", path: "title", rev: "0-old" })).status).toBe(409);
    expect((await ack({ type: "post", id: "a-note", path: "tags", rev })).status).toBe(404);
    expect((await ack({ type: "post", id: "nope", path: "title", rev })).status).toBe(404);
    expect((await ack({ type: "post", id: "a-note", path: "excerpt", rev })).status).toBe(400);
    expect((await ack({ type: "post", id: "a-note" })).status).toBe(400);
  });

  it("restamps a Text inside a content document by item and path", async () => {
    const p = seed().projects;
    const target = p.items[1];
    target.description = { en: target.description.en, he: "תיאור.", heSrc: fp("Older English.") } as typeof target.description;
    store.set("content:projects", { _id: "content:projects", _rev: "1-p", type: "content", key: "projects", published: p, draft: structuredClone(p) });
    expect((await statusOf("project", target.slug)).units.find((u) => u.path === "description")!.status).toBe("stale");

    const res = await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "project", id: target.slug, path: "description", rev: "1-p" });
    expect(res.status).toBe(200);
    expect((await statusOf("project", target.slug)).units.find((u) => u.path === "description")!.status).toBe("translated");
    const draft = store.get("content:projects")!.draft as ContentBundle["projects"];
    expect((draft.items[1].description as { heSrc?: string }).heSrc).toBe(fp(target.description.en));
  });

  it("is written to the audit log", async () => {
    await publish("a-note", content({ he: HE }));
    const append = vi.mocked(couch.append);
    append.mockClear();
    const rev = store.get("post:a-note")!._rev;
    await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "post", id: "a-note", path: "title", rev });
    await new Promise((r) => setTimeout(r, 10));
    const entry = append.mock.calls.map((c) => c[1] as { path: string; target: string }).find((e) => e.path === "/api/admin/translations/ack");
    expect(entry?.target).toBe("post:a-note");
  });
});

describe("the backfill (#303)", () => {
  it("fills every absent fingerprint in a note, its draft, an area and a content document", () => {
    const note = {
      _id: "post:x",
      type: "post",
      title: "T",
      excerpt: "E",
      body: "B",
      he: { title: "ת", subtitle: "", excerpt: "", body: "ג" },
      draft: { title: "T2", excerpt: "", body: "B", he: { title: "ת2", subtitle: "", excerpt: "", body: "" } },
    };
    const c = backfillDoc(note)!;
    expect(c.units).toEqual(["title", "body", "draft.title"]);
    expect(c.next.heMeta).toEqual({ src: { title: fp("T"), body: fp("B") }, bodyBase: "B" });
    expect((c.next.draft as { heMeta: unknown }).heMeta).toEqual({ src: { title: fp("T2") } });

    const area = backfillDoc({ _id: "collection:y", type: "collection", title: "Y", tagline: "L", he: { title: "י", tagline: null, description: null } })!;
    expect(area.next.heMeta).toEqual({ src: { title: fp("Y") } });

    const doc = backfillDoc({
      _id: "content:story",
      type: "content",
      published: { start: { title: { en: "Start", he: "התחלה" }, lines: [{ en: "One" }] } },
      draft: null,
    })!;
    expect(doc.units).toEqual(["published.start.title"]);
    expect(((doc.next.published as { start: { title: { heSrc: string } } }).start.title).heSrc).toBe(fp("Start"));
  });

  it("never replaces a fingerprint, never touches text, and is idempotent", () => {
    const note = {
      _id: "post:x",
      type: "post",
      title: "T",
      body: "B",
      he: { title: "ת", body: "ג" },
      heMeta: { src: { title: "aaaaaaaaaaaa" }, bodyBase: "Old B" },
    };
    const c = backfillDoc(note)!;
    expect(c.units).toEqual(["body"]);
    expect(c.next.heMeta).toEqual({ src: { title: "aaaaaaaaaaaa", body: fp("B") }, bodyBase: "Old B" });
    expect(c.next.he).toEqual(note.he);
    expect(backfillDoc(c.next)).toBeNull();
  });

  it("leaves a document with no Hebrew, or not a content type, alone", () => {
    expect(backfillDoc({ _id: "post:z", type: "post", title: "T", body: "B", he: null })).toBeNull();
    expect(backfillDoc({ _id: "settings", type: "settings" })).toBeNull();
  });
});

describe("PUT /api/admin/translations/draft (#307)", () => {
  const draftPut = (body: Record<string, unknown>) => asAdmin(request(app()).put("/api/admin/translations/draft")).send(body);

  it("is a dry run by default: the changes and the glossary warnings, nothing written", async () => {
    await publish("a-note", content({ he: HE }));
    const before = structuredClone(store.get("post:a-note"));
    const res = await draftPut({ type: "post", id: "a-note", units: [{ path: "excerpt", he: "פתיח בGitHub" }] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      dryRun: true,
      target: "post:a-note",
      changes: [{ path: "excerpt", en: "The lede.", before: "הפתיח.", after: "פתיח בGitHub" }],
      warnings: [{ path: "excerpt", rule: "prefix-glued", match: "בGitHub", use: "ב־GitHub" }],
    });
    expect(store.get("post:a-note")).toEqual(before);
  });

  it("writes a published note's Hebrew into its draft, stamped, and leaves what is live alone", async () => {
    await publish("a-note", content({ he: HE }));
    const rev = store.get("post:a-note")!._rev;
    const res = await draftPut({ type: "post", id: "a-note", rev, units: [{ path: "title", he: "רשימה חדשה" }], dryRun: false });
    expect(res.status).toBe(200);
    expect(res.body.rev).toBe(store.get("post:a-note")!._rev);
    const doc = store.get("post:a-note")! as Record<string, any>;
    expect(doc.he.title).toBe("רשימה");
    expect(doc.draft.he).toMatchObject({ title: "רשימה חדשה", body: "הגוף." });
    expect(doc.draft.heMeta.src).toMatchObject({ title: fp("A note"), body: fp("The body.") });
    expect((await statusOf("post", "a-note")).units.find((u) => u.path === "title")).toMatchObject({ status: "translated", draftHe: "רשימה חדשה" });
    /* A stale revision is refused. */
    expect((await draftPut({ type: "post", id: "a-note", rev, units: [{ path: "title", he: "x" }], dryRun: false })).status).toBe(409);
  });

  it("writes a content document's draft by item and path, and refuses an unknown path and a repeated one", async () => {
    const p = seed().projects;
    store.set("content:projects", { _id: "content:projects", _rev: "1-p", type: "content", key: "projects", published: p, draft: null });
    const slug = p.items[0].slug;
    const res = await draftPut({ type: "project", id: slug, rev: "1-p", units: [{ path: "fact", he: "עובדה." }], dryRun: false });
    expect(res.status).toBe(200);
    const doc = store.get("content:projects")! as Record<string, any>;
    expect(doc.draft.items[0].fact).toEqual({ en: p.items[0].fact.en, he: "עובדה.", heSrc: fp(p.items[0].fact.en) });
    expect(doc.published.items[0].fact.he).toBe(p.items[0].fact.he);

    expect((await draftPut({ type: "project", id: slug, units: [{ path: "tech", he: "x" }] })).status).toBe(404);
    expect((await draftPut({ type: "project", id: slug, units: [{ path: "fact", he: "a" }, { path: "fact", he: "b" }] })).status).toBe(400);
  });

  describe("areas and media have no draft: a write is live, stamped as the admin stamps it", () => {
    const putArea = () =>
      store.set("collection:bothy", {
        _id: "collection:bothy",
        _rev: "1-b",
        type: "collection",
        slug: "bothy",
        title: "Bothy",
        tagline: "A dev box",
        description: "",
        links: [{ label: { en: "Source" }, url: "https://example.com/src" }],
        status: "published",
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
      });
    const putPicture = () =>
      store.set("media:pic-abc123", {
        _id: "media:pic-abc123",
        _rev: "1-a",
        type: "media",
        id: "pic-abc123",
        name: "pic.png",
        alt: "A grey card",
        caption: "",
        credit: "",
        kind: "image",
        createdAt: NOW,
        updatedAt: NOW,
      });

    it("area dry run (the default) answers with the changes and writes nothing", async () => {
      putArea();
      const before = structuredClone(store.get("collection:bothy"));
      const res = await draftPut({ type: "area", id: "bothy", units: [{ path: "tagline", he: "שרת פיתוח" }] });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ dryRun: true, target: "collection:bothy", changes: [{ path: "tagline", en: "A dev box", before: null, after: "שרת פיתוח" }] });
      expect(store.get("collection:bothy")).toEqual(before);
    });

    it("area write stores he and a correct heMeta, and a link label its heSrc", async () => {
      putArea();
      const res = await draftPut({
        type: "area",
        id: "bothy",
        units: [{ path: "title", he: "בותי" }, { path: "tagline", he: "שרת פיתוח" }, { path: "links.0.label", he: "קוד מקור" }],
        dryRun: false,
      });
      expect(res.status).toBe(200);
      const doc = store.get("collection:bothy")! as Record<string, any>;
      expect(doc.he).toEqual({ title: "בותי", tagline: "שרת פיתוח", description: null });
      expect(doc.heMeta).toEqual({ src: { title: fp("Bothy"), tagline: fp("A dev box") } });
      expect(doc.links[0].label).toEqual({ en: "Source", he: "קוד מקור", heSrc: fp("Source") });
      expect((await statusOf("area", "bothy")).status).toBe("translated");
      /* An empty string removes a unit's Hebrew. */
      await draftPut({ type: "area", id: "bothy", units: [{ path: "title", he: "" }], dryRun: false });
      expect((store.get("collection:bothy")! as Record<string, any>).he.title).toBeNull();
    });

    it("area: unknown area or path is 404, too long is 400, a stale rev is 409", async () => {
      putArea();
      expect((await draftPut({ type: "area", id: "nope", units: [{ path: "title", he: "x" }] })).status).toBe(404);
      expect((await draftPut({ type: "area", id: "bothy", units: [{ path: "body", he: "x" }] })).status).toBe(404);
      expect((await draftPut({ type: "area", id: "bothy", units: [{ path: "links.3.label", he: "x" }] })).status).toBe(404);
      const long = await draftPut({ type: "area", id: "bothy", units: [{ path: "tagline", he: "א".repeat(161) }], dryRun: false });
      expect(long.status).toBe(400);
      expect((await draftPut({ type: "area", id: "bothy", rev: "9-z", units: [{ path: "title", he: "x" }], dryRun: false })).status).toBe(409);
      expect((store.get("collection:bothy")! as Record<string, any>).he).toBeUndefined();
    });

    it("media: dry run writes nothing; a write stores he and heMeta; unknown and too long are refused", async () => {
      putPicture();
      const before = structuredClone(store.get("media:pic-abc123"));
      const dry = await draftPut({ type: "media", id: "pic-abc123", units: [{ path: "alt", he: "כרטיס אפור" }] });
      expect(dry.body).toMatchObject({ dryRun: true, changes: [{ path: "alt", en: "A grey card", before: null, after: "כרטיס אפור" }] });
      expect(store.get("media:pic-abc123")).toEqual(before);
      const res = await draftPut({ type: "media", id: "pic-abc123", units: [{ path: "alt", he: "כרטיס אפור" }], dryRun: false });
      expect(res.status).toBe(200);
      const doc = store.get("media:pic-abc123")! as Record<string, any>;
      expect(doc.he).toEqual({ alt: "כרטיס אפור", caption: "" });
      expect(doc.heMeta).toEqual({ src: { alt: fp("A grey card") } });
      expect((await draftPut({ type: "media", id: "none", units: [{ path: "alt", he: "x" }] })).status).toBe(404);
      expect((await draftPut({ type: "media", id: "pic-abc123", units: [{ path: "credit", he: "x" }] })).status).toBe(404);
      expect((await draftPut({ type: "media", id: "pic-abc123", units: [{ path: "alt", he: "א".repeat(301) }], dryRun: false })).status).toBe(400);
    });
  });

  it("serves the glossary", async () => {
    const res = await asAdmin(request(app()).get("/api/admin/translations/glossary"));
    expect(res.status).toBe(200);
    expect(res.body.glossary.allowLatin).toContain("GitHub");
    expect((await request(app()).get("/api/admin/translations/glossary")).status).toBe(401);
  });
});

describe("publishing one language of a note (#305)", () => {
  const HE2 = { ...HE, title: "רשימה, מתוקנת" };
  type Stored = { title: string; he: { title: string }; heMeta: { src: Record<string, string> }; draft: { title: string; he: { title: string } } | null };
  const stored = () => store.get("post:a-note") as unknown as Stored;

  it("publishes the Hebrew alone: the English edit stays in the draft, the live English untouched", async () => {
    await publish("a-note", content());
    const res = await publish("a-note", { ...content({ title: "A note, renamed", he: HE2 }), scope: "he" });
    expect(res.status).toBe(200);
    expect(stored().title).toBe("A note");
    expect(stored().he.title).toBe("רשימה, מתוקנת");
    expect(stored().heMeta.src.title).toBe(fp("A note"));
    expect(stored().draft?.title).toBe("A note, renamed");
    expect(stored().draft?.he.title).toBe("רשימה, מתוקנת");
  });

  it("publishes the English alone: new Hebrew waits in the draft, the live Hebrew stays", async () => {
    await publish("a-note", content({ he: HE }));
    await publish("a-note", { ...content({ title: "A note, renamed", he: HE2 }), scope: "en" });
    expect(stored().title).toBe("A note, renamed");
    expect(stored().he.title).toBe("רשימה");
    expect(stored().draft?.he.title).toBe("רשימה, מתוקנת");
    /* The live Hebrew was written for the old English title: stale now. */
    const item = await statusOf("post", "a-note");
    expect(item.units.find((u) => u.path === "title")?.status).toBe("stale");
  });

  it("leaves no draft when the one language was the whole edit", async () => {
    await publish("a-note", content());
    await publish("a-note", { ...content({ he: HE }), scope: "he" });
    expect(stored().he.title).toBe("רשימה");
    expect(stored().draft).toBeNull();
  });

  it("refuses the Hebrew alone for a note that was never published", async () => {
    const res = await publish("new-note", { ...content({ he: HE }), scope: "he" });
    expect(res.status).toBe(400);
    expect(store.has("post:new-note")).toBe(false);
  });
});

/* ----------------------------------------------------------------- #306 */

describe("a note's link labels in Hebrew (#306)", () => {
  const LINKS = [{ label: "Source", url: "https://example.com/src" }, { label: "Demo", url: "https://example.com/demo" }];

  it("stamps each Hebrew label against its English, and reads one as stale when the English changes", async () => {
    await publish("a-note", content({ links: LINKS, he: { ...HE, "links.0.label": "קוד מקור" } }));
    const doc = store.get("post:a-note")!;
    expect((doc.heMeta as { src: Record<string, string> }).src["links.0.label"]).toBe(fp("Source"));
    let item = await statusOf("post", "a-note");
    expect(item.units.find((u) => u.path === "links.0.label")?.status).toBe("translated");
    expect(item.units.find((u) => u.path === "links.1.label")?.status).toBe("missing");
    /* A label is not the lede: a missing one does not make the note missing. */
    expect(item.status).toBe("translated");

    await publish("a-note", content({ links: [{ ...LINKS[0], label: "Source code" }, LINKS[1]], he: { ...HE, "links.0.label": "קוד מקור" } }));
    item = await statusOf("post", "a-note");
    expect(item.units.find((u) => u.path === "links.0.label")?.status).toBe("stale");
  });

  it("keeps a Hebrew block that holds only a label", async () => {
    await publish("a-note", content({ links: LINKS, he: { title: "", subtitle: "", excerpt: "", body: "", "links.1.label": "הדגמה" } }));
    expect((store.get("post:a-note")!.he as Record<string, string>)["links.1.label"]).toBe("הדגמה");
  });

  it("takes 'still correct' for a label", async () => {
    await publish("a-note", content({ links: LINKS, he: { ...HE, "links.0.label": "קוד מקור" } }));
    await publish("a-note", content({ links: [{ ...LINKS[0], label: "Source code" }, LINKS[1]], he: { ...HE, "links.0.label": "קוד מקור" } }));
    const rev = store.get("post:a-note")!._rev;
    const res = await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "post", id: "a-note", path: "links.0.label", rev });
    expect(res.status).toBe(200);
    expect((await statusOf("post", "a-note")).units.find((u) => u.path === "links.0.label")?.status).toBe("translated");
  });
});

describe("a picture's alt and caption in Hebrew, and captions per language (#306)", () => {
  const H = "a".repeat(16);
  function putMedia(over: Record<string, unknown> = {}) {
    store.set("media:clip-abc123", {
      _id: "media:clip-abc123",
      _rev: "1-a",
      type: "media",
      id: "clip-abc123",
      name: "clip.mp4",
      alt: "A tone over a grey card",
      caption: "",
      credit: "",
      kind: "video",
      format: "mp4",
      width: 160,
      height: 90,
      bytes: 10,
      hash: H,
      original: "video.mp4",
      variants: [],
      captions: { name: "captions.vtt", hash: "b".repeat(16), lang: "en", label: "English", bytes: 30 },
      _attachments: { "video.mp4": { stub: true }, "captions.vtt": { stub: true } },
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: "owner",
      ...over,
    });
  }
  const putMeta = (body: Record<string, unknown>) =>
    asAdmin(request(app()).put("/api/admin/media/clip-abc123")).send({ alt: "A tone over a grey card", caption: "", credit: "", _rev: store.get("media:clip-abc123")!._rev, ...body });

  it("stamps the Hebrew alt, lists it, and reads it as stale when the English alt changes", async () => {
    putMedia();
    expect((await statusOf("media", "clip-abc123")).status).toBe("missing");
    const res = await putMeta({ he: { alt: "צליל מעל כרטיס אפור", caption: "" } });
    expect(res.status).toBe(200);
    expect(res.body.item.he).toEqual({ alt: "צליל מעל כרטיס אפור", caption: "" });
    expect(res.body.item.heMeta).toBeUndefined();
    expect((store.get("media:clip-abc123")!.heMeta as { src: Record<string, string> }).src.alt).toBe(fp("A tone over a grey card"));
    expect((await statusOf("media", "clip-abc123")).status).toBe("translated");

    /* The English changes and the Hebrew does not: stale, until acknowledged. */
    await putMeta({ alt: "A tone over a dark grey card" });
    expect((await statusOf("media", "clip-abc123")).status).toBe("stale");
    const ack = await asAdmin(request(app()).post("/api/admin/translations/ack")).send({ type: "media", id: "clip-abc123", path: "alt", rev: store.get("media:clip-abc123")!._rev });
    expect(ack.status).toBe(200);
    expect((await statusOf("media", "clip-abc123")).status).toBe("translated");
  });

  it("adds Hebrew captions beside the English, and removes them", async () => {
    putMedia();
    const res = await asAdmin(request(app()).put(`/api/admin/media/clip-abc123/captions/he?rev=1-a`))
      .set("Content-Type", "text/vtt")
      .send("WEBVTT\n\n00:00.000 --> 00:01.000\nצליל\n");
    expect(res.status).toBe(200);
    // The file travels with the metadata, in the one write.
    expect(store.get("media:clip-abc123")!._attachments).toHaveProperty("captions-he.vtt");
    expect(res.body.item.tracks.map((t: { lang: string; label: string }) => [t.lang, t.label])).toEqual([["en", "English"], ["he", "עברית"]]);
    expect(res.body.item.captions.lang).toBe("en");

    /* Not WebVTT: refused, nothing written. */
    const bad = await asAdmin(request(app()).put(`/api/admin/media/clip-abc123/captions/he?rev=${store.get("media:clip-abc123")!._rev}`))
      .set("Content-Type", "text/vtt")
      .send("not captions");
    expect(bad.status).toBe(415);

    const gone = await asAdmin(request(app()).delete(`/api/admin/media/clip-abc123/captions/he?rev=${store.get("media:clip-abc123")!._rev}`));
    expect(gone.status).toBe(200);
    expect(gone.body.item.tracks).toHaveLength(1);
    expect(store.get("media:clip-abc123")!._attachments).not.toHaveProperty("captions-he.vtt");
  });

  it("gives a reader the Hebrew words and every track, never the fingerprints", async () => {
    putMedia({
      he: { alt: "צליל", caption: "" },
      heMeta: { src: { alt: fp("A tone over a grey card") } },
      moreCaptions: [{ name: "captions-he.vtt", hash: "c".repeat(16), lang: "he", label: "עברית", bytes: 30 }],
    });
    const res = await request(app()).get("/api/images/media/clip-abc123/meta");
    expect(res.status).toBe(200);
    expect(res.body.item.he).toEqual({ alt: "צליל", caption: "" });
    expect(res.body.item.tracks.map((t: { url: string }) => t.url)).toEqual([
      `/api/images/m/clip-abc123/captions-${"b".repeat(16)}.vtt`,
      `/api/images/m/clip-abc123/captions-${"c".repeat(16)}.vtt`,
    ]);
    expect(JSON.stringify(res.body)).not.toContain("heMeta");
  });
});
