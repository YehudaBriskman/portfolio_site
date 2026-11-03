import { couch, CouchError } from "../db/couch.js";
import type { Collection, Post } from "../schemas/content.js";
import {
  COLLECTION_FIELDS,
  POST_FIELDS,
  atPath,
  collectionTranslation,
  fp,
  isText,
  normaliseSource,
  type HebrewMeta,
  countUnits,
  coverage,
  itemStatus,
  postTranslation,
  textUnits,
  type TranslationCounts,
  type TranslationItem,
  type TranslationStatus,
  type TranslationType,
} from "../schemas/i18n.js";
import { CONTENT_KEYS, type ContentKey } from "../schemas/site-content.js";
import { getContentDoc, seedFor } from "./site-content.js";

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

const POST_HE = new Set<string>(POST_FIELDS.map((f) => f.field));
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
  if (input.type === "post" || input.type === "area") {
    const fields = input.type === "post" ? POST_HE : AREA_HE;
    if (!fields.has(input.path)) return notFound;
    const id = `${input.type === "post" ? "post" : "collection"}:${input.id}`;
    const doc = await tryGet<HeDoc>(id);
    if (!doc) return notFound;
    if (doc._rev !== input.rev) return conflictAck;
    const field = input.path;
    const he = doc.he;
    const en = doc[field];
    if (input.type === "post" && doc.status !== "published") return nothingLive;
    if (!he || typeof he[field] !== "string" || !(he[field] as string).trim() || typeof en !== "string") return nothingLive;

    const before = structuredClone(doc);
    const meta: HebrewMeta = { ...(doc.heMeta ?? {}), src: { ...(doc.heMeta?.src ?? {}), [field]: fp(en) } };
    if (field === "body") meta.bodyBase = en;
    const next: HeDoc = { ...doc, heMeta: meta };
    const draft = doc.draft;
    if (input.type === "post" && draft?.he && same(draft.he[field], he[field]) && same(draft[field], en)) {
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
  const [posts, areas, content] = await Promise.all([
    couch.find<Post>({ selector: { type: "post" }, limit: 1000 }),
    couch.find<Collection>({ selector: { type: "collection" }, limit: 300 }),
    contentItems(),
  ]);
  const items = [...content, ...areas.docs.map(areaItem), ...posts.docs.filter((p) => p.status !== "archived").map(postItem)];
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
