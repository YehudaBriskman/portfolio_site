import { couch, CouchError } from "../db/couch.js";
import {
  SiteReleasesSchema,
  toPublicCollection,
  type Collection,
  type Post,
  type SiteRelease,
  type SiteReleases,
} from "../schemas/content.js";

/*
 * One ordered feed of what happened on the site (#223), and the areas ranked
 * by it. The backend for the Blogs and Work dashboards.
 *
 * Everything here is derived from what is already stored: published posts,
 * the areas and their scheduled repo stats, and the site's own releases (also
 * stored by the schedule). Nothing is read from GitHub at request time.
 *
 * The public boundary is the same as `toPublicSummary`: a draft, an archived
 * post or a hidden area never becomes an event. The store is asked for
 * published documents only, and the builder filters again, so a selector
 * mistake cannot turn into a leak on its own.
 */

export const ACTIVITY_KINDS = ["post", "release", "push", "site", "area"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityEvent = {
  /** Stable and unique: the cursor is built from it. */
  id: string;
  kind: ActivityKind;
  /** ISO 8601, UTC. */
  at: string;
  area: { slug: string; title: string } | null;
  title: string;
  /** A site path for posts and areas, an absolute GitHub URL for repo events. */
  href: string;
  meta: Record<string, unknown>;
};

export type Snapshot = {
  /** Published posts. Anything else passed in is dropped. */
  posts: Post[];
  /** Every area, hidden ones included, so their posts can be held back. */
  collections: Collection[];
  siteReleases: SiteRelease[];
};

/* Bounds on what one request reads. The site has tens of notes, not thousands. */
const POST_LIMIT = 500;
const COLLECTION_LIMIT = 200;

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const isPublicArea = (c: Collection) => c.status === "published";

/** Newest first; the id breaks ties so the order (and the cursor) is total. */
function compare(a: ActivityEvent, b: ActivityEvent): number {
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function buildEvents(snap: Snapshot): ActivityEvent[] {
  const publicAreas = snap.collections.filter(isPublicArea);
  const hidden = new Set(snap.collections.filter((c) => !isPublicArea(c)).map((c) => c.slug));
  const areaRef = new Map(publicAreas.map((c) => [c.slug, { slug: c.slug, title: c.title }]));
  const events: ActivityEvent[] = [];

  for (const p of snap.posts) {
    if (p.status !== "published") continue;
    const collection = p.collection ?? "site";
    // A note on a hidden shelf stays out of the feed with its shelf.
    if (hidden.has(collection)) continue;
    const at = iso(p.publishedAt);
    if (!at) continue;
    events.push({
      id: `post:${p.slug}`,
      kind: "post",
      at,
      area: areaRef.get(collection) ?? null,
      title: p.title,
      href: `/blog/${p.slug}`,
      meta: {
        slug: p.slug,
        excerpt: p.excerpt,
        tags: p.tags ?? [],
        readingMinutes: p.readingMinutes,
        featured: p.featured ?? null,
      },
    });
  }

  for (const c of publicAreas) {
    const area = { slug: c.slug, title: c.title };
    const { repoUrl } = toPublicCollection(c);

    const created = iso(c.createdAt);
    if (created) {
      events.push({
        id: `area:${c.slug}`,
        kind: "area",
        at: created,
        area,
        title: c.title,
        href: `/blog/area/${c.slug}`,
        meta: { kind: c.kind ?? (c.slug === "site" ? "site" : "project"), tagline: c.tagline ?? "" },
      });
    }

    const rel = c.stats?.latestRelease;
    const relAt = iso(rel?.publishedAt);
    if (rel && relAt) {
      events.push({
        id: `release:${c.slug}:${rel.tag}`,
        kind: "release",
        at: relAt,
        area,
        title: rel.tag,
        href: rel.url,
        meta: { tag: rel.tag, repoUrl },
      });
    }

    /*
     * The stats hold only the latest push, so this is one event per area; the
     * day in the id is what keeps it to at most one per area per day should
     * the stored history ever grow.
     */
    const pushed = iso(c.stats?.pushedAt);
    if (pushed && repoUrl) {
      events.push({
        id: `push:${c.slug}:${pushed.slice(0, 10)}`,
        kind: "push",
        at: pushed,
        area,
        title: `Pushed to ${c.repo?.name ?? c.title}`,
        href: repoUrl,
        meta: { repoUrl },
      });
    }
  }

  // The site's own releases belong to the site's area, when that is public.
  const siteArea = areaRef.get("site") ?? null;
  for (const r of snap.siteReleases) {
    const at = iso(r.publishedAt);
    if (!at) continue;
    events.push({
      id: `site:${r.tag}`,
      kind: "site",
      at,
      area: siteArea,
      title: r.name || r.tag,
      href: r.url,
      meta: { tag: r.tag },
    });
  }

  return events.sort(compare);
}

/* ------------------------------------------------------------------ cursor */

/*
 * Opaque to the client: base64url of [at, id] of the last event on the page.
 * Keyset rather than offset, so an event published between two page loads
 * does not shift the next page and repeat a row.
 */
export function encodeCursor(e: Pick<ActivityEvent, "at" | "id">): string {
  return Buffer.from(JSON.stringify([e.at, e.id])).toString("base64url");
}

export function decodeCursor(cursor: string): { at: string; id: string } | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [at, id] = value as unknown[];
    if (typeof at !== "string" || typeof id !== "string" || !iso(at)) return null;
    return { at, id };
  } catch {
    return null;
  }
}

