import { useEffect, useLayoutEffect, useState } from "react";
import { routeFallbackMounted } from "@/components/motion/shutterReadiness";
import { useWords } from "@/components/dashboard/i18n";
import styles from "@/components/RouteFallback.module.css";

/*
 * What a lazy route shows while its chunk arrives (stability, 2026-11-10).
 *
 * It was `null`: on a slow phone the page under the bar was a blank screen
 * until the script landed. This is a quiet skeleton of a page (a heading and
 * a few lines) that only appears after 200ms, so a route that loads at once
 * never flashes it, and one that does not is not blank. The delay is a timer,
 * not a keyframe, and the bars use the site's own `scrub-pulse`, which already
 * answers to reduced motion and Pause. The one `role="status"` says "Loading";
 * the bars are decoration.
 */
export const FALLBACK_DELAY_MS = 200;

export default function RouteFallback() {
  const [t] = useWords();
  const [shown, setShown] = useState(false);
  /* Tells the entry shutter this route has not arrived. A layout effect so the
     count is right in the same commit the fallback is painted in. */
  useLayoutEffect(() => routeFallbackMounted(), []);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), FALLBACK_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`wrap section-y ${styles.fallback}`} role="status" aria-busy="true">
      <span className="sr-only">{t.routeLoading}</span>
      {shown && (
        <div className={styles.bars} aria-hidden="true" data-route-fallback="">
          <span className={`${styles.bar} ${styles.head} scrub-pulse`} />
          <span className={`${styles.bar} scrub-pulse`} />
          <span className={`${styles.bar} scrub-pulse`} />
          <span className={`${styles.bar} ${styles.short} scrub-pulse`} />
        </div>
      )}
    </div>
  );
}
