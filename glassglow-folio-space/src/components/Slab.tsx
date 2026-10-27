import type { CSSProperties, ReactNode } from "react";
import { useTilt } from "@/hooks/useTilt";
import styles from "@/components/Slab.module.css";

/*
 * A surface that leans toward the pointer.
 *
 * Purely presentational: it takes whatever it is given — usually an image —
 * and makes it an object in the page rather than a picture pasted onto it. The
 * resting angles are a prop because the pose is a composition decision: a slab
 * on the left of a spread should turn the other way from one on the right, and
 * hard-coding a single pose would line them all up facing the same corner.
 *
 * Inertness is handled entirely in the stylesheet (reduced motion, and narrow
 * viewports where there is no pointer to lean toward), so this component has
 * no breakpoint logic and no second render path.
 */
export default function Slab({
  children,
  restX = 1.5,
  restY = -8,
  max,
  reach,
  className = "",
}: {
  children: ReactNode;
  /* The resting pose in degrees, before any pointer lean is added to it. */
  restX?: number;
  restY?: number;
  /* Passed through to the tilt: peak rotation, and how far outside the slab
     the pointer still moves it. */
  max?: number;
  reach?: number;
  className?: string;
}) {
  const ref = useTilt<HTMLDivElement>({ max, reach });

  /* Only the resting angles are written inline. The transform that consumes
     them stays in the stylesheet, so the media queries there can flatten the
     slab without fighting inline specificity. */
  const pose = {
    "--rest-x": `${restX}deg`,
    "--rest-y": `${restY}deg`,
  } as CSSProperties;

  return (
    <div className={`${styles.scene} ${className}`}>
      <div ref={ref} className={styles.surface} style={pose}>
        {children}
        <span className={styles.sheen} aria-hidden="true" />
      </div>
    </div>
  );
}
