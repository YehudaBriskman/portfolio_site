/*
 * The living line's geometry (#176, #178), with no DOM in it.
 *
 * `LivingLine.tsx` measures the boxes and hands them here; this returns the
 * path and the scroll map. Kept apart so the rules below can be held by a
 * test without a browser, because jsdom has no layout and "the line never
 * crosses text" is otherwise a claim nobody checks.
 *
 * THE SHAPE
 * ---------
 * The line visits stations in document order. A station is one of:
 *
 *   - a lane station (`left` / `right`): the line runs straight down the
 *     lane on that side for the station's whole height. The lanes are the
 *     container's own inline padding, which holds no content by
 *     construction, so a straight run there cannot touch text.
 *   - a loop: the line comes down the vertical tangent on the side of the
 *     circle it arrived from (the circle is drawn round the station's
 *     box), meets the circle at its widest point heading down, goes once
 *     round it, and leaves down the same tangent to the circle's foot.
 *     Whatever is inside the box — words, a figure — is inside the circle,
 *     and the circle is drawn outside the box. Its sideways travel is all
 *     done above the circle's top and below its foot, never beside it.
 *
 * Between two stations it swings: a cubic with vertical tangents at both
 * ends, whose control points sit at half the gap, so its height is monotone
 * and it stays inside the gap between the two boxes. The gap between two
 * stations is margin, and margin holds no text.
 *
 * THE SCROLL MAP
 * --------------
 * The line is drawn so that its tip sits on the middle of the window: the
 * container's view timeline is inset by half the window, so timeline
 * progress `p` is the window's middle at `p × height` down the container.
 * Path length is not height — a swing is longer than the drop it makes and a
 * loop is a whole circumference spent on one diameter of drop — so a linear
 * `stroke-dashoffset` would leave the tip hundreds of pixels off the middle
 * by the second loop. Each piece is therefore given a span of height, and
 * the length drawn by height `y` is linear inside each span:
 *
 *   - a lane run and a swing own the height they cover;
 *   - a loop's drop to its widest point and its circle share the circle's
 *     own diameter, top to bottom, so the circle is drawn while it passes
 *     the middle of the window; the run down to its foot (or the hold's)
 *     owns what is left below that.
 *
 * `stops` samples that map at `STOPS + 1` evenly spaced heights, as
 * dash offsets on the path's normalised length (`pathLength="1"`): the
 * keyframe in `LivingLine.module.css` has one percentage per stop and reads
 * each value from a custom property, the only way a measured number can
 * reach a keyframe without an inline stylesheet.
 */

export type Box = { top: number; bottom: number; left: number; right: number };

export type Station =
  | { kind: "left" | "right"; box: Box }
  /**
   * `pad` is the clearance between the box and the circle, in px. `hold`
   * is a taller box round the loop — a principle round its figure — whose
   * height the line spends straight down the circle's side: it arrives at
   * the hold's top and leaves at its bottom, so a loop beside text crosses
   * nothing on the way in or out.
   */
  | { kind: "loop"; box: Box; pad?: number; hold?: Box };

export type Lanes = { left: number; right: number };

export type Trace = {
  /** The SVG path data, in the container's own pixels. */
  d: string;
  /** Total length in px. */
  length: number;
  /** Dash offsets (1 undrawn … 0 drawn) at `i / STOPS` of the container's height. */
  stops: number[];
  /** Every circle drawn, for the tests: centre and radius. */
  loops: { cx: number; cy: number; r: number }[];
};

/** One keyframe percentage per stop: 0%, 1%, … 100%. */
export const STOPS = 100;

type Piece = { length: number; from: number; to: number };

const round = (n: number) => Math.round(n * 100) / 100;

