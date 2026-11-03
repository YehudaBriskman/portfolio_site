import { couch } from "../db/couch.js";
import type { Collection, Post } from "../schemas/content.js";
import {
  collectionTranslation,
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
