import type { ReactNode } from "react";
import { CURVE_H, CURVE_PATH, CURVE_W, curveY } from "@/components/projects/runCurve";
import { strandPaths, type StrandPoint } from "@/components/motion/ribbon";
import { Strands } from "@/components/motion/Strands";
import AuroraStrand from "@/components/motion/AuroraStrand";
import styles from "@/components/projects/ProjectRun.module.css";

/*
 * The aurora along the run (#181, #192).
 *
 * The owner asked for something that joins all the cards: "an energy line in
 * aurora style, on the place they are sliding". This is that line, drawn on
 * the cards' own path (`runCurve.ts`) behind them, so it shows in the gaps
 * between neighbours and runs out past the first and the last.
 *
 * A RIBBON OF STRANDS (#192). Thicker, and not one fat stroke: seven fine
 * lines braided about the curve, each at its own offset and drifting on its
 * own phase (`motion/ribbon.ts`), under a wide soft haze. The living line
 * on "How I work" and /story is dressed by the same two pieces
 * (`motion/Strands.tsx`), so the site's light is one ribbon in one set of
 * colours.
 *
 * Its colours are the work's: the tints of the projects themselves, teal,
 * green, the dark act's blue and violet, so the light along the line is made
 * of what travels on it.
 *
 * IT SWEEPS IN (#192). The ribbon is not there before the run: it enters
 * from the reading end, the side the cards arrive from, as the stage comes
 * up into the window, and is whole just after the frame pins — ahead of the
 * first card. A soft-edged window slides in from that side while the
 * drawing inside it is carried the other way by the same amount, so the
 * ribbon holds still on the curve and is uncovered rather than dragged. Two
 * transforms on the run's own timeline; scroll back and it leaves the way
 * it came. That appearing is now `motion/AuroraStrand`, shared with "How I
 * work" and the notes shelf, which take it from the left.
 *
 * And one light moves along it: a brighter copy of the strands, seen through
 * a soft window that sweeps from the reading end towards the start once a
 * card, by the same pair of opposite transforms. Nothing is repainted; the
 * scroll is the only clock.
 *
 * Everything here is `aria-hidden` decoration. The stylesheet does the rest,
 * the three off-switches included.
 */

/** Strands in the ribbon, and its half-width in the curve's viewBox units (100 tall). */
const COUNT = 7;
const HALF = 12;
const SAMPLES = 240;

/*
 * The curve's points for the ribbon. The viewBox is stretched to the frame,
 * so a normal in it is not a normal on screen; the strands are offset
 * straight up and down instead, which on a sine this shallow reads the same.
 */
const POINTS: StrandPoint[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const u = i / SAMPLES;
  return { x: u * CURVE_W, y: curveY(u), s: u * CURVE_W, tx: 1, ty: 0 };
});

const RUN_STRANDS = strandPaths(POINTS, { count: COUNT, half: HALF, wave: 210, across: [0, 1] });

function Curve({ className, children }: { className: string; children?: ReactNode }) {
  return (
    <svg
      className={`${styles.curve} ${className}`}
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      {children ?? <path d={CURVE_PATH} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export default function RunAurora() {
  return (
    <div className={styles.aurora} aria-hidden="true" data-run-aurora="">
      {/* The appearing is the shared strand's (`motion/AuroraStrand`): in from
          the reading end, on the run's own clock. */}
      <AuroraStrand
        from="right"
        mirrorInRtl
        timeline="--run"
        range="entry 40% contain 6%"
        gradientId="run-aurora"
        dataAttrs={{ "data-run-sweep": "" }}
      >
        <Curve className={styles.haze} />
        <Curve className={styles.ribbon}>
          <Strands stroke="url(#run-aurora)" ds={RUN_STRANDS} />
        </Curve>
        <div className={styles.surge} data-run-surge="">
          <div className={styles.surgeIn}>
            <Curve className={styles.glow} />
            <Curve className={styles.core}>
              <Strands stroke="rgb(236 244 255)" ds={RUN_STRANDS} />
            </Curve>
          </div>
        </div>
      </AuroraStrand>
    </div>
  );
}
