import { createHash } from "node:crypto";
import { z } from "zod";
import type { Collection, Post } from "./content.js";

/*
 * Translation status (#301, design docs/i18n/bilingual-content-design.md §5).
 *
 * English is the source and is always required; Hebrew is optional and falls
 * back to the English when absent. What this module adds is the one thing the
 * store could not say before: whether a piece of Hebrew still translates the
 * English beside it.
 *
 * THE FINGERPRINT
 * ---------------
 * When Hebrew is saved, the server records a fingerprint of the English it was
 * written against (`heSrc` on a `Text` field, `heMeta.src.<field>` beside a
 * note's or an area's `he` block). When the English later changes, its
 * fingerprint no longer matches and
 * the Hebrew reads as stale. The fingerprint is a hash of the normalised text,
 * not a version counter: the English has no counter, and a whitespace-only save
 * must not flag anything. Normalisation is NFC plus collapsed whitespace, no
 * more, so a real edit (one word) is always seen.
 *
 * THE VOCABULARY
 * --------------
 *   missing     no Hebrew anywhere
 *   draft       Hebrew only in an unpublished draft
 *   translated  published Hebrew, written against today's English
 *   stale       published Hebrew, written against English that has since changed
 *   unverified  published Hebrew with no fingerprint: written before #303
 *               stamped one. Treated as translated by every consumer.
 *
 * Status is computed on read, never stored. Stale Hebrew stays live (owner
 * decision on #303): a slightly old Hebrew sentence serves a Hebrew reader
 * better than the English, so staleness is shown to the owner, not the reader.
 *
 * FOR THE SEO WORK (#304)
 * -----------------------
 * `hasPublishedHebrew(status)` is the switch §5.4 needs: true means the /he page
 * carries real Hebrew (index it, pair it with hreflang, list it in the
 * sitemap); false means it is the English fallback (noindex, follow). Get the
 * status of a note from `postTranslation(post).status` and of an area from
 * `collectionTranslation(area).status`; a project's from the units under
 * `items.<i>` via `textUnits`.
 */

/** sha256 of the normalised English, first 12 hex characters. */
export const Fingerprint = z.string().regex(/^[0-9a-f]{12}$/);
export type Fingerprint = z.infer<typeof Fingerprint>;

/** NFC, whitespace collapsed, trimmed: a reflowed paragraph is the same text. */
export function normaliseSource(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function fp(text: string): Fingerprint {
  return createHash("sha256").update(normaliseSource(text), "utf8").digest("hex").slice(0, 12);
}

export const TRANSLATION_STATUSES = ["missing", "draft", "stale", "unverified", "translated"] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];
export const TranslationStatusSchema = z.enum(TRANSLATION_STATUSES);

/** Worst first: an item takes the worst status of its primary units. */
const SEVERITY: Record<TranslationStatus, number> = { missing: 4, stale: 3, draft: 2, unverified: 1, translated: 0 };

/** True when the reader of the Hebrew page gets Hebrew, not the English fallback. */
export function hasPublishedHebrew(status: TranslationStatus | null): boolean {
  return status === "translated" || status === "stale" || status === "unverified";
}

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * One unit's status. `he` is the published Hebrew, `heSrc` its fingerprint,
 * `draftHe` the Hebrew in an unpublished draft, if any.
 */
export function unitStatus(u: { en: string; he?: string | null; heSrc?: string | null; draftHe?: string | null }): TranslationStatus {
  if (filled(u.he)) {
    if (!u.heSrc) return "unverified";
    return u.heSrc === fp(u.en) ? "translated" : "stale";
  }
  return filled(u.draftHe) ? "draft" : "missing";
}

export type TranslationUnit = {
  /** Where the unit sits inside its item: `title`, `fact`, `decisions.0.body`. */
  path: string;
  status: TranslationStatus;
  /** A primary unit decides the item's status; a secondary one only counts. */
  primary: boolean;
  en: string;
  he: string | null;
  /** The Hebrew in the draft, when it differs from what is published. */
  draftHe: string | null;
};

/** The worst status among the primary units, or among all when none is primary. */
export function itemStatus(units: TranslationUnit[]): TranslationStatus | null {
  const primary = units.filter((u) => u.primary);
  const pool = primary.length ? primary : units;
  if (!pool.length) return null;
  return pool.reduce<TranslationStatus>((worst, u) => (SEVERITY[u.status] > SEVERITY[worst] ? u.status : worst), "translated");
}

function unit(path: string, primary: boolean, en: string, he: string | null | undefined, heSrc: string | null | undefined, draftHe: string | null | undefined): TranslationUnit {
  const status = unitStatus({ en, he, heSrc, draftHe });
  return {
    path,
    status,
    primary,
    en,
    he: filled(he) ? he : null,
    draftHe: filled(draftHe) && draftHe !== he ? draftHe : null,
  };
}

/* ------------------------------------------------------------------ notes */

