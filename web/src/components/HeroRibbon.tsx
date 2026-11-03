import { AURORA_STOPS } from "@/components/motion/ribbon";
import { Strands } from "@/components/motion/Strands";
import { FIG_H, FIG_W, heroRibbon } from "@/components/heroRibbon";
import styles from "@/components/HeroRibbon.module.css";

/*
 * The aurora ribbon round the figure on the first screen.
 *
 * The owner: the light should wrap *around* him — start behind the head,
 * sweep out to the side, cross in front of the chest, then flow off to the
 * right and dip under the dark act that comes up next. A ring painted over a
 * photograph cannot go behind anything, so it is two layers of one line:
 *
 *   back   inside the portrait's stacking context at `z-index: -1`, under
 *          the photograph, so the head and hair occlude it
 *   front  at `z-index: 1`, over the photograph, its paper fade and its
 *          arrival mask, so it crosses the chest
 *
 * split at the far left of the sweep, where the line is clear of the
 * silhouette (`heroRibbon.ts` has the geometry and the depth). The back half
 * is thinner and dimmer, the front wider and brighter, which with the
 * occlusion is what reads as depth. A WebGL ribbon composited against the
 * photograph's alpha would do the same with a canvas, a context and a frame
 * loop; this is two inline SVGs and no script after the first render.
 *
 * Every path is computed once, when the module loads, from constants. Motion
 * is the stylesheet's, on the hero's `--hero` timeline, and is transforms
 * only. Both layers are decorative and hidden from the accessibility tree.
 */

const PATHS = heroRibbon();
const VIEW = `0 0 ${FIG_W} ${FIG_H}`;
const FRONT_GRADIENT = "hero-aurora-front";
const BACK_GRADIENT = "hero-aurora-back";

/* The gradient runs along x in the drawing's own units, not along each
   path's box, so the colour carries on from the back half into the front. */
const X0 = -100;
const X1 = 1040;
const offsetOf = (x: number) => (x - X0) / (X1 - X0);

/* The back half fades as it goes behind the head: full strength at the
   side, where it meets the front half (so the seam does not show), down to
   a third behind the jaw. That, and the ribbon narrowing with depth, is
   "dimmer and thinner behind". */
const BACK_FROM = offsetOf(-100);
const BACK_TO = offsetOf(330);
const BACK_DIM = 0.32;

const rgb = (c: string) => c.match(/\d+/g)!.map(Number);

/** The aurora's colour at offset t, between its stops. */
function colourAt(t: number): string {
  const i = Math.max(
    1,
    AURORA_STOPS.findIndex(([at]) => at >= t),
  );
  const [a, ca] = AURORA_STOPS[i - 1];
  const [b, cb] = AURORA_STOPS[i];
  const k = b === a ? 0 : Math.min(1, Math.max(0, (t - a) / (b - a)));
  const [p, q] = [rgb(ca), rgb(cb)];
  return `rgb(${p.map((v, j) => Math.round(v + (q[j] - v) * k)).join(" ")})`;
}

const BACK_STOPS = Array.from({ length: 6 }, (_, i) => {
  const t = BACK_FROM + ((BACK_TO - BACK_FROM) * i) / 5;
  return { t, colour: colourAt(t), opacity: 1 - (1 - BACK_DIM) * (i / 5) };
});

function Gradients() {
  return (
    <>
      <linearGradient
        id={FRONT_GRADIENT}
        gradientUnits="userSpaceOnUse"
        x1={X0}
        y1={0}
        x2={X1}
        y2={0}
      >
        {AURORA_STOPS.map(([at, colour]) => (
          <stop key={at} offset={at} stopColor={colour} />
        ))}
      </linearGradient>
      <linearGradient
        id={BACK_GRADIENT}
        gradientUnits="userSpaceOnUse"
        x1={X0}
        y1={0}
        x2={X1}
        y2={0}
      >
        {BACK_STOPS.map(({ t, colour, opacity }) => (
          <stop key={t} offset={t} stopColor={colour} stopOpacity={opacity} />
        ))}
      </linearGradient>
    </>
  );
}

export default function HeroRibbon({ layer }: { layer: "back" | "front" }) {
  const back = layer === "back";
  const stroke = `url(#${back ? BACK_GRADIENT : FRONT_GRADIENT})`;
  return (
    <span
      className={`${styles.layer} ${back ? styles.back : styles.front}`}
      aria-hidden="true"
      data-hero-ribbon={layer}
    >
      <span className={styles.frame}>
        <svg className={styles.haze} viewBox={VIEW} focusable="false">
          {back && (
            <defs>
              <Gradients />
            </defs>
          )}
          <path d={back ? PATHS.spineBack : PATHS.spineFront} stroke={stroke} />
        </svg>
        <svg className={styles.strands} viewBox={VIEW} focusable="false">
          <Strands stroke={stroke} ds={back ? PATHS.back : PATHS.front} />
        </svg>
      </span>
    </span>
  );
}
