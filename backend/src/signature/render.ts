import { createHash } from "node:crypto";
import sharp from "sharp";

/*
 * Turns a checked signature into the files the site and the newsletter use.
 * Email clients (Gmail, Outlook) draw no SVG, so every signature also gets a
 * transparent PNG at 2x of its display size: at most 480 x 240 px, shown at
 * 240 x 120. A light variant exists for dark mode, because a dark ink on a
 * dark background disappears and a halo would show as a smudge on a light one.
 * Pure: bytes in, bytes out, no store.
 */

export const EMAIL_MAX_W = 480;
export const EMAIL_MAX_H = 240;
export const WEB_RASTER_MAX_W = 960;
export const LIGHT_INK = "#f5f1ea";
const MAX_PIXELS = 16_000_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class SignatureRejected extends Error {
  constructor(
    readonly status: 400 | 413 | 415 | 422,
    message: string,
  ) {
    super(message);
  }
}

sharp.cache(false);
sharp.concurrency(1);

export type Rendered = {
  /** What the site draws; null for a raster, which is its own `webPng`. */
  svg: string | null;
  webPng: Buffer | null;
  emailPng: Buffer;
  emailLightPng: Buffer | null;
  /** Display size in CSS px: half the email PNG, so width and height attributes can be written. */
  width: number;
  height: number;
  hash: string;
};

const hashOf = (...parts: Array<string | Buffer>) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p).update("\0");
  return h.digest("hex").slice(0, 16);
};

const toEmail = (input: sharp.Sharp) =>
  input.resize({ width: EMAIL_MAX_W, height: EMAIL_MAX_H, fit: "inside", withoutEnlargement: false }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });

/** An SVG made of our own paths (drawn or sanitised) as the site's vector and the email PNGs. */
export async function renderVector(svg: string, opts: { ink: string; light: boolean }): Promise<Rendered> {
  const paint = (colour: string) => sharp(Buffer.from(svg.replaceAll("currentColor", colour)), { density: 288, limitInputPixels: MAX_PIXELS });
  const main = await toEmail(paint(opts.ink));
  const light = opts.light && svg.includes("currentColor") ? (await toEmail(paint(LIGHT_INK))).data : null;
  return {
    svg,
    webPng: null,
    emailPng: main.data,
    emailLightPng: light,
    width: Math.round(main.info.width / 2),
    height: Math.round(main.info.height / 2),
    hash: hashOf(svg, opts.ink, String(Boolean(light))),
  };
}

/** A transparent PNG (the editor has already removed the background): validated, cropped, capped and re-encoded without metadata. */
export async function renderRaster(png: Buffer, opts: { light: boolean }): Promise<Rendered> {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_MAGIC)) throw new SignatureRejected(415, "That is not a PNG.");
  let meta: sharp.Metadata;
  try {
    meta = await sharp(png, { limitInputPixels: false }).metadata();
  } catch {
    throw new SignatureRejected(415, "That PNG could not be read.");
  }
  if (!meta.width || !meta.height) throw new SignatureRejected(415, "That PNG could not be read.");
  if (meta.width * meta.height > MAX_PIXELS) throw new SignatureRejected(413, "That image is too large; use one under 16 megapixels.");

  /* Cap the width first so the crop below never holds more than a 960 px wide bitmap. */
  const small = await sharp(png, { limitInputPixels: MAX_PIXELS })
    .ensureAlpha()
    .resize({ width: WEB_RASTER_MAX_W, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = small.info;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (small.data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new SignatureRejected(422, "The picture is empty: no ink is left after the background was removed.");
  const m = 2;
  const left = Math.max(0, x0 - m);
  const top = Math.max(0, y0 - m);
  const cw = Math.min(w, x1 + m + 1) - left;
  const ch = Math.min(h, y1 + m + 1) - top;
  const cropped = sharp(small.data, { raw: { width: w, height: h, channels: 4 } }).extract({ left, top, width: cw, height: ch });
  const webPng = await cropped.clone().png({ compressionLevel: 9 }).toBuffer();
  const email = await toEmail(sharp(webPng));
  let emailLightPng: Buffer | null = null;
  if (opts.light) {
    const alpha = await sharp(email.data).ensureAlpha().extractChannel(3).raw().toBuffer();
    emailLightPng = await sharp({ create: { width: email.info.width, height: email.info.height, channels: 3, background: LIGHT_INK } })
      .joinChannel(alpha, { raw: { width: email.info.width, height: email.info.height, channels: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return {
    svg: null,
    webPng,
    emailPng: email.data,
    emailLightPng,
    width: Math.round(email.info.width / 2),
    height: Math.round(email.info.height / 2),
    hash: hashOf(webPng, String(opts.light)),
  };
}
