import { useEffect, useState, type ReactNode } from "react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";
import styles from "@/components/ui/SkeletonSwap.module.css";

/*
 * Skeleton to content, as a cross-fade: the placeholder fades out as the
 * content fades in, in the same box, so nothing jumps.
 *
 * `loading` is the state and flips on the event. While it is true the skeleton
 * is drawn and `children` is empty (the caller passes null). When it goes false
 * on a phone with motion allowed the skeleton is kept for the length of the
 * exit as a closed, inert ghost laid over the content (one grid cell) and a
 * timer drops it; the timer never decides what is shown, and nothing listens
 * for an animation or transition event. Elsewhere (desktop, reduced motion) the
 * skeleton goes at once, as before. A page that arrives with its data already
 * there (never loading) draws no cross-fade.
 */
export function SkeletonSwap({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  const motion = usePhoneMotion();
  const [last, setLast] = useState<ReactNode>(skeleton);
  if (loading && last !== skeleton) setLast(skeleton);
  const [was, setWas] = useState(loading);
  const [swapping, setSwapping] = useState(false);
  if (loading !== was) {
    setWas(loading);
    setSwapping(!loading && motion);
  }
  useEffect(() => {
    if (!swapping) return;
    const t = setTimeout(() => setSwapping(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [swapping]);

  const phase = loading ? "loading" : swapping ? "swap" : "ready";
  return (
    <div className={styles.swap} data-phase={phase}>
      {loading ? (
        <div className={styles.slot}>{skeleton}</div>
      ) : swapping ? (
        <div className={styles.slot} data-state="closed" inert aria-hidden="true">
          {last}
        </div>
      ) : null}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
