import type { Post } from "../schemas/content.js";
import { postHasHebrew } from "./seo-translation.js";

/*
 * Which notes a note's server HTML links to, chosen only from what is stored
 * and in a fixed order, so the same data always yields the same links and a
 * crawler is not handed a different graph on every fetch.
 */
export type LinkablePost = {
  slug: string;
  publishedAt: string | null;
  tags: string[];
  collection: string;
};

/** Newest first; the slug breaks a tie so the order never depends on the store's. */
export function newestFirst(a: LinkablePost, b: LinkablePost): number {
  const t = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  return t !== 0 ? t : a.slug.localeCompare(b.slug);
}

/** The next older and the next newer note than `post`. */
export function neighbours<T extends LinkablePost>(post: LinkablePost, all: T[]): { prev: T | null; next: T | null } {
  const sorted = [...all].sort(newestFirst);
  const i = sorted.findIndex((p) => p.slug === post.slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: sorted[i + 1] ?? null, next: sorted[i - 1] ?? null };
}

/**
 * Up to `limit` other notes that share a tag or the area, most in common
 * first. A note with nothing in common is not "related", so there may be fewer.
 */
export function relatedPosts<T extends LinkablePost>(post: LinkablePost, all: T[], limit = 5): T[] {
  const mine = new Set(post.tags);
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, score: p.tags.filter((t) => mine.has(t)).length * 2 + (p.collection === post.collection ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || newestFirst(a.p, b.p))
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * The notes a page may link to: the sitemap's own rule. Published, not noindex,
 * and on the Hebrew page only those with published Hebrew, since the rest are
 * noindex there and a link to them is a link to a page that is not offered.
 * Takes the English documents, before any Hebrew is laid over them.
 */
export function linkablePosts(posts: Post[], lang: "en" | "he"): Post[] {
  return posts.filter((p) => p.status === "published" && !p.seo.noindex && (lang === "en" || postHasHebrew(p)));
}
