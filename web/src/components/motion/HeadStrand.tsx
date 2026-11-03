import { useId } from "react";
import { AuroraGradient, Strands } from "@/components/motion/Strands";
import { strandPaths, type StrandPoint } from "@/components/motion/ribbon";
import Ring from "@/components/motion/Ring";
import styles from "@/components/motion/HeadStrand.module.css";

/*
 * A quiet strand of the aurora under a dashboard's title (#251).
 *
 * The home page's living line and the run's aurora are one ribbon of fine
 * strands in the work's own colours (motion/ribbon.ts). The dashboards copy
 * GitHub's structure and had none of that, so each title now carries a short
 * length of the same ribbon, ending in the line's circle-around — the line
 * passing under the name and going once round a point at its end.
 *
 * Still, deliberately. It sits at the top of the page, where a scroll-driven
 * draw would be on its finished frame for nearly every reader anyway, and a
 * header that moves on its own is the thing the contract rules out. So there
 * is no motion in it and nothing to switch off; forced colours flatten it to
 * CanvasText through the Strands stylesheet.
 *
 * Decorative: the title says everything, so it is hidden from assistive tech.
 */

const W = 220;
const H = 14;

/* A gentle S along the strand's length, so it reads as drawn, not ruled. */
function spine(): StrandPoint[] {
  const pts: StrandPoint[] = [];
  const n = 60;
  let s = 0;
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * (W - 16);
    const y = H / 2 + Math.sin((i / n) * Math.PI * 1.6 + 0.4) * 2.2;
    if (prev) s += Math.hypot(x - prev.x, y - prev.y);
    pts.push({ x, y, s, tx: 1, ty: 0 });
    prev = { x, y };
  }
  return pts;
}

const PATHS = strandPaths(spine(), { count: 5, half: 2.6, wave: 70, taper: 40, phase: 0.6, across: [0, 1] });

export default function HeadStrand({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`${styles.strand} ${className}`.trimEnd()} aria-hidden="true">
      <svg className={styles.svg} viewBox={`0 0 ${W - 12} ${H}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <AuroraGradient id={`hs-${id}`} />
        </defs>
        <Strands stroke={`url(#hs-${id})`} ds={PATHS} />
      </svg>
      <Ring size={12} tone="purple" draw={false} className={styles.tip} />
    </span>
  );
}
