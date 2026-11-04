import { couch, CouchError } from "../db/couch.js";
import { lintHebrew, type LintIssue } from "../i18n/glossary.js";
import { PostContentSchema, PostSchema, type Collection, type Post } from "../schemas/content.js";
import {
  COLLECTION_FIELDS,
  LINK_LABEL_PATHS,
  POST_FIELDS,
  postEnglish,
  atPath,
  collectionTranslation,
  fp,
  isText,
  normaliseSource,
  type HebrewMeta,
  countUnits,
  coverage,
  itemStatus,
  mediaTranslation,
  postTranslation,
  stampHebrewMeta,
  stampTexts,
  textUnits,
  type TranslationCounts,
  type TranslationItem,
  type TranslationStatus,
  type TranslationType,
} from "../schemas/i18n.js";
import { CONTENT_KEYS, CONTENT_SCHEMAS, type ContentDoc, type ContentKey } from "../schemas/site-content.js";
import { contentId, getContentDoc, seedFor } from "./site-content.js";
import { mediaStore, type MediaDoc } from "./media.js";

/*
 * Everything the owner has written, as translation items (#301).
 *
 * A read, never a write: it loads the notes, the areas and the three content
 * documents and computes each unit's status with schemas/i18n.ts. No status is
 * stored anywhere, so the dashboard, the pills and the MCP tools agree because
 * they all call this.
 *
 * Items are ranked by where a Hebrew reader meets them: the home page first,
 * then the hubs, the project pages, the story, the areas, and the notes by
 * how recently they were published.
 */

type Raw = Record<string, unknown>;

/* --------------------------------------------------------- structured copy */

/** The site copy's sections, by where they are seen. */
const SITE_COPY_SECTIONS: Record<string, { title: string; route: string; rank: number }> = {
  hero: { title: "Home · hero", route: "/", rank: 0 },
  about: { title: "Home · how I work", route: "/", rank: 1 },
  contact: { title: "Home · contact", route: "/", rank: 2 },
  footer: { title: "Footer", route: "/", rank: 3 },
};

/* A project's lede is its fact and description; the rest only counts. */
const PROJECT_PRIMARY = new Set(["fact", "description"]);

function projectItems(published: Raw, draft: Raw | null): TranslationItem[] {
  const items = (published.items as Raw[] | undefined) ?? [];
  const draftItems = (draft?.items as Raw[] | undefined) ?? null;
  return items.map((p) => {
    const slug = String(p.slug);
    const d = draftItems?.find((x) => x.slug === slug) ?? null;
    const units = textUnits(p, d, (path) => PROJECT_PRIMARY.has(path));
    const order = typeof p.order === "number" ? p.order : 50;
    return {
      type: "project" as const,
      id: slug,
      title: String(p.title ?? slug),
      route: `/projects/${slug}`,
      /* Featured projects sit on the home page and /projects. */
      rank: (order < 20 ? 10 : 40) + Math.min(order, 99) / 100,
      visibility: "public" as const,
      status: itemStatus(units),
      units,
    };
  });
}

function storyItems(published: Raw, draft: Raw | null): TranslationItem[] {
  const out: TranslationItem[] = [];
  const base = { type: "story" as const, route: "/story", visibility: "public" as const };
  const start = textUnits(published.start, draft?.start, (path) => path === "title" || path === "lines.0");
  out.push({ ...base, id: "start", title: "Story · start", rank: 30, status: itemStatus(start), units: start });
  const roles = (published.roles as Raw[] | undefined) ?? [];
  const draftRoles = (draft?.roles as Raw[] | undefined) ?? null;
  roles.forEach((r, i) => {
    const id = String(r.id);
    const d = draftRoles?.find((x) => x.id === id) ?? null;
    const units = textUnits(r, d, (path) => path === "title" || path === "lines.0");
    const title = (r.title as { en?: string } | undefined)?.en ?? id;
    out.push({ ...base, id: `role:${id}`, title: `Story · ${title}`, rank: 31 + i / 100, status: itemStatus(units), units });
  });
  const pictures = textUnits(published.images, draft?.images, () => true).map((u) => ({ ...u, path: `images.${u.path}` }));
  if (pictures.length) {
    out.push({ ...base, id: "images", title: "Story · picture descriptions", rank: 35, status: itemStatus(pictures), units: pictures });
  }
  const interludes = textUnits(published.interludes, draft?.interludes, () => true).map((u) => ({ ...u, path: `interludes.${u.path}` }));
  if (interludes.length) {
    out.push({ ...base, id: "interludes", title: "Story · interludes", rank: 36, status: itemStatus(interludes), units: interludes });
  }
  return out;
}