type HebrewSrc = Partial<Record<string, string>>;

/*
 * What the server keeps beside a note's or an area's `he` block (#303), as a
 * sibling `heMeta` rather than inside the block, so every reader of `he`
 * (the public API, the server render, the MCP tools) keeps seeing only words:
 *
 *   src       per field, the fingerprint of the English the Hebrew was written against
 *   bodyBase  a note's English body the Hebrew body was written against, for
 *             the editor's "what changed in English since" view
 *
 * A note's draft carries its own `heMeta` beside `draft.he`.
 */
export type HebrewMeta = { src: HebrewSrc; bodyBase?: string | null };

/** The note's Hebrew fields, which are its translation units. */
export const POST_FIELDS = [
  { field: "title", primary: true },
  { field: "subtitle", primary: false },
  { field: "excerpt", primary: true },
  { field: "body", primary: true },
] as const;

/**
 * A note's units and status.
 *
 * On a published note the top-level fields are what the public reads, and an
 * unpublished `draft` may sit beside them. On a note that was never published
 * nothing is public, so any Hebrew it holds is a draft.
 */
export function postTranslation(post: Post): { units: TranslationUnit[]; status: TranslationStatus | null } {
  const live = post.status === "published";
  const he = (post.he ?? null) as Record<string, unknown> | null;
  const src = ((post as { heMeta?: HebrewMeta | null }).heMeta?.src ?? {}) as HebrewSrc;
  const draft = post.draft ?? null;
  const draftHe = (draft?.he ?? null) as Record<string, unknown> | null;
  const units: TranslationUnit[] = [];
  for (const { field, primary } of POST_FIELDS) {
    const en = (post as Record<string, unknown>)[field];
    if (!filled(en)) continue;
    const pub = live ? (he?.[field] as string | undefined) : null;
    const pending = live ? (draftHe?.[field] as string | undefined) : (he?.[field] as string | undefined) ?? (draftHe?.[field] as string | undefined);
    units.push(unit(field, primary, en, pub, src[field], pending));
  }
  return { units, status: itemStatus(units) };
}

/* ------------------------------------------------------------------ areas */

export const COLLECTION_FIELDS = [
  { field: "title", primary: true },
  { field: "tagline", primary: true },
  { field: "description", primary: false },
] as const;

export function collectionTranslation(c: Collection): { units: TranslationUnit[]; status: TranslationStatus | null } {
  const he = (c.he ?? null) as Record<string, unknown> | null;
  const src = ((c as { heMeta?: HebrewMeta | null }).heMeta?.src ?? {}) as HebrewSrc;
  const units: TranslationUnit[] = [];
  for (const { field, primary } of COLLECTION_FIELDS) {
    const en = (c as Record<string, unknown>)[field];
    if (!filled(en)) continue;
    units.push(unit(field, primary, en, he?.[field] as string | undefined, src[field], null));
  }
  return { units, status: itemStatus(units) };
}

/* ---------------------------------------------------- structured copy (Text) */

/** A `Text` value as stored: `{ en, he?, heSrc? }`. */
export function isText(v: unknown): v is { en: string; he?: string; heSrc?: string } {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.en === "string" && Object.keys(o).every((k) => k === "en" || k === "he" || k === "heSrc");
}

/** Every `Text` inside a value, with its dotted path. */
export function findTexts(value: unknown, path = "", out: { path: string; text: { en: string; he?: string; heSrc?: string } }[] = []) {
  if (isText(value)) {
    out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findTexts(v, path ? `${path}.${i}` : String(i), out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) findTexts(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** The value at a dotted path, or undefined. */
export function atPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), value);
}

/**
 * The units of every `Text` inside a published value, with the draft's Hebrew
 * at the same path. `primary` decides which paths count for the item.
 */
export function textUnits(published: unknown, draft: unknown, primary: (path: string) => boolean): TranslationUnit[] {
  return findTexts(published)
    .filter(({ text }) => filled(text.en))
    .map(({ path, text }) => {
      const d = draft === undefined || draft === null ? undefined : atPath(draft, path);
      const draftHe = isText(d) ? d.he : undefined;
      return unit(path, primary(path), text.en, text.he, text.heSrc, draftHe);
    });
}

/* ------------------------------------------------------------- the report */

export const TRANSLATION_TYPES = ["post", "area", "project", "story", "site-copy"] as const;
export type TranslationType = (typeof TRANSLATION_TYPES)[number];

export type TranslationItem = {
  type: TranslationType;
  /** The note's or area's slug, a project's slug, a story or site-copy section. */
  id: string;
  title: string;
  /** Where a reader sees it, on the English side; the Hebrew page is `/he` + this. */
  route: string;
  /** Lower is seen first: the home page, then hubs, projects, notes by recency. */
  rank: number;
  visibility: "public" | "private";
  status: TranslationStatus | null;
  units: TranslationUnit[];
};

export type TranslationCounts = Record<TranslationStatus, number>;

