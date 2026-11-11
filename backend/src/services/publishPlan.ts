import { rawImageUrlOrNull, readingMinutes, type Post, type PostContent } from "../schemas/content.js";
import { LINK_LABEL_PATHS, POST_FIELDS, postEnglish, stampHebrewMeta, type HebrewMeta } from "../schemas/i18n.js";

/** A published note's live content, in the shape a save sends. */
export function liveContent(p: Post): PostContent {
  return {
    title: p.title,
    subtitle: p.subtitle ?? null,
    excerpt: p.excerpt ?? "",
    body: p.body ?? "",
    tags: p.tags ?? [],
    collection: p.collection,
    coverImage: p.coverImage ?? null,
    links: p.links ?? [],
    featured: p.featured ?? null,
    publishedAt: p.publishedAt ?? null,
    seo: p.seo ?? { title: null, description: null, canonical: null, noindex: false },
    he: p.he ?? null,
  } as PostContent;
}

/** Equal as content: the fingerprints are bookkeeping, not an edit. */
export function sameContent(a: PostContent, b: PostContent): boolean {
  const strip = (c: PostContent) => fromContent({ ...c, heMeta: null });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

const POST_HE_FIELDS = [...POST_FIELDS.map((f) => f.field), ...LINK_LABEL_PATHS];

export type HeVersion = { he: Record<string, unknown> | null | undefined; meta: HebrewMeta | null | undefined };

/** The earlier Hebrew of a note, most recent first: its draft, then what is published. */
export function postVersions(existing: Post | null): HeVersion[] {
  if (!existing) return [];
  return [
    { he: existing.draft?.he, meta: existing.draft?.heMeta },
    { he: existing.he, meta: existing.heMeta },
  ];
}

/*
 * The note's content with its Hebrew fingerprints stamped (#303): kept where
 * the Hebrew is unchanged from an earlier version, new where it was written in
 * this save. Whatever the client sent as `heMeta` is replaced.
 */
export function stampPost(content: PostContent, prevs: HeVersion[]): PostContent {
  return { ...content, heMeta: stampHebrewMeta(content.he, postEnglish(content), prevs, POST_HE_FIELDS) };
}

export function fromContent(c: PostContent) {
  return {
    title: c.title,
    subtitle: c.subtitle,
    excerpt: c.excerpt || c.body.replace(/[#*`>_[\]-]/g, "").slice(0, 300),
    body: c.body,
    tags: c.tags,
    collection: c.collection,
    coverImage: rawImageUrlOrNull(c.coverImage),
    links: c.links,
    featured: c.featured,
    seo: c.seo,
    he: c.he && Object.values(c.he).some((v) => typeof v === "string" && v.trim()) ? c.he : null,
    heMeta: c.heMeta ?? null,
    readingMinutes: readingMinutes(c.body),
  };
}

export type PublishScope = "both" | "en" | "he";

/**
 * What a publish does: `content` goes live (the whole edit, or one language of
 * it over what is live); `waiting` is the whole edit kept as a draft when it
 * holds more than went live, else null. Null when scope "he" has nothing live
 * to put Hebrew over.
 */
export function planPublish(
  existing: Post | null,
  input: PostContent,
  scope: PublishScope,
): { content: PostContent; waiting: PostContent | null } | null {
  const live = existing?.status === "published" ? liveContent(existing) : null;
  if (scope === "he" && !live) return null;
  const going: PostContent =
    scope === "both" ? input : scope === "he" ? { ...(live as PostContent), he: input.he } : { ...input, he: live?.he ?? null };
  const content = stampPost(going, postVersions(existing));
  if (scope === "both") return { content, waiting: null };
  const rest = stampPost(input, [{ he: content.he, meta: content.heMeta }, ...postVersions(existing)]);
  return { content, waiting: sameContent(rest, content) ? null : rest };
}
