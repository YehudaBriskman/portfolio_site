import { autoDraftFor } from "../campaigns/autodraft.js";
import type { RequestHandler } from "express";
import { logger } from "../logger.js";
import { SITE_URL } from "../services/seo.js";
import type { SiteReleases } from "../schemas/content.js";
import { notifyOwner } from "./notify.js";
import type { AnnounceEvent } from "./schemas.js";
import { createEvent, eventId, getState, loadSettings, putState } from "./store.js";

/*
 * Where announce events come from. Two sources, both best-effort: a failure
 * here is logged and never reaches the publish or the refresh tick.
 */

type PostDoc = {
  type?: string;
  slug?: string;
  status?: string;
  title?: string;
  excerpt?: string;
  tags?: string[];
  publishedAt?: string | null;
  he?: { title?: string; excerpt?: string; body?: string } | null;
};

/** Records the event, once per id. Returns whether it was new. */
async function record(ev: AnnounceEvent): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings.enabled) return false;
  if (!(await createEvent(ev))) return false;
  if (settings.email.enabled && settings.email.events.includes(ev.kind)) await notifyOwner(ev, settings);
  try {
    await autoDraftFor(ev, settings);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), id: ev._id }, "announce: could not draft a campaign");
  }
  return true;
}

export function postEvent(after: PostDoc, now = new Date()): AnnounceEvent | null {
  if (after.type !== "post" || !after.slug || !after.title) return null;
  const stamp = after.publishedAt || now.toISOString();
  const hasHe = Boolean(after.he && (after.he.title || after.he.body));
  return {
    _id: eventId("post", after.slug, stamp),
    type: "announce",
    kind: "post",
    ref: after.slug,
    title: after.title,
    ...(hasHe && after.he?.title ? { titleHe: after.he.title } : {}),
    summary: after.excerpt ?? "",
    ...(hasHe && after.he?.excerpt ? { summaryHe: after.he.excerpt } : {}),
    tags: after.tags ?? [],
    path: `/blog/${after.slug}`,
    url: `${SITE_URL}/blog/${after.slug}`,
    langs: hasHe ? ["en", "he"] : ["en"],
    createdAt: now.toISOString(),
    done: {},
  };
}

type AreaDoc = {
  type?: string;
  slug?: string;
  status?: string;
  title?: string;
  tagline?: string;
  description?: string;
  createdAt?: string;
  he?: { title?: string | null; tagline?: string | null; description?: string | null } | null;
};

type Txt = { en?: string; he?: string } | string | null | undefined;
type ProjectItem = { slug?: string; title?: string; fact?: Txt; description?: Txt; tech?: string[] };
type ContentDocLike = { type?: string; key?: string; published?: { items?: ProjectItem[] } | null };

const enOf = (t: Txt) => (typeof t === "string" ? t : t?.en ?? "");
const heOf = (t: Txt) => (typeof t === "string" ? "" : t?.he ?? "");

export function areaEvent(after: AreaDoc, now = new Date()): AnnounceEvent | null {
  if (after.type !== "collection" || !after.slug || !after.title) return null;
  const he = after.he;
  const hasHe = Boolean(he && (he.title || he.description || he.tagline));
  const summary = after.tagline || after.description || "";
  const summaryHe = he?.tagline || he?.description || "";
  return {
    _id: eventId("area", after.slug, after.createdAt || now.toISOString()),
    type: "announce",
    kind: "area",
    ref: after.slug,
    title: after.title,
    ...(hasHe && he?.title ? { titleHe: he.title } : {}),
    summary,
    ...(hasHe && summaryHe ? { summaryHe } : {}),
    tags: [],
    path: `/blog/area/${after.slug}`,
    url: `${SITE_URL}/blog/area/${after.slug}`,
    langs: hasHe ? ["en", "he"] : ["en"],
    createdAt: now.toISOString(),
    done: {},
  };
}

export function projectEvent(item: ProjectItem, now = new Date()): AnnounceEvent | null {
  if (!item.slug || !item.title) return null;
  const summary = enOf(item.fact) || enOf(item.description);
  const summaryHe = heOf(item.fact) || heOf(item.description);
  return {
    /* No creation stamp on a project: one event per slug, ever. */
    _id: eventId("project", item.slug, "first"),
    type: "announce",
    kind: "project",
    ref: item.slug,
    title: item.title,
    summary,
    ...(summaryHe ? { summaryHe } : {}),
    tags: (item.tech ?? []).slice(0, 5).map((t) => t.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean),
    path: `/projects/${item.slug}`,
    url: `${SITE_URL}/projects/${item.slug}`,
    langs: summaryHe ? ["en", "he"] : ["en"],
    createdAt: now.toISOString(),
    done: {},
  };
}

type Change = { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };

/** The events one successful admin write makes: a post or area going live, or a project newly published. */
export function eventsFor(change: Change, now = new Date()): AnnounceEvent[] {
  const after = change.after as (PostDoc & AreaDoc & ContentDocLike) | null | undefined;
  const before = change.before as (PostDoc & AreaDoc & ContentDocLike) | null | undefined;
  if (!after) return [];
  if (after.type === "post") {
    if (before?.status === "published" || after.status !== "published") return [];
    const ev = postEvent(after, now);
    return ev ? [ev] : [];
  }
  if (after.type === "collection") {
    if (before?.status === "published" || after.status !== "published") return [];
    const ev = areaEvent(after, now);
    return ev ? [ev] : [];
  }
  if (after.type === "content" && after.key === "projects") {
    const was = new Set((before?.published?.items ?? []).map((i) => i.slug));
    /* A first write that only seeds the document has no `before`: nothing new was published. */
    if (!before) return [];
    return (after.published?.items ?? []).filter((i) => !was.has(i.slug)).flatMap((i) => projectEvent(i, now) ?? []);
  }
  return [];
}

/** Mounted beside `indexNowOnWrite`: a post, area or project going from unpublished to published is an event. */
export const announceOnWrite: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const change = res.locals.audit as Change | undefined;
    if (!change?.after) return;
    for (const ev of eventsFor(change)) {
      record(ev).catch((err) => logger.warn({ err: err instanceof Error ? err.message : String(err), id: ev._id }, "announce: could not record event"));
    }
  });
  next();
};

/**
 * Called after each releases refresh. The first call ever only records the
 * tags that exist, so deploying this does not announce the whole history.
 * After that, a tag not yet seen is a release event.
 */
export async function announceNewReleases(doc: SiteReleases, now = new Date()): Promise<void> {
  /* A failed fetch keeps the stored list: nothing new to learn from it. */
  if (doc.error) return;
  const state = await getState();
  const tags = doc.items.map((r) => r.tag);
  if (!state) {
    await putState({ _id: "announce-state", seenReleases: tags, seededAt: now.toISOString() });
    return;
  }
  const seen = new Set(state.seenReleases);
  const fresh = doc.items.filter((r) => !seen.has(r.tag));
  if (fresh.length === 0) return;
  /* State first: if recording fails the release is skipped, not re-announced every 15 minutes. */
  await putState({ ...state, seenReleases: [...new Set([...state.seenReleases, ...tags])] });
  for (const r of fresh) {
    try {
      await record({
        _id: eventId("release", r.tag, r.publishedAt),
        type: "announce",
        kind: "release",
        ref: r.tag,
        title: `${doc.repo.name} ${r.tag}`,
        summary: r.name ?? "",
        tags: [],
        url: r.url,
        version: r.tag,
        langs: ["en", "he"],
        createdAt: now.toISOString(),
        done: {},
      });
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), tag: r.tag }, "announce: could not record release event");
    }
  }
}
