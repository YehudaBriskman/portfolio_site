import { COLLECTION_FIELDS, POST_FIELDS, fp, isText, type HebrewMeta } from "../schemas/i18n.js";

/*
 * The fingerprint backfill (#303), as pure functions; the script that runs it
 * is scripts/backfill-he-fingerprints.ts.
 *
 * For every piece of Hebrew in the store that has no fingerprint yet, it
 * records the fingerprint of the English beside it today. That asserts the
 * Hebrew is current, which is true when it runs: the only Hebrew in the store
 * was written by the copy review (#290) against today's English. After it,
 * nothing reads as "unverified", and the next English edit shows as stale.
 *
 * Additive and idempotent: it only fills a fingerprint that is absent, never
 * replaces one, and never touches a word of text. A second run changes nothing.
 */

type Raw = Record<string, unknown>;

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export type BackfillChange = { id: string; units: string[]; next: Raw };

/** The meta for one `he` block, with each missing fingerprint filled. */
function fillMeta(he: unknown, en: Raw, meta: unknown, fields: readonly string[], units: string[], prefix: string): HebrewMeta | null {
  if (!he || typeof he !== "object") return (meta as HebrewMeta | null) ?? null;
  const h = he as Raw;
  const m = (meta && typeof meta === "object" ? structuredClone(meta) : { src: {} }) as HebrewMeta;
  m.src = { ...(m.src ?? {}) };
  let changed = false;
  for (const field of fields) {
    if (!filled(h[field]) || !filled(en[field]) || m.src[field]) continue;
    m.src[field] = fp(en[field] as string);
    units.push(`${prefix}${field}`);
    changed = true;
    if (field === "body" && !m.bodyBase) m.bodyBase = en.body as string;
  }
  if (!changed && !meta) return null;
  return m;
}

/** Fills every absent `heSrc` inside a value, in place. */
function fillTexts(value: unknown, path: string, units: string[]) {
  if (isText(value)) {
    if (filled(value.he) && !value.heSrc && filled(value.en)) {
      (value as Raw).heSrc = fp(value.en);
      units.push(path);
    }
    return;
  }
  if (Array.isArray(value)) value.forEach((v, i) => fillTexts(v, `${path}.${i}`, units));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) fillTexts(v, path ? `${path}.${k}` : k, units);
}

/** What the backfill would change in one document, or null for nothing. */
export function backfillDoc(doc: Raw): BackfillChange | null {
  const units: string[] = [];
  const next = structuredClone(doc);
  if (doc.type === "post") {
    const fields = POST_FIELDS.map((f) => f.field);
    next.heMeta = fillMeta(next.he, next, next.heMeta, fields, units, "");
    const draft = next.draft as Raw | null | undefined;
    if (draft && typeof draft === "object") draft.heMeta = fillMeta(draft.he, draft, draft.heMeta, fields, units, "draft.");
  } else if (doc.type === "collection") {
    next.heMeta = fillMeta(next.he, next, next.heMeta, COLLECTION_FIELDS.map((f) => f.field), units, "");
  } else if (doc.type === "content") {
    fillTexts(next.published, "published", units);
    fillTexts(next.draft, "draft", units);
  } else {
    return null;
  }
  if (!units.length) return null;
  /* A meta the walk created with nothing in it is not a change. */
  if (next.heMeta === null && doc.heMeta === undefined) delete next.heMeta;
  const draft = next.draft as Raw | null | undefined;
  if (draft && typeof draft === "object" && draft.heMeta === null && (doc.draft as Raw).heMeta === undefined) delete draft.heMeta;
  return { id: String(doc._id), units, next };
}
