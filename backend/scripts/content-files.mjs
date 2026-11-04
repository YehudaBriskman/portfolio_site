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
 *
 * HEBREW. A note's Hebrew sits beside it as `posts/<area>/<slug>.he.md`, in
 * the same shape: a JSON header (`title`, `subtitle`, `excerpt`, and
 * `linkLabels`, one per English link, in order) and the Hebrew body. An
 * area's Hebrew is an optional `he` object in its JSON: `title`, `tagline`,
 * `description` and `linkLabels`. Both are optional. They reach the API only
 * through import-content.mjs, which never replaces Hebrew the store already
 * holds unless it is told to (see import-plan.mjs).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** A note's Hebrew file: `<slug>.he.md` beside `<slug>.md`. */
export const HEBREW_SUFFIX = ".he.md";

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
    .filter((n) => n.endsWith(ext) && !n.endsWith(HEBREW_SUFFIX))
    .sort()
    .map((n) => join(dir, n));
}

/** The note's Hebrew file, parsed, or null when it has none. */
function readHebrew(file) {
  const heFile = file.slice(0, -".md".length) + HEBREW_SUFFIX;
  if (!existsSync(heFile)) return null;
  return { file: heFile, ...parseNote(readFileSync(heFile, "utf8"), heFile) };
}

/**
 * Everything under `root`, in a stable order. `orphanHebrew` lists Hebrew
 * files with no English note beside them, which the content test refuses.
 * @returns {{ areas: {file: string, data: any}[], posts: {file: string, folder: string, meta: any, body: string, he: {file: string, meta: any, body: string} | null}[], orphanHebrew: string[] }}
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
      he: readHebrew(file),
    }))
  );
  const orphanHebrew = folders.flatMap((folder) =>
    readdirSync(join(postsDir, folder))
      .filter((n) => n.endsWith(HEBREW_SUFFIX))
      .map((n) => join(postsDir, folder, n))
      .filter((f) => !existsSync(f.slice(0, -HEBREW_SUFFIX.length) + ".md"))
  );
  return { areas, posts, orphanHebrew };
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

const filled = (v) => typeof v === "string" && v.trim() !== "";

/**
 * A note's Hebrew as the API's `he` block: its fields, and each link label
 * under `links.<i>.label` (#306). Null when the note has no Hebrew file.
 * Empty fields are left out, so "no Hebrew here" never reads as "Hebrew is ''".
 */
export function toPostHebrew(post) {
  if (!post.he) return null;
  const m = post.he.meta;
  const out = {};
  for (const [k, v] of [
    ["title", m.title],
    ["subtitle", m.subtitle],
    ["excerpt", m.excerpt],
    ["body", post.he.body],
  ]) {
    if (filled(v)) out[k] = v;
  }
  (m.linkLabels ?? []).forEach((label, i) => {
    if (filled(label)) out[`links.${i}.label`] = label;
  });
  return Object.keys(out).length ? out : null;
}

/**
 * An area's Hebrew: its fields for the `he` block, and one label per English
 * link, null where a link has none. `he` is null when the area has no Hebrew.
 */
export function toCollectionHebrew(area) {
  const h = area.he ?? null;
  const he = {};
  for (const k of ["title", "tagline", "description"]) if (filled(h?.[k])) he[k] = h[k];
  const linkLabels = (area.links ?? []).map((_, i) => (filled(h?.linkLabels?.[i]) ? h.linkLabels[i] : null));
  return { he: Object.keys(he).length ? he : null, linkLabels };
}

export const noteSlugFromFile = (file) => basename(file, ".md");
export const hebrewSlugFromFile = (file) => basename(file, HEBREW_SUFFIX);
export const areaSlugFromFile = (file) => basename(file, ".json");
