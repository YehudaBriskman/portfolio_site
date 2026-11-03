import { createHash } from "node:crypto";
import sharp from "sharp";

/*
 * What an upload has to pass, and what is made of it (#253). Pure: bytes in,
 * bytes out, no store and no HTTP, so every rule is tested on its own.
 *
 * The rules:
 *   - The type is read from the bytes, never from the file name or the
 *     Content-Type the client sent. Allowed: JPEG, PNG, WebP, AVIF, and SVG
 *     only when it passes `checkSvg` below. Anything else is refused (415).
 *   - At most MEDIA_MAX_BYTES on the wire and MAX_PIXELS decoded, so a small
 *     file that inflates to a huge bitmap (a decompression bomb) is refused
 *     before it takes the pod's memory.
 *   - Every raster original is decoded and re-encoded with no metadata:
 *     EXIF (camera, serial, and the GPS position of wherever the photo was
 *     taken), XMP and IPTC are gone from the stored original and from every
 *     variant. Orientation is applied to the pixels first, so a portrait
 *     photo stays upright once its EXIF rotation tag is dropped.
 *   - Variants: each width in VARIANT_WIDTHS below the original's, plus the
 *     original width when that is narrower than the widest rung, as AVIF and
 *     WebP. Each variant is addressed by the hash of its own bytes.
 */

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // 40 MP: an 8000 x 5000 photo, decoded ~160 MB
/* The rungs the site's static project screenshots already use (lib/projectImage.ts). */
export const VARIANT_WIDTHS = [400, 800, 1200, 1600] as const;
export const VARIANT_FORMATS = ["avif", "webp"] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];
/** What the bytes are. */
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "svg";
export type MediaFormat = ImageFormat | "mp4" | "webm";
/** What the library item is for: a picture, an icon, or a short video. */
export type MediaKind = "image" | "icon" | "video";
export const MEDIA_KINDS = ["image", "icon", "video"] as const;

export const MIME: Record<MediaFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
};
export const EXT: Record<MediaFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  svg: "svg",
  mp4: "mp4",
  webm: "webm",
};

/* Icons: small, and served as they are, so held to tighter limits. */
export const ICON_MAX_BYTES = 64 * 1024;
const ICON_MAX_SIDE = 1024;

export class MediaRejected extends Error {
  constructor(
    readonly status: 400 | 413 | 415 | 422,
    message: string,
  ) {
    super(message);
  }
}

/*
 * Memory, on a 256 MiB pod: libvips' operation cache is off, and one image
 * is processed at a time (the queue below). A burst of uploads waits its
 * turn rather than holding three decoded bitmaps at once.
 */
sharp.cache(false);
sharp.concurrency(2);
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/* ------------------------------------------------------------ sniffing -- */

export function sniff(buf: Buffer): ImageFormat | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp") {
    // The major brand, then the compatible brands, up to the box's size.
    const size = Math.min(buf.readUInt32BE(0), buf.length, 64);
    const brands: string[] = [buf.toString("latin1", 8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(buf.toString("latin1", i, i + 4));
    if (brands.some((b) => b === "avif" || b === "avis")) return "avif";
    return null; // HEIC and friends: not on the list
  }
  const head = buf.subarray(0, 1024).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return "svg";
  return null;
}

/* ------------------------------------------------------------------ SVG -- */

/*
 * SVG is a document, not a picture: it can carry script, event handlers,
 * external references and entity expansion. It is accepted only when every
 * element and attribute is on a short allowlist of drawing primitives, and
 * refused otherwise — never rewritten, so what is stored is exactly what was
 * checked. And it is never served as SVG: the library rasterises it to the
 * same AVIF/WebP variants as a photo, so the original stays in the store as
 * the source and no visitor's browser ever parses it.
 */
