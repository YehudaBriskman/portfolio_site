import { z } from "zod";
import { SIG_SVG_MAX_BYTES } from "./sanitize.js";
import { StrokesSchema, type Strokes } from "./strokes.js";

export const SIG_LANGS = ["en", "he"] as const;
export type SigLang = (typeof SIG_LANGS)[number];
export const SigLangParam = z.enum(SIG_LANGS);

/* The uses the owner can switch on. Each defaults to OFF until they do. */
export const SIG_USES = ["email", "posts", "cards"] as const;
export const ShowSchema = z.object({ email: z.boolean(), posts: z.boolean(), cards: z.boolean() }).strict();
export type SigShow = z.infer<typeof ShowSchema>;
export const DEFAULT_SHOW: SigShow = { email: false, posts: false, cards: false };
export const ShowBody = z.object({ show: ShowSchema }).strict();

/* The alt text is the owner's own words (default: the typed name), shown to screen readers and when images are off. */
const Alt = z.string().trim().min(1, "Alt text is required.").max(120);
const Ink = z.string().regex(/^#[0-9a-fA-F]{6}$/, "A colour like #1a1a1a.");
export const PNG_B64_MAX = 1_000_000;

/*
 * One body per way of making a signature. A drawn one is only strokes (the
 * server writes the SVG); an uploaded SVG is text that is rebuilt from an
 * allow-list; an uploaded raster is a PNG the browser has already cleaned.
 */
export const SlotBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("strokes"), alt: Alt, strokes: StrokesSchema, ink: Ink.default("#1a1a1a"), light: z.boolean().default(true) }).strict(),
  z.object({ kind: z.literal("svg"), alt: Alt, svg: z.string().min(10).max(SIG_SVG_MAX_BYTES), recolor: z.boolean().default(false), ink: Ink.default("#1a1a1a"), light: z.boolean().default(true) }).strict(),
  z.object({ kind: z.literal("png"), alt: Alt, png: z.string().min(16).max(PNG_B64_MAX).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Not base64."), light: z.boolean().default(true) }).strict(),
]);
export type SlotInput = z.infer<typeof SlotBody>;

export type SigSlotDoc = {
  _id: string;
  _rev?: string;
  type: "signature";
  lang: SigLang;
  /** drawn: re-editable from `strokes`; uploaded: a file the owner made. */
  mode: "drawn" | "uploaded";
  /** What the website gets: an SVG (inline, themeable) or a PNG. */
  format: "svg" | "png";
  alt: string;
  ink: string;
  light: boolean;
  hash: string;
  /** Display size in CSS px; the email PNG is exactly twice this. */
  width: number;
  height: number;
  strokes?: Strokes;
  updatedAt: string;
  _attachments?: Record<string, unknown>;
};
export type SigShowDoc = { _id: "signature:show"; _rev?: string; type: "signature-show"; show: SigShow; updatedAt: string };

export const slotId = (lang: SigLang) => `signature:${lang}`;
export const SHOW_ID = "signature:show";

/* What the admin sees of a slot, and what the audit log keeps: never the alt text or the drawing. */
export const slotView = (d: SigSlotDoc) => ({
  lang: d.lang,
  mode: d.mode,
  format: d.format,
  alt: d.alt,
  ink: d.ink,
  light: d.light,
  hash: d.hash,
  width: d.width,
  height: d.height,
  updatedAt: d.updatedAt,
  ...(d.strokes ? { strokes: d.strokes } : {}),
  urls: urlsOf(d),
  /* The owner's own copies, behind the admin gate: they work while every public use is still off. */
  preview: {
    web: `/api/admin/signature/${d.lang}/file/web?v=${d.hash}`,
    email: `/api/admin/signature/${d.lang}/file/email?v=${d.hash}`,
    emailLight: d.light ? `/api/admin/signature/${d.lang}/file/email-light?v=${d.hash}` : null,
  },
});
export const slotAudit = (d: SigSlotDoc | null) => (d ? { lang: d.lang, mode: d.mode, format: d.format, hash: d.hash, light: d.light } : null);

export function urlsOf(d: Pick<SigSlotDoc, "lang" | "hash" | "format" | "light">) {
  const base = `/api/signature/${d.lang}/${d.hash}`;
  return { web: `${base}.${d.format}`, email: `${base}-email.png`, emailLight: d.light ? `${base}-email-light.png` : null };
}
