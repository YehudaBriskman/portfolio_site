import { couch } from "../db/couch.js";
import type { MediaDoc } from "./media.js";
import { mentionsMedia } from "./media.js";

/*
 * Which media the public may fetch (#876).
 *
 * Every item has a `visibility`: `draft` (private) or `public`. A NEW upload
 * starts as a draft. An item is served to the public when
 *   - its visibility is `public` (set by the owner, or by the migration that
 *     stamped every item that existed before this field), or
 *   - the field is ABSENT (an old document: public, so no page can break), or
 *   - a PUBLISHED post, area, project, story or site-copy mentions it.
 * That last rule is resolved at read time, never written: unpublish the post
 * and the picture is a draft again with nothing to undo, the way un-hiding an
 * area restores its notes (services/public-notes.ts).
 *
 * "Published" means what the public routes already mean: a post that is
 * published and whose area is not hidden, an area that is published, and the
 * `published` half of a content document. A post's unpublished `draft` edits
 * and an unpublished note never count.
 *
 * A draft is served to the signed-in admin only (controllers/media.controller.ts);
 * anyone else gets the exact 404 of a file that does not exist.
 */

export type Visibility = "draft" | "public";

/** What the document says; a document with no field is public. */
export const visibilityOf = (doc: Pick<MediaDoc, "visibility">): Visibility => (doc.visibility === "draft" ? "draft" : "public");

type Raw = Record<string, unknown>;

/** The JSON of everything the public can read, as one string per document. */
export function publicContentBlobs(docs: Raw[]): string[] {
  const hidden = new Set(
    docs.filter((d) => d.type === "collection" && d.status !== "published").map((d) => String(d.slug)),
  );
  const out: string[] = [];
  for (const d of docs) {
    if (d.type === "post") {
      if (d.status !== "published" || hidden.has(typeof d.collection === "string" ? d.collection : "site")) continue;
      const { draft: _draft, draftSavedAt: _saved, ...live } = d;
      out.push(JSON.stringify(live));
    } else if (d.type === "collection") {
      if (d.status === "published") out.push(JSON.stringify(d));
    } else if (d.type === "content") {
      if (d.published !== undefined) out.push(JSON.stringify(d.published));
    }
  }
  return out;
}

const TTL_MS = 10_000;
let cache: { at: number; blobs: Promise<string[]> } | null = null;

export function resetPublicContentCache() {
  cache = null;
}

async function loadBlobs(): Promise<string[]> {
  const { docs } = await couch.find<Raw>({
    selector: { type: { $in: ["post", "collection", "content"] } },
    limit: 5000,
  });
  return publicContentBlobs(docs);
}

/*
 * One scan serves every request for ten seconds: a published page full of
 * draft-uploaded pictures would otherwise scan the store once per picture. A
 * failed scan is not kept.
 */
export function publicContentJson(now = Date.now()): Promise<string[]> {
  if (cache && now - cache.at < TTL_MS) return cache.blobs;
  const blobs = loadBlobs();
  cache = { at: now, blobs };
  blobs.catch(() => {
    if (cache?.blobs === blobs) cache = null;
  });
  return blobs;
}

/** Is this item public right now: explicitly, by absence, or by a published page? */
export async function isLive(doc: MediaDoc): Promise<boolean> {
  if (visibilityOf(doc) === "public") return true;
  return (await publicContentJson()).some((json) => mentionsMedia(json, doc.id) !== null);
}

/** The idempotent migration of one stored document: public where the field is absent. */
export function migrateVisibility(doc: Raw): Raw | null {
  if (doc.type !== "media") return null;
  if (doc.visibility === "draft" || doc.visibility === "public") return null;
  return { ...doc, visibility: "public" };
}
