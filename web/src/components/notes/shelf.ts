import type { Size } from "@/components/gallery/Wall";
import {
  facetOptions,
  matchesSelection,
  type FacetOption,
  type Selection,
} from "@/components/gallery/facets";
import type { PostSummary } from "@/services/blog";

/*
 * The notes as a filterable shelf (#193): which facets a note has, how the
 * search reads it, and what size it hangs at. No React, so it is tested
 * without a renderer; the URL and counting rules are `gallery/facets.ts`.
 *
 * WHAT THE API GIVES TO FILTER BY
 * -------------------------------
 * `GET /api/blog/posts` returns every published summary (up to 100) with
 * `tags`, `publishedAt` and `collection` (`site` or a project's slug). Those
 * are the three facets: Topic (`?tag=`, the name the old tag links already
 * used), Year (`?year=`) and Filed under (`?collection=`, ditto). All three
 * are applied here, on the client, to the one list fetched once, so a count
 * can be shown before a choice is made and a filter costs no request.
 *
 * SEARCH, AND WHEN IT EARNS ITS PLACE
 * -----------------------------------
 * A search box over six notes is a box that finds what the eye already has.
 * It is offered from `SEARCH_FROM` notes up — about two screens of wall, the
 * point where scanning stops being quicker than typing — and it matches every
 * word typed, anywhere in the title, subtitle, excerpt or tags.
 */

export type NoteFacet = "tag" | "year" | "collection";
export const NOTE_FACETS: NoteFacet[] = ["tag", "year", "collection"];

export const SEARCH_FROM = 10;

export function noteValues(post: PostSummary, facet: NoteFacet): string[] {
  if (facet === "tag") return post.tags;
  if (facet === "year") return post.publishedAt ? [post.publishedAt.slice(0, 4)] : [];
  return [post.collection];
}

export function matchesQuery(post: PostSummary, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [post.title, post.subtitle ?? "", post.excerpt, ...post.tags].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function filterNotes(posts: PostSummary[], sel: Selection<NoteFacet>, q: string): PostSummary[] {
  return posts.filter((p) => matchesSelection(p, sel, NOTE_FACETS, noteValues) && matchesQuery(p, q));
}

/**
 * Every value the shelf has is offered, so a topic does not vanish from the
 * list while the reader types; its count is taken through the search as
 * well as the other facets, so it agrees with the wall.
 */
export function noteOptions(posts: PostSummary[], facet: NoteFacet, sel: Selection<NoteFacet>, q: string): FacetOption[] {
  const order = facet === "year" ? "desc" : facet === "tag" ? "count" : "first-seen";
  return facetOptions(posts, facet, sel, NOTE_FACETS, noteValues, { order, also: (p) => matchesQuery(p, q) });
}

/*
 * Size is data, as it is for a project: the newest note is the lead (2x2),
 * a note with a real cover is wide (its picture beside its words), and the
 * rest are tiles. Decided over the whole shelf, so a filter never resizes a
 * note.
 */
export function sizesOfNotes(posts: PostSummary[]): Map<string, Size> {
  const newest = [...posts].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0]?.slug;
  return new Map(posts.map((p) => [p.slug, p.slug === newest ? "lead" : p.coverImage ? "wide" : "tile"]));
}

/** The rail's index: the notes on the wall, newest year first. */
export function byYear(posts: PostSummary[]): { label: string; items: PostSummary[] }[] {
  const groups = new Map<string, PostSummary[]>();
  for (const p of posts) {
    const y = p.publishedAt?.slice(0, 4) ?? "Undated";
    groups.set(y, [...(groups.get(y) ?? []), p]);
  }
  return [...groups]
    .sort(([a], [b]) => (a === "Undated" ? 1 : b === "Undated" ? -1 : b.localeCompare(a)))
    .map(([label, items]) => ({ label, items }));
}
