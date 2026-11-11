import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { captionTracks, captionsUrl, fileUrl, mediaStore, publicMedia, variantUrl, MEDIA_ID, type MediaDoc } from "../services/media.js";
import { EXT, MIME, VARIANT_FORMATS, type Variant, type VariantFormat } from "../services/mediaImage.js";

/*
 * The public face of the media library (#253), served beside the legacy
 * upload images in images.controller.ts under /api/images.
 *
 *   GET /media/:id[?w=800][&f=webp]     302 to the current file; 5 minutes
 *       an image: its best variant; an icon: the icon; a video: the video,
 *       or with ?poster its poster's best variant
 *   GET /media/:id/meta                 alt, caption, credit, srcsets; 5 minutes
 *   GET /m/:id/w<w>-<hash>.<avif|webp>  an image size or a poster size
 *   GET /m/:id/icon-<hash>.<svg|png>    an icon
 *   GET /m/:id/video-<hash>.<mp4|webm>  a video; Range requests answered 206
 *   GET /m/:id/captions-<hash>.vtt      a video's captions
 *
 * Every hashed URL is the content: a different file is a different URL, so a
 * browser may keep it a year. A hash that is no longer current (the item was
 * replaced since the page was rendered) is redirected to the current file of
 * the same shape rather than answered 404, so a stale page still works.
 *
 * Every file goes out with nosniff and a Content-Security-Policy of its own,
 * `default-src 'none'`: if one is opened directly rather than embedded, the
 * document it becomes can load and run nothing. An SVG icon is the case that
 * matters — it is markup — and it gets exactly `default-src 'none';
 * style-src 'unsafe-inline'`. A raster or a video adds `img-src 'self'` /
 * `media-src 'self'`, without which the browser's own viewer page for a file
 * opened directly would block the very file it is showing.
 *
 * An image's original upload is never served. An SVG image in particular is
 * only ever the source its rasterised variants were drawn from.
 */

const SHORT = "public, max-age=300";
const FOREVER = "public, max-age=31536000, immutable";
const FILE =
  /^(?:w(\d{1,5})-([0-9a-f]{16})\.(avif|webp)|(icon|video|captions)-([0-9a-f]{16})\.(svg|png|mp4|webm|vtt))$/;

const CSP = {
  svg: "default-src 'none'; style-src 'unsafe-inline'",
  image: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  video: "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'",
  text: "default-src 'none'",
};

function notFound(res: Response) {
  // A hashed URL's headers promise a year; a miss must not carry them, nor a leftover file Content-Type.
  res.removeHeader("Content-Type");
  res.removeHeader("ETag");
  res.removeHeader("Content-Security-Policy");
  res.setHeader("Cache-Control", "no-store");
  return res.status(404).json({ ok: false, error: "Not Found" });
}

/** The variant nearest `width` from above (or the widest), in `format`. */
export function pick(variants: Variant[], format: VariantFormat, width: number | null): Variant | undefined {
  const of = variants.filter((v) => v.format === format).sort((a, b) => a.width - b.width);
  if (width === null) return of[of.length - 1];
  return of.find((v) => v.width >= width) ?? of[of.length - 1];
}

function wants(req: Request): VariantFormat {
  const f = req.query.f;
  if (typeof f === "string" && (VARIANT_FORMATS as readonly string[]).includes(f)) return f as VariantFormat;
  return /image\/avif/.test(req.header("accept") ?? "") ? "avif" : "webp";
}

