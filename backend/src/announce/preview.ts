import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import seoRoutes from "../routes/seo.route.js";
import { SITE_URL } from "../services/seo.js";
import type { AnnounceEvent } from "./schemas.js";

/*
 * What a platform will read from an event's own page, taken from the head the
 * server already renders for it (/api/seo/head/<path>), run in-process. No
 * HTTP request is made at all, so there is nothing to point at a private
 * address: the path is checked against a fixed shape first, and the origin in
 * the result is SITE_URL, never anything from the request or the store.
 */

export type PreviewLang = "en" | "he";

export type PreviewIssue = { code: string; field: "title" | "description" | "image" | "translation"; severity: "error" | "warn"; limit?: number; length?: number };

export type Preview = {
  title: string;
  description: string;
  image: string;
  imageWidth: number | null;
  imageHeight: number | null;
  siteName: string;
  url: string;
  lang: PreviewLang;
  issues: PreviewIssue[];
};

/*
 * Limits, where a card stops showing the text. They are what the platforms
 * show, not hard rejections, so each is a warning:
 *  - title 70: LinkedIn cuts a link-card title at about 70 characters (two lines
 *    on desktop); X's summary_large_image title cuts at about 70 as well; a
 *    WhatsApp card shows roughly 2 lines (~65) of the title.
 *  - description 160: LinkedIn shows ~100 on a feed card, X 200, WhatsApp about
 *    2 lines (~160); 160 keeps it whole on all three, and is also the search
 *    snippet convention the site already clamps to (clampDescription, 155).
 *  - image 1200x630: the 1.91:1 size all three crop to; smaller than 600 wide
 *    makes LinkedIn and X fall back to a small card.
 */
export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 160;
export const OG_SIZE = { width: 1200, height: 630 } as const;

/* Only fixed shapes of the site's own pages, so no user text reaches the dispatch. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POST_PATH = new RegExp(`^/blog/${SLUG.source.slice(1)}`);

/*
 * The page a platform would read for an event, by kind (the seo routes):
 * /blog/:slug, /projects/:slug, /blog/area/:slug, /story and /. A custom
 * announcement has no page of its own, so it is judged on its own fields.
 */
export function previewPathOf(ev: AnnounceEvent): string | null {
  switch (ev.kind) {
    case "post":
    case "note":
      return ev.path && POST_PATH.test(ev.path) ? ev.path : null;
    case "project":
      return SLUG.test(ev.ref) ? `/projects/${ev.ref}` : null;
    case "area":
      return SLUG.test(ev.ref) ? `/blog/area/${ev.ref}` : null;
    case "story":
      return "/story";
    case "home":
      return "/";
    default:
      return null;
  }
}

const unescape = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_m, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e] as string);

function tag(head: string[], attr: "property" | "name", key: string): string | null {
  for (const line of head) {
    if (!line.startsWith("<meta") || !line.includes(`${attr}="${key}"`)) continue;
    const m = /content="([^"]*)"/.exec(line);
    if (m) return unescape(m[1]);
  }
  return null;
}

/** Runs the SEO router for one GET, in this process, and returns its JSON. */
async function localHead(path: string, lang: PreviewLang): Promise<{ status: number; body: { head?: string[]; lang?: string } }> {
  const app = express();
  app.use("/api/seo", seoRoutes);
  const req = new IncomingMessage(new Socket());
  req.method = "GET";
  /* The home page is registered as /home, and its Hebrew twin has no suffix. */
  req.url = path === "/" ? `/api/seo/head${lang === "he" ? "/he" : "/home"}` : `/api/seo/head${lang === "he" ? "/he" : ""}${path}`;
  req.headers = { host: new URL(SITE_URL).host };
  const res = new ServerResponse(req);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.write = ((c: unknown) => (chunks.push(Buffer.from(c as string)), true)) as typeof res.write;
    res.end = ((c?: unknown) => {
      if (c) chunks.push(Buffer.from(c as string));
      try {
        resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch (e) {
        reject(e);
      }
      return res;
    }) as typeof res.end;
    (app as unknown as (q: IncomingMessage, s: ServerResponse, n: (e?: unknown) => void) => void)(req, res, (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: {} })));
  });
}

