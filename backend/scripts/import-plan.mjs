/*
 * What import-content.mjs will write, and the writing of it.
 *
 * Separate from the script so a test can run the whole import against the
 * real admin routes (scripts/import-content.test.ts) with no network: the
 * script hands `applyPlan` a `fetch`-backed `api`, the test a supertest one.
 *
 * ENGLISH is what it always was: one `PUT` per area and per note, through the
 * routes the admin UI uses, with the `_rev` it read.
 *
 * HEBREW comes from the `.he.md` files and the areas' `he` objects (see
 * content-files.mjs), merged into what the store holds field by field:
 *
 *   the store has none        the repo's Hebrew is written ("add")
 *   the store has the same    nothing to do
 *   the store has different   the store's is KEPT and reported, unless
 *                             `overwriteHe` (the `--overwrite-he` flag) says
 *                             to replace it ("overwrite")
 *   the repo has none         the store's stays as it is
 *
 * So the owner's Hebrew, written in the admin, is never replaced by a re-run.
 *
 * How it is written. An area's `he` and its link labels go in the same
 * `PUT /collections/:slug`. A note's Hebrew cannot: `PUT /posts/:slug`
 * carries the stored `he` through untouched, by design. It goes through
 * `POST /posts/:slug/publish` with `scope: "he"` (#305), which publishes the
 * Hebrew alone over the live English. The body sent repeats the live English
 * exactly, so the route has nothing left over to keep as a draft. Two
 * consequences, both handled:
 *   - that publish clears the note's draft, so a note with an unpublished
 *     draft in the admin is skipped and reported, never written;
 *   - it rewrites the note's "what changed" line, so the stored one is sent
 *     back as it was.
 * The server stamps the Hebrew fingerprints (#303) on both routes; nothing
 * here computes one.
 */
import { toCollectionHebrew, toCollectionWrite, toPostHebrew, toPostWrite } from "./content-files.mjs";

