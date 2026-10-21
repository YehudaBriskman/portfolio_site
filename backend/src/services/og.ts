import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { z } from "zod";

/**
 * Open Graph card rendering.
 *
 * 1200x630 at 1.91:1 is the one size that renders correctly on Facebook, X,
 * LinkedIn, Discord, Slack, WhatsApp and iMessage, so everything here is built
 * around it. Anything load-bearing stays inside the centre 1080x600 — the
 * platforms crop the margins at will, and a title clipped in half looks worse
 * than no card at all.
 *
 * The scene is the site's own hero reduced to its essentials: a sun over a
 * ridgeline, reflected. Same palette, same geometry, so a shared link reads as
 * this site before the title is even parsed.
 */

const W = 1200;
const H = 630;
const HORIZON = 430;

/** Safe-zone left edge for every piece of text on the card. */
const PAD_X = 78;
/** Text must not run under the sun, which sits on the right. */
const TEXT_MAX_W = 620;

const C = {
  bitumen: "#0F1515",
  surface: "#1B2527",
  edge: "#2E3E41",
  bone: "#DCCCC2",
  clay: "#9EA09B",
  sodium: "#E8814A",
} as const;

const FONT_DISPLAY = "OG Display";
const FONT_SANS = "OG Sans";
const FONT_MONO = "IBM Plex Mono";

const MetricsSchema = z.record(
  z.string(),
  z.object({
    upm: z.number(),
    default: z.number(),
    widths: z.record(z.string(), z.number()),
  }),
);
type Metrics = z.infer<typeof MetricsSchema>;

/**
 * Assets live beside the compiled output in production and beside the source in
 * dev. Probing both means `npm run dev` and the container agree without a
 * build-time path substitution.
 */
function assetsDir(): string {
  const candidates = [
    path.join(__dirname, "..", "assets", "fonts"),
    path.join(process.cwd(), "dist", "assets", "fonts"),
    path.join(process.cwd(), "src", "assets", "fonts"),
  ];
  const found = candidates.find((c) => fs.existsSync(path.join(c, "metrics.json")));
  if (!found) {
    throw new Error(`OG font assets not found. Looked in: ${candidates.join(", ")}`);
  }
  return found;
}

let cachedFonts: { files: string[]; metrics: Metrics } | null = null;

function fonts(): { files: string[]; metrics: Metrics } {
  if (cachedFonts) return cachedFonts;
  const dir = assetsDir();
  const metrics = MetricsSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dir, "metrics.json"), "utf8")),
  );
  const files = ["OGDisplay.ttf", "OGSans.ttf", "OGMono.ttf"].map((f) => path.join(dir, f));
  cachedFonts = { files, metrics };
  return cachedFonts;
}

/**
 * Width of a string in px, from the fonts' real advance widths rather than an
 * average — the wrap has to be exact because nothing downstream can reflow it.
 */
function measure(text: string, family: string, size: number, letterSpacing: number): number {
  const m = fonts().metrics[family];
  if (!m) return text.length * size * 0.55;
  let total = 0;
  for (const ch of text) {
    const w = m.widths[String(ch.codePointAt(0))];
    total += (w ?? m.default) * size;
  }
  return total + letterSpacing * Math.max(0, [...text].length - 1);
}

function wrap(text: string, family: string, size: number, letterSpacing: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, family, size, letterSpacing) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export type OgCardInput = {
  /** Small tracked label above the title, e.g. "NOTE" or "PROJECT". */
  eyebrow?: string;
  title: string;
  /** Bottom-left line; the domain is appended when this is omitted. */
  meta?: string;
};

/**
 * Fit the title by stepping down through display sizes until it lands in three
 * lines or fewer, then hard-truncate. Long titles shrink rather than overflow.
 */
function fitTitle(title: string): { size: number; lines: string[] } {
  const clean = truncate(title, 120);
  for (const size of [78, 68, 60, 52, 46]) {
    const lines = wrap(clean, FONT_DISPLAY, size, -0.03 * size, TEXT_MAX_W);
    if (lines.length <= 3) return { size, lines };
  }
  const size = 46;
  const lines = wrap(clean, FONT_DISPLAY, size, -0.03 * size, TEXT_MAX_W).slice(0, 3);
  if (lines.length === 3) lines[2] = `${lines[2].replace(/\s+\S*$/, "")}…`;
  return { size, lines };
}

