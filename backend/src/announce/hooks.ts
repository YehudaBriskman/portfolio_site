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

/** Mounted beside `indexNowOnWrite`: a post going from not-published to published is an event. */
export const announceOnWrite: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const change = res.locals.audit as { before?: PostDoc | null; after?: PostDoc | null } | undefined;
    if (!change?.after) return;
    if (change.before?.status === "published" || change.after.status !== "published" || change.after.type !== "post") return;
    const ev = postEvent(change.after);
    if (!ev) return;
    record(ev).catch((err) => logger.warn({ err: err instanceof Error ? err.message : String(err), id: ev._id }, "announce: could not record post event"));
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
