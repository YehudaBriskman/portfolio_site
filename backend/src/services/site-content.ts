import { couch, CouchError } from "../db/couch.js";
import { CONTENT_SEED } from "../content/seed.js";
import {
  BUNDLE_FIELD,
  CONTENT_KEYS,
  CONTENT_SCHEMAS,
  ProjectsContentSchema,
  SiteCopySchema,
  StoryContentSchema,
  type ContentBundle,
  type ContentDoc,
  type ContentKey,
} from "../schemas/site-content.js";

/*
 * The site's content documents (#163): read, seed, and the fallback.
 *
 * One document per key, `content:<key>`. `published` is what the site shows;
 * `draft` is the owner's work in progress, which only the admin and its
 * preview read.
 *
 * THE FALLBACK
 * ------------
 * A key with no document reads as the seed, which is the data files the site
 * was built from before #163. So an environment whose store was never seeded
 * renders exactly what it rendered before, and seeding is a write of what is
 * already being served rather than a change anyone can see. A document that
 * exists but no longer parses (hand-edited in Fauxton, say) also reads as the
 * seed, and says so in the log, rather than taking the home page down.
 */

export const contentId = (key: ContentKey) => `content:${key}`;

const SEED = (() => {
  const raw = CONTENT_SEED as Record<string, unknown>;
  return {
    projects: ProjectsContentSchema.parse(raw.projects),
    story: StoryContentSchema.parse(raw.story),
    siteCopy: SiteCopySchema.parse(raw.siteCopy),
  } satisfies ContentBundle;
})();

/** The seed for one key, already parsed. */
export function seedFor(key: ContentKey): unknown {
  return SEED[BUNDLE_FIELD[key]];
}

export async function getContentDoc(key: ContentKey): Promise<ContentDoc | null> {
  try {
    return await couch.get<ContentDoc>(contentId(key));
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

function parsedOr<K extends ContentKey>(key: K, value: unknown): unknown {
  const parsed = CONTENT_SCHEMAS[key].safeParse(value);
  return parsed.success ? parsed.data : seedFor(key);
}

/** What the public site shows, every key, with the seed under any gap. */
export async function publishedBundle(): Promise<ContentBundle> {
  const docs = await Promise.all(CONTENT_KEYS.map((k) => getContentDoc(k)));
  const out = { ...SEED } as Record<keyof ContentBundle, unknown>;
  CONTENT_KEYS.forEach((k, i) => {
    const doc = docs[i];
    if (doc) out[BUNDLE_FIELD[k]] = parsedOr(k, doc.published);
  });
  return out as ContentBundle;
}

/**
 * The public bundle, or the seed when the store cannot be read at all.
 *
 * For the crawler renders in seo.route.ts, which must answer even with the
 * store down: the same rule the web follows, where a dead API leaves the
 * data files on the page.
 */
export async function publishedBundleOrSeed(): Promise<ContentBundle> {
  try {
    return await publishedBundle();
  } catch {
    return SEED;
  }
}

/** The drafts where there are any, published elsewhere: what a preview shows. */
export async function previewBundle(): Promise<ContentBundle> {
  const docs = await Promise.all(CONTENT_KEYS.map((k) => getContentDoc(k)));
  const out = { ...SEED } as Record<keyof ContentBundle, unknown>;
  CONTENT_KEYS.forEach((k, i) => {
    const doc = docs[i];
    if (doc) out[BUNDLE_FIELD[k]] = parsedOr(k, doc.draft ?? doc.published);
  });
  return out as ContentBundle;
}

/**
 * Writes the seed for every key that has no document. Never touches one that
 * exists, whoever wrote it, so running it twice, or after the owner has
 * edited, changes nothing.
 *
 * The create is a PUT with no revision, which CouchDB refuses with 409 when
 * the document exists, so even two seeds racing cannot overwrite one another
 * or an edit that lands between the read and the write.
 */
export async function seedContent(now = new Date().toISOString()): Promise<{ created: ContentKey[]; kept: ContentKey[] }> {
  const created: ContentKey[] = [];
  const kept: ContentKey[] = [];
  for (const key of CONTENT_KEYS) {
    const doc: ContentDoc = {
      _id: contentId(key),
      type: "content",
      key,
      published: seedFor(key),
      draft: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      source: "seed",
    };
    try {
      await couch.put(doc._id, doc);
      created.push(key);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) {
        kept.push(key);
        continue;
      }
      throw e;
    }
  }
  return { created, kept };
}