function siteCopyItems(published: Raw, draft: Raw | null): TranslationItem[] {
  return Object.entries(SITE_COPY_SECTIONS).flatMap(([section, meta]) => {
    if (!published[section]) return [];
    const units = textUnits(published[section], draft?.[section], () => true);
    if (!units.length) return [];
    return [{ type: "site-copy" as const, id: section, ...meta, visibility: "public" as const, status: itemStatus(units), units }];
  });
}

const BUILDERS: Record<ContentKey, (published: Raw, draft: Raw | null) => TranslationItem[]> = {
  projects: projectItems,
  story: storyItems,
  "site-copy": siteCopyItems,
};

/**
 * The content documents' items. Read raw, not through the schemas, so the
 * fingerprints survive even before the schemas know them; a key with no
 * document is the seed, as the site shows it.
 */
export async function contentItems(): Promise<TranslationItem[]> {
  const docs = await Promise.all(CONTENT_KEYS.map((k) => getContentDoc(k)));
  return CONTENT_KEYS.flatMap((key, i) => {
    const doc = docs[i];
    const published = (doc ? doc.published : seedFor(key)) as Raw;
    return published && typeof published === "object" ? BUILDERS[key](published, (doc?.draft as Raw | null) ?? null) : [];
  });
}

/* ----------------------------------------------------------- notes, areas */

export function postItem(post: Post): TranslationItem {
  const { units, status } = postTranslation(post);
  const live = post.status === "published" && !post.seo?.noindex;
  const when = Date.parse(post.publishedAt ?? post.updatedAt ?? "") || 0;
  return {
    type: "post",
    id: post.slug,
    title: post.title,
    route: `/blog/${post.slug}`,
    /* Newer notes first: 100 plus days since publishing, capped. */
    rank: 100 + Math.min(9999, Math.max(0, Math.round((Date.now() - when) / 86_400_000))) / 10_000,
    visibility: live ? "public" : "private",
    status,
    units,
  };
}

export function areaItem(c: Collection): TranslationItem {
  const { units, status } = collectionTranslation(c);
  return {
    type: "area",
    id: c.slug,
    title: c.title,
    route: `/blog/area/${c.slug}`,
    rank: 50 + (typeof c.order === "number" ? Math.min(Math.max(c.order, 0), 999) : 50) / 1000,
    visibility: (c.status ?? "published") === "published" ? "public" : "private",
    status,
    units,
  };
}

/** A media item (#306): after the notes, since a reader meets it inside a page. */
export function mediaItem(m: MediaDoc): TranslationItem {
  const { units, status } = mediaTranslation(m);
  return {
    type: "media",
    id: m.id,
    title: m.name,
    route: `/admin/media?id=${m.id}`,
    rank: 200,
    visibility: "public",
    status,
    units,
  };
}

/* -------------------------------------------- "the Hebrew is still correct" */

/*
 * The acknowledgement (#303): the owner has read stale Hebrew and it still
 * says what the English says (an English typo fix, a reworded aside). The
 * unit's fingerprint is restamped to today's English, with no change to any
 * text, so it reads as translated again.
 *
 * The draft is restamped too where it holds the same Hebrew against the same
 * English, so publishing that draft later does not bring the staleness back.
 */

export type AckInput = { type: TranslationType; id: string; path: string; rev: string };
export type AckResult =
  | { ok: true; rev: string; target: string; before: unknown; after: unknown }
  | { ok: false; status: 400 | 404 | 409; error: string };

const same = (a: unknown, b: unknown) =>
  typeof a === "string" && typeof b === "string" && normaliseSource(a) === normaliseSource(b);

const POST_HE_PATHS = [...POST_FIELDS.map((f) => f.field), ...LINK_LABEL_PATHS];
const POST_HE = new Set<string>(POST_HE_PATHS);
const AREA_HE = new Set<string>(COLLECTION_FIELDS.map((f) => f.field));