const SVG_ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "path", "rect", "circle", "ellipse", "line",
  "polyline", "polygon", "text", "tspan", "lineargradient", "radialgradient", "stop", "clippath", "mask",
  "pattern",
]);
const SVG_ATTRIBUTES = new Set([
  "xmlns", "xmlns:xlink", "version", "id", "class", "viewbox", "width", "height", "x", "y", "x1", "x2", "y1",
  "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "fill-opacity", "fill-rule", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
  "stroke-dashoffset", "stroke-opacity", "opacity", "transform", "preserveaspectratio", "offset",
  "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "spreadmethod", "fx", "fy",
  "clip-path", "clip-rule", "mask", "clippathunits", "maskunits", "maskcontentunits", "patternunits",
  "patterncontentunits", "patterntransform", "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "dx", "dy", "href", "xlink:href", "role",
  "aria-label", "aria-hidden", "focusable", "xml:space", "visibility", "display",
]);

export function checkSvg(text: string): string | null {
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text)) return "doctype, entities and CDATA are not allowed";
  // Processing instructions other than the XML declaration.
  if (/<\?(?!xml\s)/i.test(text)) return "processing instructions are not allowed";
  const body = text.replace(/<!--[\s\S]*?-->/g, "");
  const tag = /<\/?\s*([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
  const attr = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let seen = 0;
  for (const m of body.matchAll(tag)) {
    seen += 1;
    const name = m[1].toLowerCase();
    if (!SVG_ELEMENTS.has(name)) return `<${name}> is not allowed`;
    for (const a of (m[2] ?? "").matchAll(attr)) {
      const an = a[1].toLowerCase();
      const value = (a[2] ?? a[3] ?? a[4] ?? "").trim();
      if (!SVG_ATTRIBUTES.has(an)) return `the ${an} attribute is not allowed`;
      // References stay inside the document: `#id` and nothing else.
      if ((an === "href" || an === "xlink:href") && !/^#[\w.-]+$/.test(value)) return "only #fragment references are allowed";
      if (/url\(\s*(?!['"]?#)/i.test(value)) return "only url(#fragment) references are allowed";
      if (/javascript:|data:/i.test(value)) return "script and data URLs are not allowed";
    }
  }
  // Anything that looked like markup but did not parse as a tag is refused too.
  const stray = body.replace(tag, "").replace(/<\?xml[^>]*\?>/i, "");
  if (stray.includes("<")) return "markup that could not be checked";
  if (seen === 0) return "no svg element";
  return null;
}

/* ------------------------------------------------------------- process -- */

export type Variant = { width: number; format: VariantFormat; bytes: number; hash: string; name: string };
export type Processed = {
  kind: MediaKind;
  format: MediaFormat;
  width: number;
  height: number;
  /** The cleaned master. Served as-is for an icon and a video; never for an image. */
  original: { name: string; contentType: string; data: Buffer; hash: string };
  /** An image's sizes, or a video's poster sizes. An icon has none. */
  variants: Array<Variant & { data: Buffer }>;
  /** An SVG icon drawn in one colour, so a page may tint it with currentColor. */
  monochrome?: boolean;
  durationMs?: number;
  codecs?: string[];
  hasAudio?: boolean;
  captions?: { name: string; contentType: string; data: Buffer; hash: string; lang: string; label: string } | null;
};

export const hashOf = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);

export function widthsFor(width: number): number[] {
  const below: number[] = VARIANT_WIDTHS.filter((w) => w < width);
  const widest = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];
  if (width <= widest && !below.includes(width)) below.push(width);
  return below.length ? below : [Math.min(width, widest)];
}

function reencode(img: sharp.Sharp, kind: Exclude<ImageFormat, "svg">) {
  // No withMetadata()/keepExif(): sharp writes none unless asked.
  switch (kind) {
    case "jpeg":
      return img.jpeg({ quality: 90, mozjpeg: true });
    case "png":
      return img.png({ compressionLevel: 9 });
    case "webp":
      return img.webp({ quality: 90 });
    case "avif":
      return img.avif({ quality: 70, effort: 4 });
  }
}

export function processUpload(input: Buffer, opts: { maxBytes?: number; raster?: boolean } = {}): Promise<Processed> {
  const max = opts.maxBytes ?? MEDIA_MAX_BYTES;
  if (input.length === 0) return Promise.reject(new MediaRejected(400, "The upload is empty."));
  if (input.length > max) {
    return Promise.reject(new MediaRejected(413, `Images are limited to ${max / 1024 / 1024} MB.`));
  }
  const format = sniff(input);
  if (!format || (opts.raster && format === "svg")) {
    const what = opts.raster ? "JPEG, PNG, WebP and AVIF" : "JPEG, PNG, WebP, AVIF and plain SVG";
    return Promise.reject(new MediaRejected(415, `Only ${what} images are accepted.`));
  }
  return serial(() => (format === "svg" ? processSvg(input) : processRaster(input, format)));
}

async function processRaster(input: Buffer, kind: Exclude<ImageFormat, "svg">): Promise<Processed> {
  const opts = { limitInputPixels: MAX_PIXELS, failOn: "error" as const };
  let meta: sharp.Metadata;
  try {
    // The header only, which decodes no pixels, so the pixel limit is checked here in our words.
    meta = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    throw new MediaRejected(422, "The file could not be read as an image.");
  }
  if (!meta.width || !meta.height) throw new MediaRejected(422, "The file could not be read as an image.");
  if (meta.width * meta.height > MAX_PIXELS) {
    throw new MediaRejected(413, "The image has too many pixels (40 megapixels at most).");
  }
  if ((meta.pages ?? 1) > 1) throw new MediaRejected(415, "Animated images are not accepted.");

  let master: { data: Buffer; info: sharp.OutputInfo };
  try {
    master = await reencode(sharp(input, opts).rotate(), kind).toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaRejected(422, "The file could not be read as an image.");
  }
  const { width, height } = master.info;
  const variants = await makeVariants(() => sharp(master.data, opts), width);
  return {
    kind: "image",
    format: kind,
    width,
    height,
    original: { name: `original.${EXT[kind]}`, contentType: MIME[kind], data: master.data, hash: hashOf(master.data) },
    variants,
  };
}

async function processSvg(input: Buffer): Promise<Processed> {
  const text = input.toString("utf8");
  const problem = checkSvg(text);
  if (problem) throw new MediaRejected(415, `This SVG was refused: ${problem}.`);
  const widest = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new MediaRejected(422, "The SVG could not be drawn.");
  }
  if (!meta.width || !meta.height) throw new MediaRejected(422, "The SVG has no size.");
  // Vector: draw it at the widest rung, whatever its nominal size.
  const height = Math.round((meta.height / meta.width) * widest);
  const density = Math.min(2400, Math.max(72, (72 * widest) / meta.width));
  const variants = await makeVariants(() => sharp(input, { density }), widest);
  return {
    kind: "image",
    format: "svg",
    width: widest,
    height,
    original: { name: "original.svg", contentType: MIME.svg, data: input, hash: hashOf(input) },
    variants,
  };
}

async function makeVariants(source: () => sharp.Sharp, width: number) {
  const out: Processed["variants"] = [];
  for (const w of widthsFor(width)) {
    for (const format of VARIANT_FORMATS) {
      const img = source().resize({ width: w, withoutEnlargement: false });
      const data = await (format === "avif" ? img.avif({ quality: 55, effort: 4 }) : img.webp({ quality: 78 })).toBuffer();
      const hash = hashOf(data);
      out.push({ width: w, format, bytes: data.length, hash, name: `w${w}.${format}`, data });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- icons -- */

/*
 * An icon is served as the file it is, not as raster variants: an SVG stays
 * sharp at every size, and a small PNG has no sizes worth making. So the SVG
 * allowlist above is the whole defence for its content, and the route that
 * serves it adds a `default-src 'none'` policy of its own, so even a file
 * opened directly is a document that can load and run nothing.
 */
export function processIcon(input: Buffer): Promise<Processed> {
  if (input.length === 0) return Promise.reject(new MediaRejected(400, "The upload is empty."));
  if (input.length > ICON_MAX_BYTES) {
    return Promise.reject(new MediaRejected(413, `Icons are limited to ${ICON_MAX_BYTES / 1024} KB.`));
  }
  const format = sniff(input);
  if (format !== "svg" && format !== "png") {
    return Promise.reject(new MediaRejected(415, "Icons must be a plain SVG or a small PNG."));
  }
  return serial(async (): Promise<Processed> => {
    if (format === "svg") {
      const text = input.toString("utf8");
      const problem = checkSvg(text);
      if (problem) throw new MediaRejected(415, `This SVG was refused: ${problem}.`);
      let meta: sharp.Metadata;
      try {
        meta = await sharp(input).metadata();
      } catch {
        throw new MediaRejected(422, "The SVG could not be drawn.");
      }
      if (!meta.width || !meta.height) throw new MediaRejected(422, "The SVG has no size.");
      return {
        kind: "icon",
        format: "svg",
        width: meta.width,
        height: meta.height,
        original: { name: "icon.svg", contentType: MIME.svg, data: input, hash: hashOf(input) },
        variants: [],
        monochrome: isMonochrome(text),
      };
    }
    let meta: sharp.Metadata;
    try {
      meta = await sharp(input, { limitInputPixels: false }).metadata();
    } catch {
      throw new MediaRejected(422, "The file could not be read as an image.");
    }
    if (!meta.width || !meta.height) throw new MediaRejected(422, "The file could not be read as an image.");
    if (meta.width > ICON_MAX_SIDE || meta.height > ICON_MAX_SIDE) {
      throw new MediaRejected(413, `PNG icons are limited to ${ICON_MAX_SIDE} pixels on a side.`);
    }
    let data: Buffer;
    try {
      // Re-encoded like every raster upload, so no text chunks or EXIF survive.
      data = await sharp(input, { failOn: "error" }).png({ compressionLevel: 9 }).toBuffer();
    } catch {
      throw new MediaRejected(422, "The file could not be read as an image.");
    }
    return {
      kind: "icon",
      format: "png",
      width: meta.width,
      height: meta.height,
      original: { name: "icon.png", contentType: MIME.png, data, hash: hashOf(data) },
      variants: [],
      monochrome: false,
    };
  });
}

/*
 * One ink and no gradient or pattern: a page can then draw the icon as a CSS
 * mask filled with currentColor, so it takes the colour of the text around it
 * (and the theme's) without the stored file being rewritten. A shape with no
 * fill of its own paints black, which counts as an ink.
 */
export function isMonochrome(svg: string): boolean {
  if (/<(lineargradient|radialgradient|pattern)\b/i.test(svg)) return false;
  const inks = new Set<string>();
  for (const m of svg.matchAll(/\b(?:fill|stroke|stop-color|color)\s*=\s*["']([^"']*)["']/gi)) {
    const v = m[1].trim().toLowerCase().replace(/\s+/g, "");
    if (["none", "transparent", "currentcolor", "inherit", ""].includes(v)) continue;
    inks.add(v === "black" || v === "#000" ? "#000000" : v === "white" || v === "#fff" ? "#ffffff" : v);
  }
  const inherited = /<(?:svg|g)\b[^>]*\bfill\s*=/i.test(svg);
  const shapes = svg.match(/<(?:path|rect|circle|ellipse|polygon|polyline|text)\b[^>]*>/gi) ?? [];
  if (!inherited && shapes.some((t) => !/\bfill\s*=/i.test(t))) inks.add("#000000");
  return inks.size <= 1;
}
