/*
 * The hero's aurora ribbon, as geometry. No DOM in it.
 *
 * One sweep of light, drawn entirely in front of the figure: it is born to
 * the figure's left, crosses the front of the chest, and curves gently down
 * and to the right, leaving below the screen's floor near the right side —
 * under the dark act that slides up over the hero.
 *
 * Version 2 (#272). The first ribbon (#268) went round the figure: born
 * behind the head, out in a loop to the left, back across the chest, then an
 * S-bend down. Its back half was drawn under the photograph, and the cut-out
 * is soft — the top 40% fades to paper and the alpha feathers at the edge —
 * so the "hidden" half showed through the face. The owner: "it must NOT be
 * visible behind the picture" and "it should just go down-right and not start
 * turning too much". So there is no back half at all, and the line is one
 * cubic Bézier whose control polygon only ever turns one way: one gentle
 * curve, no inflection, no loop.
 *
 * It is drawn in the photograph's own pixels (551×845, the `width` and
 * `height` on the `<img>`), so the chest is where the file says it is at
 * every window size: `HeroRibbon.module.css` sizes the box to the image's
 * rendered rect, which is `object-fit: contain` at the bottom. Points
 * outside 0..551 are past the photograph's edge, which the ribbon needs and
 * the hero clips horizontally.
 *
 * The strands are the site's one ribbon (`motion/ribbon.ts`).
 */
import { strandOffset, type StrandOptions } from "@/components/motion/ribbon";

export const FIG_W = 551;
export const FIG_H = 845;

type Point = { x: number; y: number };
/** A cubic Bézier: start, two controls, end. */
type Sweep = readonly [Point, Point, Point, Point];

/*
 * Read off the cut-out's alpha: the torso is x 20–525 at y 450–600, the
 * chest about y 480–540. Every sweep starts left of the figure, is at chest
 * height across it, and only turns down once it is past the figure's right
 * side. The slopes of the control polygon's three legs rise monotonically,
 * so the curve bends one way only.
 *
 * Where it goes, measured against the rendered photograph (1440×900:
 * 0.755px a unit from x 512; 390×844: about 0.46px a unit, 370px at unit
 * 655):
 *
 *   wide    born off the window's left edge (unit -700 is -16px); leaves at
 *           unit ~1100, about 1340px, already right of the end corner's
 *           phrase (ends at 1256px) by the time it reaches that row
 *   narrow  born just off the left edge; leaves at unit ~678, inside a 390
 *           window and right of the end corner's phrase (ends at 369px),
 *           whose box would otherwise paper over the line
 */
const SWEEPS = {
  wide: [
    { x: -700, y: 450 },
    { x: 500, y: 500 },
    { x: 1060, y: 540 },
    { x: 1100, y: 1010 },
  ],
  narrow: [
    { x: -160, y: 480 },
    { x: 450, y: 490 },
    { x: 665, y: 505 },
    { x: 678, y: 1010 },
  ],
} satisfies Record<string, Sweep>;

export type RibbonTail = keyof typeof SWEEPS;

/** How many samples along the sweep. */
const STEPS = 160;

/** Half the ribbon's width in image pixels. */
const HALF = 15;

type Sample = Point & { tx: number; ty: number; s: number };

function sample([a, b, c, d]: Sweep): Sample[] {
  const raw: Omit<Sample, "s">[] = [];
  for (let k = 0; k <= STEPS; k += 1) {
    const t = k / STEPS;
    const u = 1 - t;
    const at = (p: number, q: number, r: number, w: number) =>
      u * u * u * p + 3 * u * u * t * q + 3 * u * t * t * r + t * t * t * w;
    const dt = (p: number, q: number, r: number, w: number) =>
      3 * u * u * (q - p) + 6 * u * t * (r - q) + 3 * t * t * (w - r);
    const tx = dt(a.x, b.x, c.x, d.x);
    const ty = dt(a.y, b.y, c.y, d.y);
    const len = Math.hypot(tx, ty) || 1;
    raw.push({
      x: at(a.x, b.x, c.x, d.x),
      y: at(a.y, b.y, c.y, d.y),
      tx: tx / len,
      ty: ty / len,
    });
  }
  let s = 0;
  return raw.map((p, i) => {
    if (i) s += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    return { ...p, s };
  });
}

const fix = (n: number) => String(Math.round(n * 10) / 10);

const path = (pts: readonly [number, number][]) =>
  pts.map(([x, y], k) => `${k ? "L" : "M"}${fix(x)} ${fix(y)}`).join("");

export type RibbonPaths = {
  /** One path per strand. */
  strands: string[];
  /** The centre line, for the haze under the strands. */
  spine: string;
};

export function heroRibbon(count = 7, tail: RibbonTail = "wide"): RibbonPaths {
  const points = sample(SWEEPS[tail]);
  const length = points[points.length - 1].s;
  /* Gathered to a point where it is born, left of the figure; it leaves the
     screen at full width, so the tail is not tapered. */
  const o: StrandOptions = { count, half: 1, wave: 260, phase: 0.7 };
  const taper = 140;
  const smooth = (t: number) => {
    const k = Math.min(1, Math.max(0, t));
    return k * k * (3 - 2 * k);
  };

  const strands = Array.from({ length: count }, (_, i) =>
    path(
      points.map((p): [number, number] => {
        const off =
          strandOffset(i, count, p.s, length, o) * HALF * smooth(p.s / taper);
        return [p.x - p.ty * off, p.y + p.tx * off];
      }),
    ),
  );

  return {
    strands,
    spine: path(points.map((p): [number, number] => [p.x, p.y])),
  };
}
