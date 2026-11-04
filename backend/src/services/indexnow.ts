import type { RequestHandler } from "express";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { LANGS, SITE_URL, absoluteUrl, pathIn, robotsStance } from "./seo.js";

/*
 * IndexNow (#308): when a public page changes, say so.
 *
 * Bing, Yandex, Seznam, Naver and Yep share one endpoint; a ping to it
 * reaches all of them, and Bing's index feeds the assistants that search
 * through it. Google does not take part, and reads the sitemap's lastmod.
 *
 * The key is INDEXNOW_KEY, served as `/<key>.txt` at the site's root (the
 * protocol scopes a key to the directory its file sits in, so it has to be
 * the root). Nothing is sent when the key is unset, or when this host is not
 * one that asks to be crawled (a preprod, a dev box): telling a search
 * engine about a host robots.txt closes would be a contradiction.
 *
 * Fire and forget. A publish never waits on, or fails because of, a search
 * engine; a failed ping is logged and the next publish sends again.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Whether this host sends pings at all. */
export function indexNowEnabled(key = env.INDEXNOW_KEY, siteUrl = SITE_URL): key is string {
  return Boolean(key) && robotsStance(siteUrl, env.ROBOTS_POLICY) === "open";
}

/** The request body for a set of unprefixed paths, in every language. */
export function indexNowBody(paths: string[], key: string) {
  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(paths.flatMap((p) => LANGS.map((l) => absoluteUrl(pathIn(p, l)))))];
  return { host, key, keyLocation: absoluteUrl(`/${key}.txt`), urlList };
}

export async function pingIndexNow(paths: string[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = env.INDEXNOW_KEY;
  if (!indexNowEnabled(key) || paths.length === 0) return;
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(paths, key)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.warn({ status: res.status, paths }, "IndexNow refused the ping");
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), paths }, "IndexNow ping failed");
  }
}

type Doc = { type?: string; slug?: string; status?: string; kind?: string; updatedAt?: string; seo?: { noindex?: boolean } };

/**
 * The public pages an admin write changed, from the before and after the
 * route recorded for the audit log (`res.locals.audit`). A post's page and
 * the notes index; a collection's area and, for a project, its project page.
 * A draft autosave leaves `updatedAt` alone, and so changes nothing public.
 */
export function changedPaths(before: Doc | null | undefined, after: Doc | null | undefined): string[] {
  const doc = after ?? before;
  if (!doc?.slug) return [];
  const wasPublic = before?.status === "published";
  const isPublic = after?.status === "published" && !after.seo?.noindex;
  if (!wasPublic && !isPublic) return [];
  if (before && after && before.updatedAt === after.updatedAt && wasPublic === isPublic) return [];
  if (doc.type === "post") return [`/blog/${doc.slug}`, "/blog"];
  if (doc.type === "collection") {
    return [`/blog/area/${doc.slug}`, ...(doc.kind === "project" ? [`/projects/${doc.slug}`, "/projects"] : [])];
  }
  return [];
}

/** Mounted beside `auditWrites`: after a successful write, ping for what it changed. */
export const indexNowOnWrite: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || !indexNowEnabled()) return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const change = res.locals.audit as { before?: Doc | null; after?: Doc | null } | undefined;
    if (!change) return;
    void pingIndexNow(changedPaths(change.before, change.after));
  });
  next();
};
