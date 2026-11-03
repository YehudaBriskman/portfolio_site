/*
 * The hero's aurora ribbon, as geometry. No DOM in it.
 *
 * One line of light that goes round the figure: it starts behind the head,
 * sweeps out past the shoulder on the figure's left, comes back across the
 * front of the chest, and runs off toward the right edge of the page,
 * dipping below the bottom of the screen — under the dark act that slides
 * up over the hero.
 *
 * It is drawn in the photograph's own pixels (551×845, the `width` and
 * `height` on the `<img>`), so the head and the chest are where the file
 * says they are at every window size: `HeroRibbon.module.css` sizes the box
 * to the image's rendered rect, which is `object-fit: contain` at the
 * bottom. Points outside 0..551 are past the photograph's edge, which the
 * ribbon needs and the hero clips horizontally.
 *
 * THE DEPTH
 * ---------
 * Each key point carries a depth, 0 far behind the figure to 1 nearest the
 * reader. Depth sets the ribbon's width (wider in front, as perspective
 * would), and the split: everything before `SIDE` is drawn behind the
 * photograph and everything after it in front. The split sits at the left
 * extreme of the sweep, which is clear of the silhouette, so the seam
 * between the two layers is never on top of the figure and never seen.
 *
 * The strands are the site's one ribbon (`motion/ribbon.ts`), offset across
 * the line by depth rather than by a fixed half-width.
 */
import { strandOffset, type StrandOptions } from "@/components/motion/ribbon";

export const FIG_W = 551;
export const FIG_H = 845;

type Key = { x: number; y: number; z: number };

/*
 * Read off the cut-out's alpha: the head spans x 208–421 at y 30–280, the
 * shoulders start at y 320, the torso is x 20–525 at y 450–600. The
 * photograph fades out over its top 40% (`Hero.module.css`: half strength
 * at y 127), so a ribbon born behind the back of the skull, at hair height,
 * is partly hidden by the head rather than wholly — which is the owner's
 * "starts behind the head".
 */
const HEAD: Key[] = [
  { x: 385, y: 92, z: 0 }, // behind the back of the skull, in the hair
  { x: 300, y: 98, z: 0.03 },
  { x: 210, y: 116, z: 0.07 }, // leaving the head above the glasses
  { x: 90, y: 196, z: 0.16 },
  { x: -40, y: 320, z: 0.32 },
  { x: -100, y: 430, z: 0.5 }, // the side: the far left of the sweep
  { x: -60, y: 505, z: 0.62 },
  { x: 60, y: 530, z: 0.78 }, // onto the front of the torso
  { x: 250, y: 518, z: 0.95 }, // across the chest
  { x: 450, y: 505, z: 1 },
];

/*
 * After the chest the line runs to the right of the page and only then
 * dips, so the tail depends on how much page there is to the figure's right.
 * Measured against the rendered photograph (1440×900: 0.755px a unit from
 * x 512; 390×844 with the phone's 0.72 squeeze: 0.474px a unit about 201px):
 *
 *   wide    turns down at 1050–1098, about 90–93% of a 1440 window, outside
 *           the end corner's phrase (which ends at 1256px, unit 985)
 *   narrow  turns down at 600–650, 360–383px of a 390 window: inside the
 *           window, right of the end corner's phrase (ends at 369px)
 */
const TAILS = {
  wide: [
    { x: 620, y: 500, z: 0.97 }, // past the arm, toward the right of the page
    { x: 800, y: 505, z: 0.94 },
    { x: 960, y: 535, z: 0.9 },
    { x: 1050, y: 610, z: 0.87 }, // turning down near the page's right edge
    { x: 1085, y: 720, z: 0.85 },
    { x: 1095, y: 860, z: 0.84 },
    { x: 1098, y: 1000, z: 0.84 }, // below the screen's floor, under the act
  ],
  narrow: [
    { x: 560, y: 505, z: 0.96 },
    { x: 620, y: 560, z: 0.92 },
    { x: 645, y: 680, z: 0.88 },
    { x: 650, y: 860, z: 0.85 },
    { x: 650, y: 1000, z: 0.84 },
  ],
} satisfies Record<string, Key[]>;

export type RibbonTail = keyof typeof TAILS;

/** The key point the layers split at: the left extreme, clear of the figure. */
const SIDE = 4;

/** How many samples per key-to-key span. */
const STEPS = 28;

/** Half the ribbon's width in image pixels, far and near. */
const HALF_FAR = 5;
const HALF_NEAR = 17;

type Sample = {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  s: number;
};

/* A uniform Catmull-Rom through the keys, ends doubled. */
function sample(keys: readonly Key[]): { points: Sample[]; split: number } {
  const at = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))];
  const raw: Omit<Sample, "s">[] = [];
  let split = 0;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    if (i === SIDE) split = raw.length;
    for (let k = 0; k < STEPS; k += 1) {
      const t = k / STEPS;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      const dcr = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (-a +
          c +
          2 * (2 * a - 5 * b + 4 * c - d) * t +
          3 * (-a + 3 * b - 3 * c + d) * t2);
      const tx = dcr(p0.x, p1.x, p2.x, p3.x);
      const ty = dcr(p0.y, p1.y, p2.y, p3.y);
      const len = Math.hypot(tx, ty) || 1;
      raw.push({
        x: cr(p0.x, p1.x, p2.x, p3.x),
        y: cr(p0.y, p1.y, p2.y, p3.y),
        z: p1.z + (p2.z - p1.z) * t,
        tx: tx / len,
        ty: ty / len,
      });
    }
  }
  const last = keys[keys.length - 1];
  const prev = raw[raw.length - 1];
  raw.push({ x: last.x, y: last.y, z: last.z, tx: prev.tx, ty: prev.ty });

  let s = 0;
  const points = raw.map((p, i) => {
    if (i) s += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    return { ...p, s };
  });
  return { points, split };
}

const fix = (n: number) => String(Math.round(n * 10) / 10);

const path = (pts: readonly [number, number][]) =>
  pts.map(([x, y], k) => `${k ? "L" : "M"}${fix(x)} ${fix(y)}`).join("");

export type RibbonPaths = {
  /** One path per strand, behind the figure. */
  back: string[];
  /** The same strands, in front of it, starting where `back` ends. */
  front: string[];
  /** The centre line, behind and in front, for the haze under the strands. */
  spineBack: string;
  spineFront: string;
};

export function heroRibbon(count = 7, tail: RibbonTail = "wide"): RibbonPaths {
  const { points, split } = sample([...HEAD, ...TAILS[tail]]);
  const length = points[points.length - 1].s;
  /* Gathered to a point behind the head, where the ribbon is born; it
     leaves the screen at full width, so the tail is not tapered. */
  const o: StrandOptions = { count, half: 1, wave: 260, phase: 0.7 };
  const taper = 110;
  const smooth = (t: number) => {
    const k = Math.min(1, Math.max(0, t));
    return k * k * (3 - 2 * k);
  };

  const strands = Array.from({ length: count }, (_, i) =>
    points.map((p): [number, number] => {
      const half =
        (HALF_FAR + (HALF_NEAR - HALF_FAR) * p.z) * smooth(p.s / taper);
      const off = strandOffset(i, count, p.s, length, o) * half;
      return [p.x - p.ty * off, p.y + p.tx * off];
    }),
  );
  const spine = points.map((p): [number, number] => [p.x, p.y]);

  return {
    back: strands.map((pts) => path(pts.slice(0, split + 1))),
    front: strands.map((pts) => path(pts.slice(split))),
    spineBack: path(spine.slice(0, split + 1)),
    spineFront: path(spine.slice(split)),
  };
}
