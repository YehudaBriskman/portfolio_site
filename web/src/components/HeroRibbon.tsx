import { AURORA_STOPS } from "@/components/motion/ribbon";
import { Strands } from "@/components/motion/Strands";
import { FIG_H, FIG_W, heroRibbon } from "@/components/heroRibbon";
import styles from "@/components/HeroRibbon.module.css";

/*
 * The aurora ribbon across the figure on the first screen.
 *
 * One layer, over the photograph, its paper fade and its arrival mask: the
 * line crosses in front of the chest from the left and curves gently down
 * and to the right, off the screen under the dark act that comes up next.
 *
 * There used to be a second layer under the photograph (#268), so the line
 * could go behind the head. The cut-out is soft — its top 40% fades to
 * paper and its alpha is feathered — so the half that was meant to be hidden
 * showed through the face, and the owner ruled it out: nothing of the ribbon
 * may be seen through the figure (#272). Masking a back layer with the
 * picture's alpha would still leave it ghosting through every translucent
 * pixel, and no back layer cannot. `heroRibbon.ts` has the line.
 *
 * Every path is computed once, when the module loads, from constants. Motion
 * is the stylesheet's, on the hero's `--hero` timeline, and is transforms
 * only. The layer is decorative and hidden from the accessibility tree.
 */

const WIDE = heroRibbon();
/* The phone's sweep, which leaves inside its narrower window. */
const NARROW = heroRibbon(7, "narrow");
const VIEW = `0 0 ${FIG_W} ${FIG_H}`;
const GRADIENT = "hero-aurora";

/* The gradient runs along x in the drawing's own units, so the colour moves
   along the sweep the same way on both windows. */
const X0 = -300;
const X1 = 1100;

export default function HeroRibbon() {
  const stroke = `url(#${GRADIENT})`;
  return (
    <span className={styles.layer} aria-hidden="true" data-hero-ribbon="">
      <span className={styles.frame}>
        <svg className={styles.haze} viewBox={VIEW} focusable="false">
          <defs>
            <linearGradient
              id={GRADIENT}
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
          </defs>
          <path className={styles.wide} d={WIDE.spine} stroke={stroke} />
          <path className={styles.narrow} d={NARROW.spine} stroke={stroke} />
        </svg>
        <svg
          className={`${styles.strands} ${styles.wide}`}
          viewBox={VIEW}
          focusable="false"
        >
          <Strands stroke={stroke} ds={WIDE.strands} />
        </svg>
        <svg
          className={`${styles.strands} ${styles.narrow}`}
          viewBox={VIEW}
          focusable="false"
        >
          <Strands stroke={stroke} ds={NARROW.strands} />
        </svg>
      </span>
    </span>
  );
}