const filled = (v) => typeof v === "string" && v.trim() !== "";
const trimmed = (v) => (filled(v) ? v.trim() : "");
const isEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The Hebrew fields of a note, as `he` holds them (#306 adds the link labels). */
export const POST_HE_FIELDS = ["title", "subtitle", "excerpt", "body", ...Array.from({ length: 8 }, (_, i) => `links.${i}.label`)];
export const AREA_HE_FIELDS = ["title", "tagline", "description"];

/**
 * The repo's Hebrew merged into the store's, field by field, by the rule in
 * the header. `actions` lists every field that is not simply equal.
 */
export function mergeHebrew(fromRepo, inStore, fields, { overwriteHe = false } = {}) {
  const merged = {};
  const actions = [];
  for (const field of fields) {
    const want = fromRepo?.[field];
    const have = inStore?.[field];
    if (!filled(want)) {
      if (filled(have)) merged[field] = have;
      continue;
    }
    if (!filled(have)) {
      merged[field] = want;
      actions.push({ field, action: "add" });
    } else if (trimmed(want) === trimmed(have)) {
      merged[field] = have;
    } else if (overwriteHe) {
      merged[field] = want;
      actions.push({ field, action: "overwrite" });
    } else {
      merged[field] = have;
      actions.push({ field, action: "kept" });
    }
  }
  return { merged, actions };
}

const writes = (actions) => actions.some((a) => a.action === "add" || a.action === "overwrite");

/* --------------------------------------------------------------- areas -- */

function labelEn(label) {
  if (typeof label === "string") return label;
  return label && typeof label.en === "string" ? label.en : "";
}
function labelHe(label) {
  return label && typeof label === "object" && filled(label.he) ? label.he : null;
}

/** An area's links as `{ url, label: { en, he? } }`, fingerprints dropped: the shape to compare. */
export function comparableLinks(links) {
  return (links ?? []).map((l) => {
    const he = labelHe(l.label);
    return { label: he ? { en: labelEn(l.label), he } : { en: labelEn(l.label) }, url: l.url };
  });
}

function comparableAreaHe(he) {
  if (!he) return null;
  const out = {};
  for (const f of AREA_HE_FIELDS) if (filled(he[f])) out[f] = he[f];
  return Object.keys(out).length ? out : null;
}

/**
 * The write body for one area and the Hebrew decisions behind it. Each link
 * label is sent as `{ en, he? }`: the Hebrew is the repo's or the store's by
 * the merge rule, the store's found by the link's address, so a reordered list
 * keeps each label with its link. `he` is sent only when a field of it changes;
 * left out, the route keeps the stored block and its fingerprints.
 */
export function planArea(data, existing, opts = {}) {
  const english = toCollectionWrite(data);
  const fromRepo = toCollectionHebrew(data);
  const { merged, actions } = mergeHebrew(fromRepo.he, existing?.he, AREA_HE_FIELDS, opts);
  const stored = existing?.links ?? [];
  const links = (english.links ?? []).map((l, i) => {
    const prior = stored.find((s) => s.url === l.url);
    const r = mergeHebrew({ label: fromRepo.linkLabels[i] }, { label: prior ? labelHe(prior.label) : null }, ["label"], opts);
    for (const a of r.actions) actions.push({ ...a, field: `links.${i}.label` });
    const en = labelEn(l.label);
    return { label: filled(r.merged.label) ? { en, he: r.merged.label } : { en }, url: l.url };
  });
  const sendHe = writes(actions.filter((a) => !a.field.startsWith("links.")));
  const draft = {
    ...english,
    links,
    ...(sendHe ? { he: { title: merged.title ?? null, tagline: merged.tagline ?? null, description: merged.description ?? null } } : {}),
  };

  const diff = [];
  for (const [key, value] of Object.entries(draft)) {
    if (key === "slug") continue;
    const from = key === "links" ? comparableLinks(existing?.links) : key === "he" ? comparableAreaHe(existing?.he) : existing?.[key];
    const to = key === "he" ? comparableAreaHe(value) : value;
    if (!isEqual(from, to)) diff.push({ key, from, to });
  }
  return { kind: "collection", slug: english.slug, existing, draft, diff, hebrew: actions, notes: [] };
}

/* --------------------------------------------------------------- notes -- */

/**
 * The body of `POST /posts/:slug/publish` that publishes `he` alone over the
 * note `doc` as stored: the live English repeated exactly, so nothing is left
 * to keep as a draft, and the stored "what changed" line sent back.
 */
export function hebrewPublishBody(doc, he) {
  return {
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    excerpt: doc.excerpt ?? "",
    body: doc.body ?? "",
    tags: doc.tags ?? [],
    collection: doc.collection,
    coverImage: doc.coverImage ?? null,
    links: doc.links ?? [],
    featured: doc.featured ?? null,
    publishedAt: doc.publishedAt ?? null,
    seo: doc.seo ?? { title: null, description: null, canonical: null, noindex: false },
    he: { title: "", subtitle: "", excerpt: "", body: "", ...he },
    scope: "he",
    ...(filled(doc.changeNote) ? { changeNote: doc.changeNote } : {}),
    ...(doc._rev ? { _rev: doc._rev } : {}),
  };
}

/** The English write and the Hebrew decisions for one note. */
export function planPost(post, existing, opts = {}) {
  const draft = toPostWrite(post);
  const notes = [];
  // The API keeps the first publish date, so sending a different one changes nothing.
  const skip = [];
  if (existing?.publishedAt && existing.status === "published") {
    skip.push("publishedAt");
    if (!isEqual(existing.publishedAt, draft.publishedAt)) {
      notes.push(`publishedAt stays ${existing.publishedAt} (the draft says ${draft.publishedAt}; the API never moves a publish date)`);
    }
  }
  const diff = [];
  for (const [key, value] of Object.entries(draft)) {
    if (key === "slug" || skip.includes(key)) continue;
    if (!isEqual(existing?.[key], value)) diff.push({ key, from: existing?.[key], to: value });
  }

  const { merged, actions } = mergeHebrew(toPostHebrew(post), existing?.he, POST_HE_FIELDS, opts);
  let he = writes(actions) ? merged : null;
  if (he && existing?.draft) {
    notes.push("Hebrew not written: the note has an unpublished draft in the admin, which publishing the Hebrew would clear. Publish or discard the draft, then run this again.");
    he = null;
  }
  if (he && draft.status !== "published") {
    notes.push(`Hebrew not written: the note is ${draft.status}, and Hebrew is published only over a published note.`);
    he = null;
  }
  return { kind: "post", slug: draft.slug, existing, draft, diff, hebrew: actions, he, notes };
}

/* ---------------------------------------------------------------- plan -- */

/** Every area and note, against what the store holds. */
export function buildPlan({ areas, posts }, { liveAreas, livePosts }, opts = {}) {
  const areaBySlug = new Map(liveAreas.map((a) => [a.slug, a]));
  const postBySlug = new Map(livePosts.map((p) => [p.slug, p]));
  return [
    ...areas.map(({ data }) => planArea(data, areaBySlug.get(data.slug), opts)),
    ...posts.map((post) => planPost(post, postBySlug.get(post.meta.slug), opts)),
  ];
}

/** True when the item has anything to write. */
export function needsWrite(item) {
  if (!item.existing) return true;
  return item.diff.length > 0 || (item.kind === "post" && item.he !== null);
}

function short(v) {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s.length > 90 ? `${s.slice(0, 87)}...` : s;
}

/** Changed lines of a long text, removed then added. Enough to review; not a patch. */
function lineDiff(before, after, limit = 12) {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");
  const inA = new Set(a);
  const inB = new Set(b);
  const out = [
    ...a.filter((l) => l.trim() && !inB.has(l)).map((l) => `      - ${l}`),
    ...b.filter((l) => l.trim() && !inA.has(l)).map((l) => `      + ${l}`),
  ];
  return out.length > limit ? [...out.slice(0, limit), `      ... ${out.length - limit} more changed lines`] : out;
}

const VERB = { add: "add", overwrite: "OVERWRITE", kept: "kept the store's" };

/** The plan as the dry run prints it, one line per entry. */
export function describePlan(plan, { overwriteHe = false } = {}) {
  const lines = [];
  for (const item of plan) {
    const label = `${item.kind} ${item.slug}`;
    if (!item.existing) lines.push(`+ create ${label}`);
    else if (needsWrite(item)) lines.push(`~ update ${label}`);
    else lines.push(`= unchanged ${label}`);
    for (const c of item.diff) {
      if (c.key === "body" && (c.from === undefined || c.from === null)) {
        lines.push(`    body: new, ${c.to.trim().split(/\s+/).length} words`);
      } else if (c.key === "body") {
        lines.push(`    body: changed`);
        lines.push(...lineDiff(c.from, c.to));
      } else {
        lines.push(`    ${c.key}: ${short(c.from)} -> ${short(c.to)}`);
      }
    }
    const byVerb = new Map();
    for (const a of item.hebrew) byVerb.set(a.action, [...(byVerb.get(a.action) ?? []), a.field]);
    for (const [verb, fields] of byVerb) {
      const tail = verb === "kept" && !overwriteHe ? " (differs from the repo; --overwrite-he replaces it)" : "";
      lines.push(`    hebrew: ${VERB[verb]} ${fields.join(", ")}${tail}`);
    }
    for (const n of item.notes ?? []) lines.push(`    note: ${n}`);
  }
  return lines;
}

/**
 * Writes the plan: areas before notes (the plan's order), so a note never
 * names an area that does not exist yet. Returns the number of failures.
 * `api(method, path, body)` resolves to the parsed JSON or throws.
 */
export async function applyPlan(plan, api, log = console.log) {
  let failed = 0;
  for (const item of plan) {
    if (!needsWrite(item)) continue;
    const path = `/${item.kind === "collection" ? "collections" : "posts"}/${encodeURIComponent(item.slug)}`;
    try {
      let doc = item.existing ?? null;
      if (!item.existing || item.diff.length) {
        const body = item.existing?._rev ? { ...item.draft, _rev: item.existing._rev } : item.draft;
        const res = await api("PUT", path, body);
        doc = res.post ?? res.collection ?? doc;
        log(`ok   ${item.kind} ${item.slug}`);
      }
      if (item.kind === "post" && item.he) {
        await api("POST", `${path}/publish`, hebrewPublishBody(doc, item.he));
        log(`ok   ${item.kind} ${item.slug} (Hebrew)`);
      }
    } catch (e) {
      failed++;
      log(`FAIL ${item.kind} ${item.slug}: ${e.message}`);
    }
  }
  return failed;
}
