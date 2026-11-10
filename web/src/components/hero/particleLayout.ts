/*
 * Where the particles of the hero word rest: the pure half of `ParticleWord`.
 *
 * Nothing in this file touches the DOM, a canvas or the clock, so every
 * function can be run in node with a seeded RNG and asserted on.
 *
 * THE MATH, AND WHY IT IS THIS AND NOT THE OBVIOUS THING
 * ------------------------------------------------------
 * The word is rasterised by the caller on an offscreen canvas, in the page's
 * own display font, from the real shaped string (so Hebrew joins and Latin
 * kerns exactly as the h1 does). What arrives here is the alpha channel of
 * that picture. Rest positions are samples of the INK, never per-letter
 * coordinates, which is what makes any string work: Latin, Hebrew, digits,
 * accents, a glyph the font substitutes.
 *
 * Sampling is Bridson's fast Poisson-disk sampling (SIGGRAPH 2007: O(N), a
 * background grid of cell r/sqrt(2) holds at most one sample, candidates are
 * drawn from the annulus r..2r around an active sample), restricted to the
 * ink. Against the usual "every Nth pixel" stride it has two properties that
 * matter here: no two dots are closer than r, so the word never clumps or
 * leaves moire-lines along a stencil edge, and the density is even whatever
 * the stroke width is. The number of samples is monotone in r, so the target
 * count is found by bisection on r (about 9 runs, each O(N)). A disconnected
 * word (letters) is handled by seeding one sample per coarse cell that holds
 * ink, because an annulus walk only reaches ink within 2r of what it has.
 *
 * The sampler is deterministic for a given seed (mulberry32), which is what
 * lets the test assert counts and what makes a resize re-sample to nearly
 * the same pattern rather than to a new one.
 */

export type Rng = () => number;

/** mulberry32: a 32-bit seeded generator, uniform in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An alpha mask: one byte per pixel, row-major. */
export type Mask = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

/** Alpha channel of an RGBA ImageData buffer. */
export function maskFromRGBA(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 3; i < data.length; i += 1, j += 4) data[i] = rgba[j];
  return { data, width, height };
}

const INK = 128;

const inked = (m: Mask, x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  return xi >= 0 && yi >= 0 && xi < m.width && yi < m.height && m.data[yi * m.width + xi] >= INK;
};

/** Number of inked pixels: the word's area, in px. */
export function inkArea(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i += 1) if (m.data[i] >= INK) n += 1;
  return n;
}

/**
 * One Poisson-disk pass over the ink with minimum spacing `r`. Writes into
 * `out` (x, y interleaved) and returns the number of samples.
 */
export function poissonOnMask(m: Mask, r: number, seed: number, out: number[]): number {
  out.length = 0;
  const rng = mulberry32(seed);
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(m.width / cell);
  const gh = Math.ceil(m.height / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const active: number[] = [];
  const r2 = r * r;

  const fits = (x: number, y: number) => {
    if (!inked(m, x, y)) return false;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let j = Math.max(0, cy - 2); j <= Math.min(gh - 1, cy + 2); j += 1) {
      for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i += 1) {
        const k = grid[j * gw + i];
        if (k < 0) continue;
        const dx = out[k * 2] - x;
        const dy = out[k * 2 + 1] - y;
        if (dx * dx + dy * dy < r2) return false;
      }
    }
    return true;
  };
  const add = (x: number, y: number) => {
    const k = out.length / 2;
    out.push(x, y);
    grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = k;
    active.push(k);
  };

  /* Seeds: one candidate per coarse cell (4r), jittered, first fit wins.
     This is what reaches letters the annulus walk could not cross to. */
  const coarse = Math.max(4, r * 4);
  for (let y0 = 0; y0 < m.height; y0 += coarse) {
    for (let x0 = 0; x0 < m.width; x0 += coarse) {
      for (let t = 0; t < 8; t += 1) {
        const x = x0 + rng() * coarse;
        const y = y0 + rng() * coarse;
        if (fits(x, y)) {
          add(x, y);
          break;
        }
      }
    }
  }

  const TRIES = 20;
  while (active.length) {
    const ai = Math.floor(rng() * active.length);
    const k = active[ai];
    const px = out[k * 2];
    const py = out[k * 2 + 1];
    let found = false;
    for (let t = 0; t < TRIES; t += 1) {
      const ang = rng() * Math.PI * 2;
      const rad = r * (1 + rng());
      const x = px + Math.cos(ang) * rad;
      const y = py + Math.sin(ang) * rad;
      if (fits(x, y)) {
        add(x, y);
        found = true;
        break;
      }
    }
    if (!found) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }
  return out.length / 2;
}

