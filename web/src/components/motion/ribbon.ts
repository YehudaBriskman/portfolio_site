/*
 * The ribbon: the aurora's ribbon, as geometry (#192, #191). No DOM in it.
 *
 * The owner asked for the aurora to be thicker, "preferably not one fat
 * stroke but a bunch of fine lines like the current one, offset and phased,
 * to form a ribbon" — and for the living line to take the same look. This
 * is that ribbon for any path: hand it points along a line with the line's
 * direction at each, and it returns one path per strand.
 *
 * Each strand sits at its own offset across the ribbon and drifts about it
 * on a slow sine of the distance along the line, with its own wavelength
 * and phase, so the strands braid — crossing and parting — rather than
 * running as parallel rails. Offset plus drift never exceeds `half`, so the
 * ribbon is exactly as wide as its caller says and a caller's clearance
 * from text is the whole of the argument. With `taper` the ribbon gathers
 * to a single point at each end (the living line's start, and its end).
 *
 * Every strand has the same number of points at the same distances along
 * the line, so a dash drawn on `pathLength="1"` reaches the same place on
 * every strand at once: the ribbon draws as one.
 *
 * The look of each strand (weight, opacity) is the stylesheet's, by index:
 * `Strands.tsx` renders them, `motion/Strands.module.css` dresses them.
 */

export type StrandPoint = { x: number; y: number; s: number; tx: number; ty: number };

export type StrandOptions = {
  count: number;
  /** Half the ribbon's width, in the points' units. */
  half: number;
  /** The wavelength of a strand's drift, in units of `s`. */
  wave: number;
  /** Gather the ribbon to a point over this distance at each end (0: none). */
  taper?: number;
  /** Where the drift starts, so two ribbons need not braid alike. */
  phase?: number;
  /**
   * Offset across, as a direction, instead of the line's normal. The run's
   * aurora is drawn in a stretched viewBox where a normal is not a normal,
   * so it offsets straight up and down.
   */
  across?: [number, number];
};

/** Where strand i of n sits across the ribbon, and how far it drifts, as shares of `half`. */
const SPREAD = 0.6;
const DRIFT = 0.4;

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** The offset of strand i at distance s along a line `length` long. */
export function strandOffset(i: number, n: number, s: number, length: number, o: StrandOptions): number {
  const base = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
  /* Golden-ratio wavelengths and phases: no two strands repeat each other. */
  const frac = (i * 0.618034) % 1;
  const wave = o.wave * (0.75 + 0.5 * frac);
  const phase = (o.phase ?? 0) + i * 2.399963;
  const drift = Math.sin((2 * Math.PI * s) / wave + phase);
  const t = o.taper ? Math.min(smooth(s / o.taper), smooth((length - s) / o.taper)) : 1;
  return o.half * t * (SPREAD * base + DRIFT * drift);
}

const fix = (n: number) => String(Math.round(n * 100) / 100);

/** One path per strand, as SVG path data. */
export function strandPaths(points: readonly StrandPoint[], o: StrandOptions): string[] {
  if (points.length < 2) return Array.from({ length: o.count }, () => "");
  const length = points[points.length - 1].s;
  return Array.from({ length: o.count }, (_, i) => {
    let d = "";
    points.forEach((p, k) => {
      const [nx, ny] = o.across ?? [-p.ty, p.tx];
      const off = strandOffset(i, o.count, p.s, length, o);
      d += `${k ? "L" : "M"}${fix(p.x + nx * off)} ${fix(p.y + ny * off)}`;
    });
    return d;
  });
}

/*
 * The aurora's colours, the work's own: the projects' teal and green, the
 * dark act's blue and violet, and back to teal so a repeating gradient has
 * no seam. One list for every aurora on the site.
 */
export const AURORA_STOPS: readonly [number, string][] = [
  [0, "rgb(24 142 167)"],
  [0.3, "rgb(58 132 104)"],
  [0.55, "rgb(122 162 232)"],
  [0.8, "rgb(157 103 241)"],
  [1, "rgb(24 142 167)"],
];
