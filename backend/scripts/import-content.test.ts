/*
 * The content import, English and Hebrew, run against the real admin routes.
 *
 * CouchDB is an in-memory map with the two behaviours that matter (a PUT
 * naming a stale revision is 409, a missing id is 404), as in
 * src/routes/translations-stamp.test.ts. `applyPlan` gets an `api` that calls
 * the app through supertest, so every body the script would send is parsed,
 * validated and stamped by the same code the live API runs.
 */
import request from "supertest";
import { createApp } from "../src/app";
import { couch, CouchError } from "../src/db/couch.js";
import { env } from "../src/env.js";
import { fp } from "../src/schemas/i18n.js";
import { loadContent, toPostHebrew, type AreaDraft, type NoteFile } from "./content-files.mjs";
import { applyPlan, buildPlan, describePlan, mergeHebrew, needsWrite, type PlanItem } from "./import-plan.mjs";

type Doc = Record<string, any> & { _id: string; _rev?: string };

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

const app = createApp();

/** The script's `api`, through the app instead of the network. */
async function api(method: string, path: string, body?: unknown) {
  const url = `/api/admin${path}`;
  const r = request(app);
  const req = method === "GET" ? r.get(url) : method === "PUT" ? r.put(url) : r.post(url);
  const res = await req
    .set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET)
    .set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN)
    .send(body as object);
  if (res.status >= 400 || !res.body?.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(res.body?.error ?? res.body)}`);
  return res.body;
}

async function plan(content: { areas: { data: AreaDraft }[]; posts: NoteFile[] }, opts = {}) {
  const [{ items: liveAreas }, { items: livePosts }] = await Promise.all([api("GET", "/collections"), api("GET", "/posts")]);
  return buildPlan(content, { liveAreas, livePosts }, opts);
}

async function run(content: { areas: { data: AreaDraft }[]; posts: NoteFile[] }, opts = {}) {
  const p = await plan(content, opts);
  const log: string[] = [];
  const failed = await applyPlan(p, api, (l) => log.push(l));
  expect(failed, log.join("\n")).toBe(0);
  return p;
}

const written = (p: PlanItem[]) => p.filter(needsWrite).map((i) => `${i.kind} ${i.slug}`);
const post = (slug: string) => store.get(`post:${slug}`)!;
const area = (slug: string) => store.get(`collection:${slug}`)!;

/* -------------------------------------------------------------- fixtures */

const AREA: AreaDraft = {
  slug: "site",
  title: "This site",
  tagline: "How it is built",
  kind: "site",
  description: "Notes about the site.",
  coverImage: null,
  links: [
    { label: "Source", url: "https://github.com/YehudaBriskman/portfolio_site" },
    { label: "Issues", url: "https://github.com/YehudaBriskman/portfolio_site/issues" },
  ],
  order: 10,
  status: "published",
  repo: null,
  he: { title: "האתר הזה", tagline: "איך הוא בנוי", description: "רשימות על האתר.", linkLabels: ["קוד מקור", null] },
};

function note(over: { he?: NoteFile["he"]; meta?: Partial<NoteFile["meta"]>; body?: string } = {}): NoteFile {
  return {
    file: "a-note.md",
    folder: "site",
    meta: {
      slug: "a-note",
      title: "A note",
      subtitle: "Its subtitle",
      excerpt: "The excerpt of a note, long enough to read as one.",
      tags: ["release"],
      collection: "site",
      status: "published",
      publishedAt: "2026-11-02T10:57:14Z",
      readingMinutes: 1,
      featured: null,
      coverImage: null,
      links: [{ label: "Release", url: "https://github.com/YehudaBriskman/portfolio_site/releases" }],
      sources: [],
      ...over.meta,
    },
    body: over.body ?? "The body.",
    he:
      over.he === undefined
        ? { file: "a-note.he.md", meta: { title: "רשימה", subtitle: "כותרת משנה", excerpt: "הפתיח.", linkLabels: ["גרסה"] }, body: "הגוף." }
        : over.he,
  };
}

const content = (...posts: NoteFile[]) => ({ areas: [{ data: AREA }], posts });

/* ----------------------------------------------------------------- tests */

describe("mergeHebrew", () => {
  const F = ["title", "body"];
  it("fills what the store lacks, and leaves equal Hebrew alone", () => {
    const r = mergeHebrew({ title: "א", body: "ב" }, { title: " א " }, F);
    expect(r.merged).toEqual({ title: " א ", body: "ב" });
    expect(r.actions).toEqual([{ field: "body", action: "add" }]);
  });
  it("keeps the store's Hebrew when it differs, unless told to overwrite", () => {
    expect(mergeHebrew({ title: "חדש" }, { title: "ישן" }, F)).toEqual({ merged: { title: "ישן" }, actions: [{ field: "title", action: "kept" }] });
    expect(mergeHebrew({ title: "חדש" }, { title: "ישן" }, F, { overwriteHe: true })).toEqual({
      merged: { title: "חדש" },
      actions: [{ field: "title", action: "overwrite" }],
    });
  });
  it("keeps the store's Hebrew where the repo has none", () => {
    expect(mergeHebrew(null, { title: "ישן" }, F)).toEqual({ merged: { title: "ישן" }, actions: [] });
  });
});

describe("import-content against the admin routes", () => {
  it("creates an area and a note with their Hebrew, and a second run writes nothing", async () => {
    const first = await run(content(note()));
    expect(written(first)).toEqual(["collection site", "post a-note"]);

    const p = post("a-note");
    expect(p.status).toBe("published");
    expect(p.title).toBe("A note");
    expect(p.he).toMatchObject({ title: "רשימה", subtitle: "כותרת משנה", excerpt: "הפתיח.", body: "הגוף.", "links.0.label": "גרסה" });
    /* Stamped by the server against the English beside it. */
    expect(p.heMeta.src.title).toBe(fp("A note"));
    expect(p.heMeta.src["links.0.label"]).toBe(fp("Release"));
    expect(p.draft).toBeNull();
    expect(p.publishedAt).toBe("2026-11-02T10:57:14Z");

    const a = area("site");
    expect(a.he).toEqual({ title: "האתר הזה", tagline: "איך הוא בנוי", description: "רשימות על האתר." });
    expect(a.links[0].label).toMatchObject({ en: "Source", he: "קוד מקור", heSrc: fp("Source") });
    expect(a.links[1].label).toEqual({ en: "Issues" });

    const second = await plan(content(note()));
    expect(written(second)).toEqual([]);
    expect(describePlan(second).every((l) => l.startsWith("= unchanged"))).toBe(true);
  });

  it("never replaces Hebrew the store holds; reports it; replaces it with --overwrite-he", async () => {
    await run(content(note()));
    const repoSays = note({ he: { file: "x", meta: { title: "רשימה, בגרסה מהמאגר", excerpt: "הפתיח." }, body: "הגוף." } });

    const kept = await plan(content(repoSays));
    expect(written(kept)).toEqual([]);
    const item = kept.find((i) => i.slug === "a-note")!;
    expect(item.hebrew).toEqual([{ field: "title", action: "kept" }]);
    expect(describePlan(kept).join("\n")).toContain("hebrew: kept the store's title (differs from the repo; --overwrite-he replaces it)");

    await run(content(repoSays), { overwriteHe: true });
    expect(post("a-note").he.title).toBe("רשימה, בגרסה מהמאגר");
    /* The fields the repo did not change keep what they had, fingerprints included. */
    expect(post("a-note").he.subtitle).toBe("כותרת משנה");
  });

  it("fills only the missing fields, keeping the existing ones' fingerprints", async () => {
    await run(content(note({ he: { file: "x", meta: { title: "רשימה", excerpt: "" }, body: "" } })));
    const titleSrc = post("a-note").heMeta.src.title;
    /* The English changes before the body is translated: the old Hebrew title is now stale. */
    const later = note({ meta: { title: "A note, renamed" } });
    const p = await run(content(later));
    expect(p.find((i) => i.slug === "a-note")!.hebrew.map((a) => a.field)).toEqual(["subtitle", "excerpt", "body", "links.0.label"]);
    expect(post("a-note").title).toBe("A note, renamed");
    expect(post("a-note").he.body).toBe("הגוף.");
    expect(post("a-note").heMeta.src.title).toBe(titleSrc);
    expect(post("a-note").heMeta.src.body).toBe(fp("The body."));
  });

  it("leaves a note with an unpublished draft alone, and says why", async () => {
    await run(content(note({ he: null })));
    const doc = post("a-note");
    store.set("post:a-note", { ...doc, draft: { ...doc, title: "Being edited" } });
    const p = await plan(content(note()));
    const item = p.find((i) => i.slug === "a-note")!;
    expect(item.he).toBeNull();
    expect(item.notes.join(" ")).toContain("unpublished draft");
    await applyPlan(p, api, () => {});
    expect(post("a-note").draft.title).toBe("Being edited");
    expect(post("a-note").he).toBeNull();
  });

  it("keeps the note's 'what changed' line when it adds the Hebrew", async () => {
    await run(content(note({ he: null })));
    store.set("post:a-note", { ...post("a-note"), changeNote: "Fixed a date." });
    await run(content(note()));
    expect(post("a-note").changeNote).toBe("Fixed a date.");
    expect(post("a-note").he.title).toBe("רשימה");
  });

  it("keeps an area link's Hebrew with its link when the list is reordered", async () => {
    await run(content());
    const reordered = { ...AREA, links: [AREA.links[1], AREA.links[0]], he: { ...AREA.he, linkLabels: [] } };
    await run({ areas: [{ data: reordered }], posts: [] });
    expect(area("site").links[1].label).toMatchObject({ en: "Source", he: "קוד מקור" });
    expect(area("site").links[0].label).toEqual({ en: "Issues" });
  });

  it("loads every reviewed area and note, in both languages, through the routes", async () => {
    const repo = loadContent();
    await run(repo);
    for (const p of repo.posts) {
      const stored = post(p.meta.slug);
      expect(stored.status).toBe("published");
      const he = toPostHebrew(p);
      if (he) expect(stored.he, p.meta.slug).toMatchObject(he);
    }
    for (const { data } of repo.areas) {
      if (data.he?.title) expect(area(data.slug).he.title).toBe(data.he.title);
    }
    expect(written(await plan(repo))).toEqual([]);
  });
});