/** The sun's reflection, broken into a glitter path the way moving water does. */
function glitter(): string {
  const bars: Array<[number, number, number, number]> = [
    // [y offset below horizon, width, height, opacity]
    [6, 168, 9, 0.5],
    [26, 208, 11, 0.42],
    [50, 150, 9, 0.32],
    [78, 116, 8, 0.24],
    [110, 84, 7, 0.17],
    [146, 56, 6, 0.11],
  ];
  return bars
    .map(([dy, w, h, o]) =>
      `<rect x="${(946 - w / 2).toFixed(1)}" y="${HORIZON + dy}" width="${w}" height="${h}" rx="${(h / 2).toFixed(1)}" fill="${C.sodium}" opacity="${o}"/>`,
    )
    .join("");
}

export function cardSvg(input: OgCardInput): string {
  const { size, lines } = fitTitle(input.title);
  const leading = size * 1.04;

  // Anchor the block on its optical centre so one-line and three-line cards
  // sit in the same place rather than drifting down the frame.
  const blockH = lines.length * leading;
  const titleTop = 300 - blockH / 2;

  const eyebrow = input.eyebrow ? truncate(input.eyebrow.toUpperCase(), 32) : "";
  const meta = truncate(input.meta ?? "yehudabriskman.com", 64);

  const titleTspans = lines
    .map((l, i) => `<tspan x="${PAD_X}" y="${(titleTop + leading * (i + 1)).toFixed(1)}">${esc(l)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.bitumen}"/>
      <stop offset="58%" stop-color="${C.surface}"/>
      <stop offset="100%" stop-color="#41504F"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#68746F"/>
      <stop offset="62%" stop-color="#18201F"/>
      <stop offset="100%" stop-color="${C.bitumen}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${C.sodium}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${C.sodium}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.bitumen}" stop-opacity="0.94"/>
      <stop offset="52%" stop-color="${C.bitumen}" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="${C.bitumen}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="above"><rect x="0" y="0" width="${W}" height="${HORIZON}"/></clipPath>
    <clipPath id="below"><rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  <g clip-path="url(#above)">
    <circle cx="946" cy="336" r="300" fill="url(#glow)"/>
    <circle cx="946" cy="336" r="126" fill="${C.sodium}"/>
    <path d="M0,372 C160,344 300,368 430,362 C580,355 700,330 860,344 C980,354 1090,346 1200,352 L1200,${HORIZON} L0,${HORIZON} Z" fill="${C.edge}"/>
    <path d="M0,402 C220,388 430,410 640,400 C820,391 1010,406 1200,396 L1200,${HORIZON} L0,${HORIZON} Z" fill="#1E2A2C"/>
  </g>

  <g clip-path="url(#below)">
    <rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#water)"/>
    ${glitter()}
  </g>

  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  ${eyebrow ? `<text x="${PAD_X}" y="${(titleTop - 34).toFixed(1)}" font-family="${FONT_MONO}" font-size="23" letter-spacing="5" fill="${C.sodium}">${esc(eyebrow)}</text>` : ""}

  <text font-family="${FONT_DISPLAY}" font-size="${size}" letter-spacing="${(-0.03 * size).toFixed(2)}" fill="${C.bone}">${titleTspans}</text>

  <line x1="${PAD_X}" y1="524" x2="${PAD_X + 92}" y2="524" stroke="${C.sodium}" stroke-width="3" stroke-linecap="round"/>
  <text x="${PAD_X}" y="566" font-family="${FONT_MONO}" font-size="22" letter-spacing="2.4" fill="${C.clay}">${esc(meta)}</text>
</svg>`;
}

/** Rendered cards are small and change only when a post is edited. */
const pngCache = new Map<string, Buffer>();
const PNG_CACHE_MAX = 64;

export function renderCardPng(input: OgCardInput): Buffer {
  const key = JSON.stringify(input);
  const hit = pngCache.get(key);
  if (hit) return hit;

  const resvg = new Resvg(cardSvg(input), {
    fitTo: { mode: "width", value: W },
    // Bundled fonts only: the container has no system fonts, and relying on
    // them would make the card render differently in dev and in production.
    font: { fontFiles: fonts().files, loadSystemFonts: false, defaultFontFamily: FONT_SANS },
  });
  const png = Buffer.from(resvg.render().asPng());

  if (pngCache.size >= PNG_CACHE_MAX) {
    const oldest = pngCache.keys().next().value;
    if (oldest !== undefined) pngCache.delete(oldest);
  }
  pngCache.set(key, png);
  return png;
}