/** The `Text` at `path` inside one item of a content document, or undefined. */
function locate(key: ContentKey, root: unknown, id: string, path: string): unknown {
  if (!root || typeof root !== "object") return undefined;
  const r = root as Raw;
  if (key === "projects") {
    const project = ((r.items as Raw[] | undefined) ?? []).find((p) => p.slug === id);
    return project ? atPath(project, path) : undefined;
  }
  if (key === "story") {
    if (id === "start") return atPath(r.start, path);
    if (id.startsWith("role:")) {
      const role = ((r.roles as Raw[] | undefined) ?? []).find((x) => x.id === id.slice(5));
      return role ? atPath(role, path) : undefined;
    }
    /* Pictures and interludes carry their own prefix in the path. */
    if ((id === "images" || id === "interludes") && path.startsWith(`${id}.`)) return atPath(r, path);
    return undefined;
  }
  return id in SITE_COPY_SECTIONS ? atPath(r[id], path) : undefined;
}

/** A note or an area, read loosely: only its Hebrew and the fields beside it matter here. */
type HeDoc = Raw & {
  _id: string;
  _rev?: string;
  status?: string;
  he?: Raw | null;
  heMeta?: HebrewMeta | null;
  draft?: (Raw & { he?: Raw | null; heMeta?: HebrewMeta | null }) | null;
};

const CONTENT_KEY_OF: Partial<Record<TranslationType, ContentKey>> = { project: "projects", story: "story", "site-copy": "site-copy" };

