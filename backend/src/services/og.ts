import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { z } from "zod";
import { escapeXml as esc } from "./escape.js";

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

export const OG_FORMATS = ["og", "square", "story"] as const;
export type OgFormat = (typeof OG_FORMATS)[number];

export function isOgFormat(v: unknown): v is OgFormat {
  return typeof v === "string" && (OG_FORMATS as readonly string[]).includes(v);
}

/**
 * Geometry per format. `og` is the original card and must keep rendering
 * byte for byte; `square` and `story` are the same scene recomposed for a
 * feed post and for a story, where the sun sits low and the text stacks above
 * it. The story keeps its text out of the top 250px and bottom 340px that the
 * Instagram and WhatsApp chrome covers.
 */
type Layout = {
  w: number;
  h: number;
  horizon: number;
  padX: number;
  textMaxW: number;
  sunX: number;
  sunY: number;
  /** Optical centre of the title block. */
  titleCentre: number;
  sizes: number[];
  maxLines: number;
  eyebrowGap: number;
  eyebrowSize: number;
  ruleY: number;
  metaY: number;
  metaSize: number;
};

const LAYOUTS: Record<OgFormat, Layout> = {
  og: {
    w: 1200, h: 630, horizon: 430, padX: 78, textMaxW: 620, sunX: 946, sunY: 336,
    titleCentre: 300, sizes: [78, 68, 60, 52, 46], maxLines: 3,
    eyebrowGap: 34, eyebrowSize: 23, ruleY: 524, metaY: 566, metaSize: 22,
  },
  square: {
    w: 1080, h: 1080, horizon: 800, padX: 84, textMaxW: 912, sunX: 760, sunY: 690,
    titleCentre: 350, sizes: [104, 92, 80, 70, 60], maxLines: 4,
    eyebrowGap: 52, eyebrowSize: 28, ruleY: 920, metaY: 986, metaSize: 26,
  },
  story: {
    w: 1080, h: 1920, horizon: 1330, padX: 84, textMaxW: 912, sunX: 700, sunY: 1236,
    titleCentre: 700, sizes: [112, 100, 88, 76, 64], maxLines: 5,
    eyebrowGap: 60, eyebrowSize: 30, ruleY: 1560, metaY: 1630, metaSize: 28,
  },
};

const W = LAYOUTS.og.w;

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

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The bundled fonts have no Hebrew glyphs (they render as tofu), so a card can
 * only be drawn in English. Callers asking for a Hebrew card get the English
 * one until a font with the Hebrew block is bundled and this flips.
 */
export const HEBREW_CARDS = false;

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
function fitTitle(title: string, L: Layout): { size: number; lines: string[] } {
  const clean = truncate(title, 120);
  for (const size of L.sizes) {
    const lines = wrap(clean, FONT_DISPLAY, size, -0.03 * size, L.textMaxW);
    if (lines.length <= L.maxLines) return { size, lines };
  }
  const size = L.sizes[L.sizes.length - 1];
  const lines = wrap(clean, FONT_DISPLAY, size, -0.03 * size, L.textMaxW).slice(0, L.maxLines);
  if (lines.length === L.maxLines) lines[L.maxLines - 1] = `${lines[L.maxLines - 1].replace(/\s+\S*$/, "")}…`;
  return { size, lines };
}

/** The sun's reflection, broken into a glitter path the way moving water does. */
function glitter(cx: number, horizon: number): string {
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
      `<rect x="${(cx - w / 2).toFixed(1)}" y="${horizon + dy}" width="${w}" height="${h}" rx="${(h / 2).toFixed(1)}" fill="${C.sodium}" opacity="${o}"/>`,
    )
    .join("");
}

export function cardSvg(input: OgCardInput, format: OgFormat = "og"): string {
  const L = LAYOUTS[format];
  const { w: W, h: H, horizon: HORIZON, padX: PAD_X } = L;
  const { size, lines } = fitTitle(input.title, L);
  const leading = size * 1.04;

  // Anchor the block on its optical centre so one-line and three-line cards
  // sit in the same place rather than drifting down the frame.
  const blockH = lines.length * leading;
  const titleTop = L.titleCentre - blockH / 2;

  const eyebrow = input.eyebrow ? truncate(input.eyebrow.toUpperCase(), 32) : "";
  const meta = truncate(input.meta ?? "yehudabriskman.com", 64);

  // The ridgelines are drawn once, in the original card's coordinates, and
  // moved onto each format's horizon rather than redrawn per format.
  const ridges =
    format === "og"
      ? { open: "", close: "" }
      : {
          open: `<g transform="translate(0 ${HORIZON - LAYOUTS.og.horizon}) scale(${(W / LAYOUTS.og.w).toFixed(4)} 1)">`,
          close: "</g>",
        };

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
    <linearGradient id="scrim" ${format === "og" ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"'}>
      <stop offset="0%" stop-color="${C.bitumen}" stop-opacity="0.94"/>
      <stop offset="52%" stop-color="${C.bitumen}" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="${C.bitumen}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="above"><rect x="0" y="0" width="${W}" height="${HORIZON}"/></clipPath>
    <clipPath id="below"><rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  <g clip-path="url(#above)">
    <circle cx="${L.sunX}" cy="${L.sunY}" r="300" fill="url(#glow)"/>
    <circle cx="${L.sunX}" cy="${L.sunY}" r="126" fill="${C.sodium}"/>
    ${ridges.open}<path d="M0,372 C160,344 300,368 430,362 C580,355 700,330 860,344 C980,354 1090,346 1200,352 L1200,${LAYOUTS.og.horizon} L0,${LAYOUTS.og.horizon} Z" fill="${C.edge}"/>
    <path d="M0,402 C220,388 430,410 640,400 C820,391 1010,406 1200,396 L1200,${LAYOUTS.og.horizon} L0,${LAYOUTS.og.horizon} Z" fill="#1E2A2C"/>${ridges.close}
  </g>

  <g clip-path="url(#below)">
    <rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#water)"/>
    ${glitter(L.sunX, HORIZON)}
  </g>

  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  ${eyebrow ? `<text x="${PAD_X}" y="${(titleTop - L.eyebrowGap).toFixed(1)}" font-family="${FONT_MONO}" font-size="${L.eyebrowSize}" letter-spacing="5" fill="${C.sodium}">${esc(eyebrow)}</text>` : ""}

  <text font-family="${FONT_DISPLAY}" font-size="${size}" letter-spacing="${(-0.03 * size).toFixed(2)}" fill="${C.bone}">${titleTspans}</text>

  <line x1="${PAD_X}" y1="${L.ruleY}" x2="${PAD_X + 92}" y2="${L.ruleY}" stroke="${C.sodium}" stroke-width="3" stroke-linecap="round"/>
  <text x="${PAD_X}" y="${L.metaY}" font-family="${FONT_MONO}" font-size="${L.metaSize}" letter-spacing="2.4" fill="${C.clay}">${esc(meta)}</text>
</svg>`;
}

/** Rendered cards are small and change only when a post is edited. */
const pngCache = new Map<string, Buffer>();
const PNG_CACHE_MAX = 64;

export function renderCardPng(input: OgCardInput, format: OgFormat = "og"): Buffer {
  // The `og` key stays the bare input so existing cache entries are unchanged.
  const key = format === "og" ? JSON.stringify(input) : `${format}:${JSON.stringify(input)}`;
  const hit = pngCache.get(key);
  if (hit) return hit;

  const resvg = new Resvg(cardSvg(input, format), {
    fitTo: { mode: "width", value: LAYOUTS[format].w },
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
