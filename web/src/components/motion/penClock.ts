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

/** How inked word `i` of `n` is at clock progress `p` (0..1): 0 muted, 1 ink. */
export function inkAt(p: number, i: number, n: number): number {
  const from = i / n;
  const to = (i + 1) / n;
  if (p <= from) return 0;
  if (p >= to) return 1;
  return (p - from) / (to - from);
}