function fileHeaders(res: Response, contentType: string, csp: string, hash: string) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", FOREVER);
  res.setHeader("ETag", `"${hash}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", csp);
}

/*
 * One `bytes=` range of `size` bytes, or null for "send it all" (no header, a
 * header we do not handle such as several ranges, or an If-Range that no
 * longer matches), or "unsatisfiable".
 */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]); // the last N bytes
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

async function sendVideo(req: Request, res: Response, doc: MediaDoc) {
  const size = doc.bytes;
  res.setHeader("Accept-Ranges", "bytes");
  const ifRange = req.header("if-range");
  const range = ifRange && ifRange !== `"${doc.hash}"` ? null : parseRange(req.header("range"), size);
  if (range === "unsatisfiable") {
    res.setHeader("Content-Range", `bytes */${size}`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(416).end();
  }
  if (!range && req.header("if-none-match") === `"${doc.hash}"`) {
    fileHeaders(res, MIME[doc.format], CSP.video, doc.hash);
    return res.status(304).end();
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const stream = await mediaStore.range(doc.id, doc.original, start, end);
  if (!stream) return notFound(res);
  // Only now is there a file to promise: an error or a miss above goes out uncacheable.
  fileHeaders(res, MIME[doc.format], CSP.video, doc.hash);
  if (range) {
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  res.setHeader("Content-Length", String(end - start + 1));
  if (req.method === "HEAD") {
    stream.destroy();
    return res.end();
  }
  // A visitor seeking away closes the response; the pipeline then ends the store's stream too.
  await pipeline(stream, res).catch(() => undefined);
}

async function sendWhole(req: Request, res: Response, id: string, name: string, type: string, csp: string, hash: string) {
  if (req.header("if-none-match") === `"${hash}"`) {
    fileHeaders(res, type, csp, hash);
    return res.status(304).end();
  }
  const file = await mediaStore.file(id, name);
  if (!file) return notFound(res);
  fileHeaders(res, type, csp, hash);
  res.setHeader("Content-Length", String(file.data.length));
  res.end(file.data);
}

export const mediaController = {
  redirect: async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!MEDIA_ID.test(id)) return notFound(res);
    const doc = await mediaStore.get(id);
    if (!doc) return notFound(res);
    res.setHeader("Cache-Control", SHORT);
    const own = fileUrl(doc);
    if (own && !(doc.kind === "video" && req.query.poster !== undefined)) return res.redirect(302, own);
    const w = Number(req.query.w);
    const v = pick(doc.variants, wants(req), Number.isInteger(w) && w > 0 ? w : null);
    if (!v) return notFound(res);
    if (!req.query.f) res.setHeader("Vary", "Accept");
    res.redirect(302, variantUrl(doc.id, v));
  },

  meta: async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!MEDIA_ID.test(id)) return notFound(res);
    const doc = await mediaStore.get(id);
    if (!doc) return notFound(res);
    const m = publicMedia(doc);
    res.setHeader("Cache-Control", SHORT);
    res.json({
      ok: true,
      item: {
        id: m.id,
        kind: m.kind,
        alt: m.alt,
        caption: m.caption,
        credit: m.credit,
        width: m.width,
        height: m.height,
        srcset: m.srcset,
        /* An image's widest size; a video's poster. */
        src: m.largest.webp,
        file: m.file,
        mime: m.mime,
        monochrome: m.monochrome,
        durationMs: m.durationMs,
        captions: m.captions,
        /* Every captions track, and the Hebrew alt and caption (#306). */
        tracks: m.tracks,
        he: m.he,
      },
    });
  },

  file: async (req: Request, res: Response) => {
    const id = req.params.id;
    const m = FILE.exec(req.params.file ?? "");
    if (!MEDIA_ID.test(id) || !m) return notFound(res);
    const doc = await mediaStore.get(id);
    if (!doc) return notFound(res);

    if (m[1]) {
      const [, width, hash, format] = m;
      const v = doc.variants.find((x) => x.width === Number(width) && x.format === format);
      if (!v || v.hash !== hash) {
        const now = pick(doc.variants, format as VariantFormat, Number(width));
        if (!now) return notFound(res);
        res.setHeader("Cache-Control", SHORT);
        return res.redirect(302, variantUrl(doc.id, now));
      }
      return sendWhole(req, res, id, v.name, MIME[v.format], CSP.image, v.hash);
    }

    const [, , , , part, hash, ext] = m;
    if (part === "captions") {
      /* Any of its tracks by hash (#306); an old hash goes to the first track. */
      const cap = captionTracks(doc).find((t) => t.hash === hash) ?? doc.captions;
      if (!cap || ext !== "vtt") return notFound(res);
      if (cap.hash !== hash) {
        res.setHeader("Cache-Control", SHORT);
        return res.redirect(302, captionsUrl(doc)!);
      }
      return sendWhole(req, res, id, cap.name, "text/vtt; charset=utf-8", CSP.text, cap.hash);
    }
    // icon-… or video-…: only for an item of that kind. A replaced one (new hash,
    // or an SVG icon replaced by a PNG) is redirected to what it is now.
    if (doc.kind !== part) return notFound(res);
    if (doc.hash !== hash || EXT[doc.format] !== ext) {
      res.setHeader("Cache-Control", SHORT);
      return res.redirect(302, fileUrl(doc)!);
    }
    if (doc.kind === "video") return sendVideo(req, res, doc);
    return sendWhole(req, res, id, doc.original, MIME[doc.format], doc.format === "svg" ? CSP.svg : CSP.image, doc.hash);
  },
};