export type ActivityPage = { items: ActivityEvent[]; nextCursor: string | null };

export function pageEvents(
  events: ActivityEvent[],
  opts: { limit: number; before?: { at: string; id: string }; area?: string; kinds?: ActivityKind[] },
): ActivityPage {
  const { before, area, kinds } = opts;
  const matching = events.filter(
    (e) =>
      (!kinds || kinds.includes(e.kind)) &&
      (!area || e.area?.slug === area) &&
      (!before || compare(e, { ...e, at: before.at, id: before.id }) > 0),
  );
  const items = matching.slice(0, opts.limit);
  const last = items[items.length - 1];
  return { items, nextCursor: matching.length > items.length && last ? encodeCursor(last) : null };
}

/* ------------------------------------------------------------------- areas */

export type PublicArea = ReturnType<typeof toPublicCollection> & {
  noteCount: number;
  lastActivityAt: string | null;
  topics: { tag: string; count: number }[];
};

/** Public areas with note counts, most recently active first. */
export function buildAreas(snap: Snapshot, events: ActivityEvent[] = buildEvents(snap)): PublicArea[] {
  const last = new Map<string, string>();
  // Events are newest first, so the first one seen per area is its latest.
  for (const e of events) if (e.area && !last.has(e.area.slug)) last.set(e.area.slug, e.at);

  return snap.collections
    .filter(isPublicArea)
    .map((c) => {
      const notes = snap.posts.filter((p) => p.status === "published" && (p.collection ?? "site") === c.slug);
      const counts = new Map<string, number>();
      notes.forEach((p) => (p.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
      return {
        ...toPublicCollection(c),
        noteCount: notes.length,
        lastActivityAt: last.get(c.slug) ?? null,
        topics: [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      };
    })
    .sort(
      (a, b) =>
        (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") ||
        a.order - b.order ||
        a.slug.localeCompare(b.slug),
    );
}

/* ------------------------------------------------------------------- store */

export async function loadSiteReleases(): Promise<SiteReleases | null> {
  try {
    const parsed = SiteReleasesSchema.safeParse(await couch.get<unknown>("site-releases"));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    // Not fetched yet is an empty list, not a failure.
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

/** Everything the feed is built from, read in parallel and bounded. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [posts, collections, site] = await Promise.all([
    couch.find<Post>({
      selector: { type: "post", status: "published" },
      sort: [{ type: "desc" as const }, { status: "desc" as const }, { publishedAt: "desc" as const }],
      limit: POST_LIMIT,
    }),
    couch.find<Collection>({ selector: { type: "collection" }, limit: COLLECTION_LIMIT }),
    // The site's releases are one source among five: if that one document
    // cannot be read, the feed goes without them rather than failing whole.
    loadSiteReleases().catch(() => null),
  ]);
  return { posts: posts.docs, collections: collections.docs, siteReleases: site?.items ?? [] };
}