async function tryGet<T>(id: string): Promise<(T & { _id: string; _rev?: string }) | null> {
  try {
    return await couch.get<T & { _id: string; _rev?: string }>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

async function save(doc: { _id: string; _rev?: string }): Promise<string | null> {
  try {
    const r = await couch.put<{ rev?: string }>(doc._id, doc);
    return r?.rev ?? doc._rev ?? "";
  } catch (e) {
    if (e instanceof CouchError && e.status === 409) return null;
    throw e;
  }
}

const notFound = { ok: false as const, status: 404 as const, error: "No such item or field." };
const conflictAck = { ok: false as const, status: 409 as const, error: "This changed elsewhere. Reload and try again." };
const nothingLive = { ok: false as const, status: 400 as const, error: "There is no published Hebrew here to acknowledge." };

export async function ackTranslation(input: AckInput): Promise<AckResult> {
  if (input.type === "media") {
    if (input.path !== "alt" && input.path !== "caption") return notFound;
    const doc = await mediaStore.get(input.id);
    if (!doc) return notFound;
    if (doc._rev !== input.rev) return conflictAck;
    const field = input.path;
    if (!doc.he?.[field]?.trim()) return nothingLive;
    const before = structuredClone(doc);
    const next: MediaDoc = { ...doc, heMeta: { src: { ...(doc.heMeta?.src ?? {}), [field]: fp(doc[field]) } } };
    try {
      const saved = await mediaStore.saveMeta(next);
      return { ok: true, rev: saved._rev ?? "", target: doc._id, before, after: saved };
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return conflictAck;
      throw e;
    }
  }
  if (input.type === "post" || input.type === "area") {
    const fields = input.type === "post" ? POST_HE : AREA_HE;
    if (!fields.has(input.path)) return notFound;
    const id = `${input.type === "post" ? "post" : "collection"}:${input.id}`;
    const doc = await tryGet<HeDoc>(id);
    if (!doc) return notFound;
    if (doc._rev !== input.rev) return conflictAck;
    const field = input.path;
    const he = doc.he;
    const en = input.type === "post" ? postEnglish(doc)[field] : doc[field];
    if (input.type === "post" && doc.status !== "published") return nothingLive;
    if (!he || typeof he[field] !== "string" || !(he[field] as string).trim() || typeof en !== "string") return nothingLive;

    const before = structuredClone(doc);
    const meta: HebrewMeta = { ...(doc.heMeta ?? {}), src: { ...(doc.heMeta?.src ?? {}), [field]: fp(en) } };
    if (field === "body") meta.bodyBase = en;
    const next: HeDoc = { ...doc, heMeta: meta };
    const draft = doc.draft;
    if (input.type === "post" && draft?.he && same(draft.he[field], he[field]) && same(postEnglish(draft)[field], en)) {
      const dmeta: HebrewMeta = { ...(draft.heMeta ?? {}), src: { ...(draft.heMeta?.src ?? {}), [field]: fp(en) } };
      if (field === "body") dmeta.bodyBase = en;
      next.draft = { ...draft, heMeta: dmeta };
    }
    const rev = await save(next);
    if (rev === null) return conflictAck;
    return { ok: true, rev, target: id, before, after: next };
  }

  const key = CONTENT_KEY_OF[input.type];
  if (!key) return notFound;
  const doc = await getContentDoc(key);
  if (!doc) return nothingLive;
  if (doc._rev !== input.rev) return conflictAck;
  const before = structuredClone(doc);
  const next = structuredClone(doc);
  const text = locate(key, next.published, input.id, input.path);
  if (!isText(text)) return notFound;
  if (!text.he || !text.he.trim()) return nothingLive;
  text.heSrc = fp(text.en);
  const draftText = locate(key, next.draft, input.id, input.path);
  if (isText(draftText) && same(draftText.he, text.he) && same(draftText.en, text.en)) draftText.heSrc = text.heSrc;
  next.updatedAt = new Date().toISOString();
  const rev = await save(next);
  if (rev === null) return conflictAck;
  return { ok: true, rev, target: next._id, before, after: next };
}

/* ------------------------------------------------- Hebrew into the draft */

/*
 * Writes Hebrew for one or more units of one item into its DRAFT (#307, the
 * MCP's put_translation). Nothing goes live: a published note gets a draft (or
 * its draft is updated), a content document's draft is written, and the owner
 * publishes from the admin as for any other edit. A note that is not published
 * has no live version, so its Hebrew is written where its draft lives, on the
 * note itself. Areas have no draft, so they are refused.
 *
 * The fingerprints are stamped exactly as a save from the admin stamps them,
 * and every Hebrew string is linted against the glossary; the warnings come
 * back with the result and never block the write.
 */

export type DraftUnit = { path: string; he: string };
export type DraftInput = { type: TranslationType; id: string; rev?: string; units: DraftUnit[]; dryRun: boolean };
export type DraftChange = { path: string; en: string; before: string | null; after: string | null };
export type DraftWarning = LintIssue & { path: string };
export type DraftResult =
  | {
      ok: true;
      dryRun: boolean;
      target: string;
      changes: DraftChange[];
      warnings: DraftWarning[];
      rev?: string;
      audit?: { target: string; before: unknown; after: unknown };
    }
  | { ok: false; status: 400 | 404 | 409; error: string };

const noDraft = { ok: false as const, status: 400 as const, error: "Areas and media have no draft. Edit their Hebrew in the admin." };
const tooLong = (path: string) => ({ ok: false as const, status: 400 as const, error: `The Hebrew for ${path} is too long.` });

const clean = (v: string) => v.trim();
const orNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function lintUnits(units: DraftUnit[]): DraftWarning[] {
  return units.flatMap((u) => lintHebrew(u.he).map((w) => ({ ...w, path: u.path })));
}

/** A note's content as the draft editor holds it: its draft, or what is live. */
function postContentOf(doc: Post) {
  return PostContentSchema.parse(doc.draft ?? doc);
}

async function postDraft(input: DraftInput): Promise<DraftResult> {
  const id = `post:${input.id}`;
  const doc = await tryGet<Post>(id);
  if (!doc) return notFound;
  if (input.rev !== undefined && doc._rev !== input.rev) return conflictAck;
  for (const u of input.units) if (!POST_HE.has(u.path)) return notFound;

  const published = doc.status === "published";
  const content = published ? postContentOf(doc) : PostContentSchema.parse(doc);
  const he: Record<string, string | null> = { title: "", subtitle: "", excerpt: "", body: "", ...(content.he ?? {}) };
  const changes: DraftChange[] = [];
  for (const u of input.units) {
    const after = clean(u.he);
    const before = orNull(he[u.path]);
    if ((before ?? "") !== after) changes.push({ path: u.path, en: String(postEnglish(content)[u.path] ?? ""), before, after: after || null });
    he[u.path] = after;
  }
  const warnings = lintUnits(input.units);
  if (input.dryRun || changes.length === 0) return { ok: true, dryRun: input.dryRun, target: id, changes, warnings };

  const nextHe = PostContentSchema.shape.he.safeParse(he);
  if (!nextHe.success) return tooLong(String(nextHe.error.issues[0]?.path.join(".") ?? ""));
  const prevs = [
    { he: doc.draft?.he, meta: doc.draft?.heMeta },
    { he: doc.he, meta: doc.heMeta },
  ];
  const now = new Date().toISOString();
  const before = structuredClone(doc);
  let next: Post;
  if (published) {
    const draft = { ...content, he: nextHe.data };
    next = { ...doc, draft: { ...draft, heMeta: stampHebrewMeta(draft.he, postEnglish(draft), prevs, POST_HE_PATHS) }, draftSavedAt: now } as Post;
  } else {
    next = { ...doc, he: nextHe.data, heMeta: stampHebrewMeta(nextHe.data, postEnglish(doc), prevs, POST_HE_PATHS), updatedAt: now, draftSavedAt: now } as Post;
  }
  const valid = PostSchema.safeParse(next);
  if (!valid.success) return { ok: false, status: 400, error: "The note would not be valid with this Hebrew." };
  const rev = await save({ ...next, _id: id });
  if (rev === null) return conflictAck;
  return { ok: true, dryRun: false, target: id, changes, warnings, rev, audit: { target: id, before, after: next } };
}

async function contentDraft(key: ContentKey, input: DraftInput): Promise<DraftResult> {
  const existing = await getContentDoc(key);
  if (input.rev !== undefined && (existing?._rev ?? null) !== (input.rev || null)) return conflictAck;
  const published = existing ? existing.published : seedFor(key);
  const base = structuredClone(existing?.draft ?? published) as unknown;
  const changes: DraftChange[] = [];
  for (const u of input.units) {
    const t = locate(key, base, input.id, u.path);
    if (!isText(t)) return notFound;
    const after = clean(u.he);
    const before = orNull(t.he);
    if ((before ?? "") !== after) changes.push({ path: u.path, en: t.en, before, after: after || null });
    if (after) t.he = after;
    else delete t.he;
  }
  const target = contentId(key);
  const warnings = lintUnits(input.units);
  if (input.dryRun || changes.length === 0) return { ok: true, dryRun: input.dryRun, target, changes, warnings };

  const parsed = CONTENT_SCHEMAS[key].safeParse(base);
  if (!parsed.success) return tooLong(parsed.error.issues[0]?.path.join(".") ?? "");
  const data = stampTexts(parsed.data as unknown, [existing?.draft, published]);
  const now = new Date().toISOString();
  const next: ContentDoc = existing
    ? { ...existing, draft: data, updatedAt: now }
    : { _id: target, type: "content", key, published, draft: data, createdAt: now, updatedAt: now, publishedAt: now, source: "seed" } as ContentDoc;
  const rev = await save(next);
  if (rev === null) return conflictAck;
  return { ok: true, dryRun: false, target, changes, warnings, rev, audit: { target, before: existing, after: next } };
}

export async function putTranslationDraft(input: DraftInput): Promise<DraftResult> {
  if (input.type === "area" || input.type === "media") return noDraft;
  if (input.type === "post") return postDraft(input);
  const key = CONTENT_KEY_OF[input.type];
  return key ? contentDraft(key, input) : notFound;
}

/* -------------------------------------------------------------- the report */

export type TranslationFilter = {
  status?: TranslationStatus[];
  type?: TranslationType[];
  visibility?: "public" | "private";
};

export type TranslationReport = {
  counts: TranslationCounts;
  coverage: number;
  items: TranslationItem[];
};

/** Every item, or the ones the filter keeps. */
export async function allTranslationItems(): Promise<TranslationItem[]> {
  const [posts, areas, content, media] = await Promise.all([
    couch.find<Post>({ selector: { type: "post" }, limit: 1000 }),
    couch.find<Collection>({ selector: { type: "collection" }, limit: 300 }),
    contentItems(),
    mediaStore.list(),
  ]);
  const items = [
    ...content,
    ...areas.docs.map(areaItem),
    ...posts.docs.filter((p) => p.status !== "archived").map(postItem),
    /* Icons are decoration with their own label where used; pictures and videos are read. */
    ...media.filter((m) => m.kind !== "icon").map(mediaItem),
  ];
  return items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}

/**
 * The report the dashboard reads. Counts are over every unit the type and
 * visibility filters keep, before the status filter, so the tabs say how many
 * of each there are whichever tab is open. The status filter keeps an item when
 * any of its units has a wanted status, and keeps only those units.
 */
export function report(all: TranslationItem[], filter: TranslationFilter = {}): TranslationReport {
  const scoped = all.filter(
    (i) => (!filter.type?.length || filter.type.includes(i.type)) && (!filter.visibility || i.visibility === filter.visibility),
  );
  const counts = countUnits(scoped);
  const wanted = filter.status?.length ? new Set(filter.status) : null;
  const items = wanted
    ? scoped.flatMap((i) => {
        const units = i.units.filter((u) => wanted.has(u.status));
        return units.length ? [{ ...i, units }] : [];
      })
    : scoped;
  return { counts, coverage: coverage(counts), items };
}
