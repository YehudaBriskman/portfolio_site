import { CURVE_H, CURVE_PATH, CURVE_W } from "@/components/projects/runCurve";
import styles from "@/components/projects/ProjectRun.module.css";

/*
 * The aurora along the run (#181).
 *
 * The owner asked for something that joins all the cards: "an energy line in
 * aurora style, on the place they are sliding". This is that line, drawn on
 * the cards' own path (`runCurve.ts`) behind them, so it shows in the gaps
 * between neighbours and runs out past the first and the last.
 *
 * Its colours are the work's: the tints of the projects themselves, teal,
 * green, the dark act's blue and violet, so the light along the line is made
 * of what travels on it.
 *
 * Two layers rest — a wide soft haze and a narrower band — and one moves: a
 * brighter copy of the line, seen through a soft window that sweeps from the
 * reading end towards the start once a card. The window and the copy inside
 * it are moved by two opposite transforms on the run's own timeline, so the
 * copy holds still on the curve while the light passes along it; nothing is
 * repainted, and the scroll is the only clock. Scroll back and it runs back.
 *
 * Everything here is `aria-hidden` decoration. The stylesheet does the rest,
 * the three off-switches included.
 */

function Curve({ className }: { className: string }) {
  return (
    <svg
      className={`${styles.curve} ${className}`}
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      <path d={CURVE_PATH} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function RunAurora() {
  return (
    <div className={styles.aurora} aria-hidden="true" data-run-aurora="">
      <svg className={styles.defs} focusable="false">
        <defs>
          <linearGradient id="run-aurora" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgb(24 142 167)" />
            <stop offset="0.3" stopColor="rgb(58 132 104)" />
            <stop offset="0.55" stopColor="rgb(122 162 232)" />
            <stop offset="0.8" stopColor="rgb(157 103 241)" />
            <stop offset="1" stopColor="rgb(24 142 167)" />
          </linearGradient>
        </defs>
      </svg>
      <Curve className={styles.haze} />
      <Curve className={styles.band} />
      <div className={styles.surge} data-run-surge="">
        <div className={styles.surgeIn}>
          <Curve className={styles.glow} />
          <Curve className={styles.core} />
        </div>
      </div>
    </div>
  );
}