export type Sampled = { xy: Float32Array; count: number; radius: number };

/**
 * Rest positions for roughly `target` particles over the mask's ink.
 *
 * Bisects the Poisson radius until the count is within `tolerance` of the
 * target (or the iterations run out, keeping the closest), then trims by a
 * seeded shuffle if it is still over. A word with less ink than the target
 * can hold at a 1px spacing returns what fits: the count never forces a
 * dot closer than that.
 */
export function sampleInk(m: Mask, target: number, seed = 1, tolerance = 0.04): Sampled {
  const area = inkArea(m);
  const wanted = Math.max(0, Math.floor(target));
  if (area === 0 || wanted === 0) return { xy: new Float32Array(0), count: 0, radius: 0 };

  /* Poisson-disk packs about 0.7 / r^2 samples per px^2 at saturation; r0
     from the uniform-density estimate is the bracket's centre. */
  const est = Math.sqrt(area / wanted);
  let lo = Math.max(1.0, est * 0.45);
  let hi = est * 1.9;
  const buf: number[] = [];
  let best: number[] = [];
  let bestRadius = est;
  let bestErr = Infinity;

  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    const n = poissonOnMask(m, mid, seed, buf);
    const err = Math.abs(n - wanted) / wanted;
    if (err < bestErr || (err === bestErr && n >= wanted)) {
      bestErr = err;
      best = buf.slice();
      bestRadius = mid;
    }
    if (err <= tolerance) break;
    if (n > wanted) lo = mid;
    else hi = mid;
  }

  let n = best.length / 2;
  const order = Array.from({ length: n }, (_, i) => i);
  /* Over target: drop a seeded random few, which keeps the blue noise (a
     random subset of a Poisson set is still spaced at least r). */
  if (n > wanted) {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.length = wanted;
    order.sort((a, b) => a - b);
    n = wanted;
  }

  /* Reading order (row bands, then x) rather than the sampler's visit order:
     a resize maps old particle i to new particle i, and in reading order that
     is a nearby particle rather than a random one. */
  const pts = order.map((i) => [best[i * 2], best[i * 2 + 1]] as const);
  const band = Math.max(1, bestRadius * 2);
  pts.sort((a, b) => Math.floor(a[1] / band) - Math.floor(b[1] / band) || a[0] - b[0]);
  const xy = new Float32Array(n * 2);
  pts.forEach(([x, y], i) => {
    xy[i * 2] = x;
    xy[i * 2 + 1] = y;
  });
  return { xy, count: n, radius: bestRadius };
}

/* ───────────────────────────────────────────────────────── text and fit */

/** The direction a string is set in, from its first strong character. */
export function textDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (/[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u.test(ch)) return "rtl";
    if (/\p{L}/u.test(ch)) return "ltr";
  }
  return "ltr";
}

export type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * Words (in DOM order) to lines, by their boxes: words whose vertical centres
 * are within half a box of each other share a line. The browser already
 * wrapped the h1, so this reads its answer instead of re-deriving it, which is
 * why the canvas can never disagree with the layout about where a line breaks.
 * Returns word indices per line, in DOM order.
 */
export function groupLines(rects: Rect[]): number[][] {
  const lines: { mid: number; h: number; ids: number[] }[] = [];
  rects.forEach((r, i) => {
    const mid = (r.top + r.bottom) / 2;
    const h = r.bottom - r.top;
    const line = lines.find((l) => Math.abs(l.mid - mid) < Math.max(l.h, h) / 2);
    if (line) line.ids.push(i);
    else lines.push({ mid, h, ids: [i] });
  });
  return lines.sort((a, b) => a.mid - b.mid).map((l) => l.ids);
}

export type Fit = { fontSize: number; lines: number; width: number; height: number };