export function countUnits(items: TranslationItem[]): TranslationCounts {
  const counts: TranslationCounts = { missing: 0, draft: 0, stale: 0, unverified: 0, translated: 0 };
  for (const i of items) for (const u of i.units) counts[u.status] += 1;
  return counts;
}

/** Share of units a Hebrew reader gets in Hebrew, 0 to 100. */
export function coverage(counts: TranslationCounts): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return 100;
  return Math.round(((counts.translated + counts.unverified + counts.stale) / total) * 100);
}

/* -------------------------------------------------------------- stamping */

/*
 * The server stamps fingerprints on save (#303); a fingerprint the client
 * sends is never trusted. For each unit whose Hebrew is filled:
 *
 *   - if an earlier version (the draft, then the published) holds the same
 *     Hebrew at the same place, its fingerprint is kept: the Hebrew did not
 *     change, so it still translates whatever English it was written against,
 *     and an English edit since then is exactly what makes it stale;
 *   - otherwise the Hebrew is new in this save, written against the English
 *     beside it, and gets that English's fingerprint.
 *
 * A unit with no Hebrew carries no fingerprint. Hebrew is compared trimmed,
 * so a trailing space does not restamp. Hebrew that matches an earlier version
 * with no fingerprint (written before #303) keeps none, and stays unverified
 * until the backfill or an acknowledgement stamps it.
 */

const sameHebrew = (a: unknown, b: unknown) => filled(a) && filled(b) && a.trim() === b.trim();

/** An array element's identity: its slug or id when it has one, else its index. */
function elementKey(el: unknown, i: number): string {
  if (el && typeof el === "object") {
    const o = el as Record<string, unknown>;
    if (typeof o.slug === "string") return `[${o.slug}]`;
    if (typeof o.id === "string") return `[${o.id}]`;
  }
  return String(i);
}

type StoredText = { en: string; he?: string; heSrc?: string };

/** Every `Text`, by a path that follows slugs and ids rather than array positions. */
function keyedTexts(value: unknown, path = "", out = new Map<string, StoredText>()) {
  if (isText(value)) out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => keyedTexts(v, `${path}.${elementKey(v, i)}`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) keyedTexts(v, `${path}.${k}`, out);
  return out;
}

/**
 * `next` with every `Text`'s `heSrc` set by the rule above, against the
 * earlier versions in `prevs` (most recent first). Returns a copy.
 */
export function stampTexts<T>(next: T, prevs: unknown[]): T {
  const earlier = prevs.map((p) => keyedTexts(p));
  const out = structuredClone(next);
  const walk = (value: unknown, path: string) => {
    if (isText(value)) {
      const t = value as StoredText;
      if (!filled(t.he)) {
        delete t.heSrc;
        return;
      }
      const match = earlier.map((m) => m.get(path)).find((p) => p && sameHebrew(p.he, t.he));
      if (!match) t.heSrc = fp(t.en);
      else if (match.heSrc) t.heSrc = match.heSrc;
      else delete t.heSrc;
      return;
    }
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}.${elementKey(v, i)}`));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  walk(out, "");
  return out;
}

/** A note's or area's Hebrew block, read loosely. */
type HebrewWords = Record<string, unknown> | null | undefined;

/**
 * The `heMeta` for a note's or area's `he` block, stamped by the same rule
 * field by field. `en` is the English beside the block in this save; `prevs`
 * the earlier versions (block and meta), most recent first. Null when there is
 * no Hebrew at all.
 */
export function stampHebrewMeta(
  he: HebrewWords,
  en: Record<string, unknown>,
  prevs: { he: HebrewWords; meta: HebrewMeta | null | undefined }[],
  fields: readonly string[],
): HebrewMeta | null {
  if (!he || !fields.some((f) => filled(he[f]))) return null;
  const src: HebrewSrc = {};
  let bodyBase: string | null = null;
  for (const field of fields) {
    const value = he[field];
    if (!filled(value)) continue;
    const match = prevs.find((p) => p.he && sameHebrew(p.he[field], value));
    if (match) {
      const kept = match.meta?.src?.[field];
      if (kept) src[field] = kept;
      if (field === "body" && typeof match.meta?.bodyBase === "string") bodyBase = match.meta.bodyBase;
    } else if (filled(en[field])) {
      src[field] = fp(en[field] as string);
      if (field === "body") bodyBase = en.body as string;
    }
  }
  return fields.includes("body") ? { src, bodyBase } : { src };
}

/* ------------------------------------------------------ public isolation */

/** A value with every `heSrc` removed: fingerprints are the admin's, not the reader's. */
export function withoutFingerprints<T>(value: T): T {
  if (isText(value)) {
    const { heSrc: _drop, ...rest } = value as StoredText;
    return rest as T;
  }
  if (Array.isArray(value)) return value.map(withoutFingerprints) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutFingerprints(v)])) as T;
  }
  return value;
}
