/*
 * The pen's clock, as arithmetic (#158). `Written.tsx` hands each word the
 * range `penRange` returns; `inkAt` is what the stylesheet then does with it,
 * stated so a test can hold the per-word progression without a browser.
 */

/**
 * The slice of the paragraph's clock word `i` of `n` is written across, as
 * percentages. Contiguous and disjoint by construction: word `i` ends exactly
 * where word `i + 1` starts, and the last ends at 100%. Rounded to four
 * places, the same rounding on both ends, so neighbours agree to the digit.
 */
export function penRange(i: number, n: number): [string, string] {
  const at = (k: number) => `${Math.round((k / Math.max(1, n)) * 1e6) / 1e4}%`;
  return [at(i), at(i + 1)];
}

/** The alpha on `--ink` an unwritten word rests at (`--pen-muted` in the stylesheet, #174). */
export const PEN_MUTED = 0.22;

/** The clock's `view-timeline-inset`, as fractions of the window: top, then foot (#174). */
export const PEN_INSETS = { top: 0.62, foot: 0.05 };

/**
 * Where in the window (0 top, 1 foot) a word `f` of the way through its
 * paragraph (0 first, 1 last) is when it reaches full ink. The clock runs
 * from the paragraph's top at `1 − foot` to its bottom at `top`, a distance
 * of `h + (1 − foot − top)` windows; the word sits `f·h` below the top and
 * is inked at progress `f`, so the `h` cancels: `(1 − foot) − (1 − foot −
 * top)·f`, whatever the paragraph's height.
 */
export function inkedAt(f: number, insets = PEN_INSETS): number {
  const start = 1 - insets.foot;
  return start - (start - insets.top) * f;
}

/** How inked word `i` of `n` is at clock progress `p` (0..1): 0 muted, 1 ink. */
export function inkAt(p: number, i: number, n: number): number {
  const from = i / n;
  const to = (i + 1) / n;
  if (p <= from) return 0;
  if (p >= to) return 1;
  return (p - from) / (to - from);
}
