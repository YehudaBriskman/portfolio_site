import { useEffect, useState } from "react";
import styles from "@/components/ground/AmbientOrbs.module.css";

/*
 * Four very light, very large colour orbs behind the page, fading in once
 * on load and then standing still (the owner, 2026-11-10: "colors fading in
 * the bg, like in WindoM's main bg the circles of very light color").
 *
 * One fixed, `pointer-events: none` layer behind everything (z-index -1),
 * painted as four radial gradients in ONE background, not four blurred
 * elements: a gradient costs one paint, once, and a `filter: blur` on a
 * large box would cost a rasterised blur layer for as long as the page
 * lives. The only thing that ever changes is the layer's `opacity`, 0 to 1
 * over 1.2s by a CSS transition (no keyframes, so no clock animation for
 * `scrollOnly.test.ts` to list), which the compositor runs without a paint.
 * Reduced motion and Pause skip the fade and show the orbs; print and a
 * forced palette show none. Colours are the `--soft-*` tokens, at an alpha
 * (`--orb-alpha`) tuned per theme so the weakest text on top of the
 * strongest orb still clears 4.5:1 - `test/orbContrast.test.ts` pins that.
 */
export default function AmbientOrbs() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    /* A tick after mount so the first paint is the `opacity: 0` one and the
       change is a transition. (Not requestAnimationFrame: a background tab
       would never run it, and this is not a frame-accurate thing.) */
    const t = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  return <div className={styles.orbs} data-ready={ready ? "" : undefined} aria-hidden="true" data-ambient-orbs="" />;
}