/**
 * The largest font size at which `words` fit a box, and how many lines that
 * takes. `widthAt1` is the width of a string at font-size 1 (a measurement
 * function, so it is tested without a canvas). Words never split. A line
 * count is tried from 1 to `maxLines`; the greedy balanced break is the one
 * that minimises the widest line (for n lines: bisect the line width cap).
 * `lineHeight` is in em. The result is capped by `maxFont` and floored by
 * nothing: the caller decides whether a result below its minimum is worth
 * drawing (a tiny word is better left to the static h1).
 */
export function fitWords(
  words: string[],
  widthAt1: (s: string) => number,
  maxW: number,
  maxH: number,
  lineHeight: number,
  maxLines = 3,
  maxFont = Infinity,
): Fit {
  const clean = words.filter(Boolean);
  if (clean.length === 0) return { fontSize: 0, lines: 0, width: 0, height: 0 };
  const space = widthAt1(" ");
  const w = clean.map((x) => widthAt1(x));
  const total = w.reduce((a, b) => a + b, 0) + space * (clean.length - 1);
  const longest = Math.max(...w);

  /* Narrowest line width at which the words break into at most n lines. */
  const widest = (n: number) => {
    let lo = longest;
    let hi = total;
    for (let i = 0; i < 30; i += 1) {
      const cap = (lo + hi) / 2;
      let used = 1;
      let x = 0;
      for (let k = 0; k < w.length; k += 1) {
        const add = (x === 0 ? 0 : space) + w[k];
        if (x + add > cap && x > 0) {
          used += 1;
          x = w[k];
        } else x += add;
      }
      if (used <= n) hi = cap;
      else lo = cap;
    }
    return hi;
  };

  let best: Fit = { fontSize: 0, lines: 1, width: 0, height: 0 };
  const limit = Math.min(maxLines, clean.length);
  for (let n = 1; n <= limit; n += 1) {
    const cap = n === 1 ? total : widest(n);
    const size = Math.min(maxW / cap, maxH / (n * lineHeight), maxFont);
    /* Strictly bigger wins, so a tie keeps the fewer lines. */
    if (size > best.fontSize * 1.02) best = { fontSize: size, lines: n, width: cap * size, height: n * lineHeight * size };
  }
  return best;
}

/* ───────────────────────────────────────────────────────── the budget */

export type Device = {
  /** devicePixelRatio, uncapped. */
  dpr: number;
  /** navigator.hardwareConcurrency, or 0 if unknown. */
  cores: number;
  /** navigator.deviceMemory in GB, or 0 if unknown. */
  memory: number;
  /** Width x height of the word's box in CSS px. */
  area: number;
};

/**
 * How many particles to ask for.
 *
 * Dense and fine: about 9000 on a normal desktop, 14000 for a very large word
 * box (the dot count follows the ink area so dots do not thin out on a 4K
 * window), and a lower ceiling where frames are expensive: a high pixel
 * ratio multiplies the fill cost, and few cores or little memory say the
 * machine is weak. Never below 600: under that the word stops reading as a
 * word and the static h1 is the better answer.
 */
export function particleBudget(d: Device): number {
  let n = 9000;
  if (d.area > 800_000) n = 14000;
  else if (d.area < 450_000) n = 6000;
  if (d.cores > 0 && d.cores <= 4) n = Math.min(n, 5000);
  if (d.memory > 0 && d.memory <= 4) n = Math.min(n, 4000);
  if (d.dpr > 2) n = Math.min(n, 6500);
  return Math.max(600, n);
}

/* ───────────────────────────────────────────────────────── the gate */

export type Environment = {
  width: number;
  coarsePointer: boolean;
  noHover: boolean;
  reducedMotion: boolean;
  paused: boolean;
  forcedColors: boolean;
  print: boolean;
  canvas: boolean;
  hasText: boolean;
};

/** Below this the user wants the plain static word (and no orbit objects). */
export const DESKTOP_MIN_WIDTH = 1100;

/**
 * Whether the hero shows the particle word and the orbit constellation.
 * Every other case renders the static h1 exactly as it was.
 */
export function particlesAllowed(e: Environment): boolean {
  return (
    e.canvas &&
    e.hasText &&
    e.width >= DESKTOP_MIN_WIDTH &&
    !e.coarsePointer &&
    !e.noHover &&
    !e.reducedMotion &&
    !e.paused &&
    !e.forcedColors &&
    !e.print
  );
}