/** Length of a cubic Bézier, by flattening. Plenty for a curve this gentle. */
function cubicLength(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]): number {
  const N = 24;
  let len = 0;
  let [px, py] = p0;
  for (let i = 1; i <= N; i += 1) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

/** A point on the swing between two stations, for the tests. */
export function swingAt(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  const k = (y1 - y0) / 2;
  const u = 1 - t;
  const x = u * u * u * x0 + 3 * u * u * t * x0 + 3 * u * t * t * x1 + t * t * t * x1;
  const y = u * u * u * y0 + 3 * u * u * t * (y0 + k) + 3 * u * t * t * (y1 - k) + t * t * t * y1;
  return [x, y];
}

export function trace(stations: readonly Station[], lanes: Lanes, height: number): Trace {
  const parts: string[] = [];
  const pieces: Piece[] = [];
  const loops: Trace["loops"] = [];
  let at: [number, number] | null = null;
  /* Where the last piece's span ended: every span starts here, so the map is monotone. */
  let spanEnd = 0;

  const swing = (x1: number, y1: number, spanTo: number) => {
    if (!at) {
      parts.push(`M${round(x1)} ${round(y1)}`);
      at = [x1, y1];
      spanEnd = Math.max(spanEnd, y1);
      return;
    }
    const [x0, y0] = at;
    const to: [number, number] = [x1, Math.max(y1, y0)];
    const k = (to[1] - y0) / 2;
    let length: number;
    if (Math.abs(to[0] - x0) < 0.5) {
      parts.push(`L${round(to[0])} ${round(to[1])}`);
      length = to[1] - y0;
    } else {
      parts.push(`C${round(x0)} ${round(y0 + k)} ${round(to[0])} ${round(to[1] - k)} ${round(to[0])} ${round(to[1])}`);
      length = cubicLength([x0, y0], [x0, y0 + k], [to[0], to[1] - k], to);
    }
    const from = spanEnd;
    spanEnd = Math.max(from, spanTo);
    pieces.push({ length, from, to: spanEnd });
    at = to;
  };

  for (const s of stations) {
    if (s.kind === "loop") {
      const { box } = s;
      const cx = (box.left + box.right) / 2;
      const cy = (box.top + box.bottom) / 2;
      const r = Math.max(box.right - box.left, box.bottom - box.top) / 2 + (s.pad ?? 0);
      /* Meet the circle on the side the line is coming from. */
      const fromLeft = at ? at[0] <= cx : true;
      const jx = fromLeft ? cx - r : cx + r;
      /* Arrive above the circle (or the hold), on the circle's side line. */
      const top = Math.min(cy - r, s.hold?.top ?? Infinity);
      const bottom = Math.max(cy + r, s.hold?.bottom ?? -Infinity);
      if (!at) {
        parts.push(`M${round(jx)} ${round(top)}`);
        at = [jx, top];
        spanEnd = Math.max(spanEnd, top);
      } else {
        swing(jx, top, top);
      }
      /* Straight down the side to the circle's widest point. */
      const [, ay] = at;
      const drop = Math.max(0, cy - ay);
      if (drop > 0) parts.push(`L${round(jx)} ${round(cy)}`);
      /*
       * Once round, leaving where it joined. Heading down at the leftmost
       * point is anticlockwise on screen (sweep 0); at the rightmost,
       * clockwise (sweep 1). Two half arcs, because one arc that starts and
       * ends at the same point is no arc at all.
       */
      const sweep = fromLeft ? 0 : 1;
      const ox = fromLeft ? cx + r : cx - r;
      parts.push(`A${round(r)} ${round(r)} 0 0 ${sweep} ${round(ox)} ${round(cy)}`);
      parts.push(`A${round(r)} ${round(r)} 0 0 ${sweep} ${round(jx)} ${round(cy)}`);
      const from = spanEnd;
      spanEnd = Math.max(from, cy + r);
      pieces.push({ length: drop + 2 * Math.PI * r, from, to: spanEnd });
      loops.push({ cx, cy, r });
      at = [jx, cy];
      /*
       * And straight down the same side to the circle's foot, or the hold's.
       * Never a swing straight out of the widest point: heading for the
       * other lane from there would cut through the lower half of the
       * circle, and the words in it.
       */
      parts.push(`L${round(jx)} ${round(bottom)}`);
      const f = spanEnd;
      spanEnd = Math.max(f, bottom);
      pieces.push({ length: bottom - cy, from: f, to: spanEnd });
      at = [jx, bottom];
    } else {
      const x = s.kind === "left" ? lanes.left : lanes.right;
      swing(x, s.box.top, s.box.top);
      swing(x, s.box.bottom, s.box.bottom);
    }
  }

  const length = pieces.reduce((n, p) => n + p.length, 0);
  const drawnBy = (y: number) => {
    let done = 0;
    for (const p of pieces) {
      if (y >= p.to) done += p.length;
      else if (y > p.from) done += (p.length * (y - p.from)) / (p.to - p.from);
      else break;
    }
    return done;
  };
  const stops = Array.from({ length: STOPS + 1 }, (_, i) => {
    if (length <= 0) return 0;
    const off = 1 - drawnBy((i / STOPS) * height) / length;
    return Math.round(Math.min(1, Math.max(0, off)) * 1e4) / 1e4;
  });

  return { d: parts.join(" "), length, stops, loops };
}
