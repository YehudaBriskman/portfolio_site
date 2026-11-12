import { createHash } from "node:crypto";

/*
 * The date a page's CONTENT last changed, per language. `updatedAt` moves on
 * every save (a status flip, an seo flag, a translation stamp, a bulk
 * re-import), and publishing it as <lastmod> / dateModified teaches Google that
 * the value means nothing. This keeps a fingerprint of what a reader sees next
 * to the date it last changed, and moves the date only when the fingerprint does.
 */

export type Lang = "en" | "he";
export type ContentStamp = { hash: string; at: string };
export type ContentMod = { en?: ContentStamp; he?: ContentStamp };

type Stampable = {
  updatedAt?: string | null;
  contentMod?: ContentMod | null;
  he?: Record<string, unknown> | null;
  [k: string]: unknown;
};

const EN_FIELDS = ["title", "subtitle", "excerpt", "body", "tagline", "description", "coverImage", "tags"];
const HE_FIELDS = ["title", "subtitle", "excerpt", "body", "tagline", "description"];

const pick = (src: Record<string, unknown> | null | undefined, keys: string[]) =>
  keys.map((k) => (src ? src[k] ?? null : null));

const sha = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);

/** Fingerprint of what the reader sees in one language; null when there is no Hebrew at all. */
export function contentHash(doc: Stampable | null | undefined, lang: Lang): string | null {
  if (!doc) return null;
  if (lang === "en") return sha(pick(doc, EN_FIELDS));
  const he = doc.he;
  if (!he || !HE_FIELDS.some((k) => typeof he[k] === "string" && (he[k] as string).trim())) return null;
  return sha(pick(he, HE_FIELDS));
}

/**
 * Returns `next` carrying a `contentMod` that moves a language's date to `now`
 * only when its content differs from `prev`. A `prev` written before this
 * field existed is compared by content and, if unchanged, keeps its
 * `updatedAt`, so nothing needs migrating.
 */
export function stampContentModified<T extends Stampable>(prev: Stampable | null | undefined, next: T, now: string): T {
  const out: ContentMod = {};
  for (const lang of ["en", "he"] as const) {
    const hash = contentHash(next, lang);
    if (hash === null) continue;
    const before = prev?.contentMod?.[lang];
    let at = now;
    if (before && before.hash === hash) at = before.at;
    else if (!before && prev && contentHash(prev, lang) === hash) at = prev.updatedAt || now;
    out[lang] = { hash, at };
  }
  return { ...next, contentMod: out };
}

/** The one place a page's modified date is read: sitemap, JSON-LD, article:modified_time. */
export function contentModifiedAt(doc: Stampable, lang: Lang = "en"): string | undefined {
  return doc.contentMod?.[lang]?.at ?? doc.updatedAt ?? undefined;
}

/** The newest content date across docs and languages, for index pages. */
export function newestContentModified(docs: Stampable[]): string | undefined {
  return docs
    .flatMap((d) => [contentModifiedAt(d, "en"), contentModifiedAt(d, "he")])
    .filter((x): x is string => Boolean(x))
    .sort()
    .pop();
}
