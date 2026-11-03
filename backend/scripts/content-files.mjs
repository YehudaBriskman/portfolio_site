/*
 * Reads the reviewed content drafts in `backend/content/`.
 *
 * One file per area (`areas/<slug>.json`) and one per note
 * (`posts/<area>/<slug>.md`). A note is Markdown with a JSON header between
 * two `---` lines: JSON rather than YAML because the backend has no YAML
 * parser and this is not worth a dependency, and because JSON cannot
 * silently turn `no` into `false`.
 *
 * Plain JavaScript with no dependencies on purpose. Three things read it:
 * `seed-dev-content.mjs` and `import-content.mjs`, which run under bare
 * `node`, and `src/content/drafts.test.ts`, which validates every file
 * against the zod schemas the API itself uses. Nothing here validates; that
 * is the test's job and, at write time, the API's.
 *
 * The header's `sources` list is for review only (docs/content-review.md
 * cites it) and is never sent to the API.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

/** ~200 wpm, rounded, floor of one. The same sum as `readingMinutes` in src/schemas/content.ts. */
export function readingMinutes(body) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

export function wordCount(body) {
  return body.trim().split(/\s+/).length;
}

/** Splits a note into its JSON header and Markdown body. Throws on a malformed file. */
export function parseNote(text, file = "<note>") {
  const normalised = text.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) throw new Error(`${file}: must start with a --- line`);
  const end = normalised.indexOf("\n---\n", 4);
  if (end === -1) throw new Error(`${file}: no closing --- line after the header`);
  let meta;
  try {
    meta = JSON.parse(normalised.slice(4, end));
  } catch (e) {
    throw new Error(`${file}: header is not valid JSON (${e.message})`);
  }
  const body = normalised.slice(end + 5).trim();
  return { meta, body };
}

function listFiles(dir, ext) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(ext))
    .sort()
    .map((n) => join(dir, n));
}

/**
 * Everything under `root`, in a stable order.
 * @returns {{ areas: {file: string, data: any}[], posts: {file: string, folder: string, meta: any, body: string}[] }}
 */
export function loadContent(root = CONTENT_DIR) {
  const areas = listFiles(join(root, "areas"), ".json").map((file) => ({
    file,
    data: JSON.parse(readFileSync(file, "utf8")),
  }));

  const postsDir = join(root, "posts");
  let folders = [];
  try {
    folders = readdirSync(postsDir)
      .filter((n) => statSync(join(postsDir, n)).isDirectory())
      .sort();
  } catch {
    folders = [];
  }
  const posts = folders.flatMap((folder) =>
    listFiles(join(postsDir, folder), ".md").map((file) => ({
      file,
      folder,
      ...parseNote(readFileSync(file, "utf8"), file),
    }))
  );
  return { areas, posts };
}

/** The body of `PUT /api/admin/collections/:slug`. Exactly the fields that route accepts. */
export function toCollectionWrite(area) {
  const { slug, title, tagline, kind, repo, description, coverImage, links, order, status } = area;
  return { slug, title, tagline, kind, repo, description, coverImage, links, order, status };
}

/**
 * The body of `PUT /api/admin/posts/:slug`. `readingMinutes` is left out
 * because the API computes it from the body; `sources` because it is review
 * material, not content.
 */
export function toPostWrite(post) {
  const m = post.meta;
  return {
    slug: m.slug,
    title: m.title,
    subtitle: m.subtitle ?? null,
    excerpt: m.excerpt,
    body: post.body,
    status: m.status,
    tags: m.tags,
    collection: m.collection,
    coverImage: m.coverImage ?? null,
    links: m.links ?? [],
    publishedAt: m.publishedAt ?? null,
    featured: m.featured ?? null,
  };
}

export const noteSlugFromFile = (file) => basename(file, ".md");
export const areaSlugFromFile = (file) => basename(file, ".json");
