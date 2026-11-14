import type { AdminPost, PostContent } from "@/services/admin";

/** The editable content of a stored note: its draft when it has one. Shared by the editor and the phone list's bulk "Move to drafts". */
export function contentOf(p: AdminPost, useDraft: boolean): PostContent {
  if (useDraft && p.draft) return p.draft;
  return {
    title: p.title, subtitle: p.subtitle, excerpt: p.excerpt, body: p.body, tags: p.tags, collection: p.collection,
    coverImage: p.coverImage, links: p.links, featured: p.featured, publishedAt: p.publishedAt, seo: p.seo,
    he: p.he ?? null,
  };
}
