import { couch } from "../db/couch.js";
import type { Collection, Post } from "../schemas/content.js";

/*
 * Which published notes the public may see.
 *
 * A note is public when it is published AND its area is not hidden (#875).
 * Hiding an area takes its notes off every public surface with it: the blog
 * API, the sitemap, the feeds, the rendered pages and the public MCP tools,
 * which read the blog API. A note with no area doc (or the default "site"
 * area, which has none) is unaffected. Un-hiding the area restores them,
 * because nothing is written to the notes.
 *
 * Every public route asks this one module; the admin routes do not, so the
 * owner still sees everything.
 */

/** Slugs of areas that exist and are not published. */
export async function hiddenAreaSlugs(): Promise<Set<string>> {
  const { docs } = await couch.find<Collection>({
    selector: { type: "collection", status: { $ne: "published" } },
    limit: 300,
  });
  return new Set(docs.filter((c) => c.type === "collection" && c.status !== "published").map((c) => c.slug));
}

/** The notes whose area is not hidden. Drafts are the caller's selector's job. */
export async function dropHiddenAreaNotes<T extends Post>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const hidden = await hiddenAreaSlugs();
  if (hidden.size === 0) return posts;
  return posts.filter((p) => !hidden.has(p.collection ?? "site"));
}

/** One note, or undefined when its area is hidden (a 404, as for a draft). */
export async function publicNoteOrUndefined<T extends Post>(post: T | undefined): Promise<T | undefined> {
  if (!post) return undefined;
  return (await dropHiddenAreaNotes([post])).length ? post : undefined;
}