export function analyse(head: string[], lang: PreviewLang): Preview {
  const og = (k: string) => tag(head, "property", k);
  const tw = (k: string) => tag(head, "name", k);
  const title = og("og:title") ?? tw("twitter:title") ?? "";
  const description = og("og:description") ?? tw("twitter:description") ?? "";
  const image = og("og:image") ?? tw("twitter:image") ?? "";
  const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);
  const imageWidth = num(og("og:image:width"));
  const imageHeight = num(og("og:image:height"));
  const issues: PreviewIssue[] = [];
  if (!title) issues.push({ code: "title-missing", field: "title", severity: "error" });
  else if (title.length > TITLE_MAX) issues.push({ code: "title-long", field: "title", severity: "warn", limit: TITLE_MAX, length: title.length });
  if (!description) issues.push({ code: "description-missing", field: "description", severity: "error" });
  else if (description.length > DESCRIPTION_MAX) issues.push({ code: "description-long", field: "description", severity: "warn", limit: DESCRIPTION_MAX, length: description.length });
  if (!image) issues.push({ code: "image-missing", field: "image", severity: "error" });
  else if (imageWidth !== OG_SIZE.width || imageHeight !== OG_SIZE.height) issues.push({ code: "image-size", field: "image", severity: "warn" });
  return {
    title, description, image, imageWidth, imageHeight, lang,
    siteName: og("og:site_name") ?? "",
    url: og("og:url") ?? "",
    issues,
  };
}

const ownUrl = (u: string) => {
  try {
    return new URL(u).origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
};

/** Readiness of a hand-made announcement, from its own fields: the image's size is not known. */
function analyseCustom(ev: AnnounceEvent, lang: PreviewLang): Preview {
  const title = ev.custom?.title ?? ev.title;
  const description = ev.custom?.summary ?? ev.summary;
  const image = ev.custom?.imageUrl && ownUrl(ev.custom.imageUrl) ? ev.custom.imageUrl : "";
  const issues: PreviewIssue[] = [];
  if (!title) issues.push({ code: "title-missing", field: "title", severity: "error" });
  else if (title.length > TITLE_MAX) issues.push({ code: "title-long", field: "title", severity: "warn", limit: TITLE_MAX, length: title.length });
  if (!description) issues.push({ code: "description-missing", field: "description", severity: "error" });
  else if (description.length > DESCRIPTION_MAX) issues.push({ code: "description-long", field: "description", severity: "warn", limit: DESCRIPTION_MAX, length: description.length });
  if (!image) issues.push({ code: "image-missing", field: "image", severity: "error" });
  if (Object.keys(ev.drafts?.he ?? {}).length === 0) issues.push({ code: "no-hebrew-translation", field: "translation", severity: "warn" });
  return { title, description, image, imageWidth: null, imageHeight: null, siteName: new URL(SITE_URL).hostname, url: ev.url, lang, issues };
}

/** "no-page" for a custom announcement's page, null-path kinds; "unpublished" when the page is not there. */
export async function previewFor(ev: AnnounceEvent, lang: PreviewLang): Promise<Preview | "no-page" | "unpublished"> {
  if (ev.kind === "custom") return analyseCustom(ev, lang);
  const path = previewPathOf(ev);
  if (!path) return "no-page";
  const r = await localHead(path, lang);
  if (r.status !== 200 || !Array.isArray(r.body.head)) return "unpublished";
  const p = analyse(r.body.head, lang);
  /* story and home are always written in both languages; the rest carry their Hebrew or do not. */
  if (!ev.langs.includes("he") && ev.kind !== "story" && ev.kind !== "home") p.issues.push({ code: "no-hebrew-translation", field: "translation", severity: "warn" });
  return p;
}
