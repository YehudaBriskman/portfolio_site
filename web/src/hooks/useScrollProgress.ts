import { useEffect } from "react";

/*
 * Publishes on <html> and nothing else:
 *   --p          0..1 palette progress, floored to a minimum travel distance
 *   --pr         0..1 unfloored progress through the WHOLE document
 *   --vh         0..n viewports scrolled
 *   --layer-N    0..2 the Nth layer: 0..1 rises to its ridge, 1..2 pushes past
 * Every scroll-linked effect on the site reads these, so there is exactly one
 * scroll listener no matter how many things animate. Deliberately not a React
 * state value: this changes every frame and must never trigger a re-render.
 */
export function useScrollProgress() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    /*
     * Nothing to drive under reduced motion.
     *
     * The layers take a static resting pose from CSS in that case (see
     * `.scene-layer` in index.css), and this loop used to keep running anyway:
     * a layout read and four transform writes every frame, all of them
     * immediately overridden. Returning early also means the inline transforms
     * never appear, so the stylesheet's resting rules are the only thing
     * positioning the scene and do not have to fight inline specificity.
     */
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    /*
     * The section list is queried once, not on every frame. querySelectorAll
     * plus a getBoundingClientRect per section, sixty times a second, forces a
     * layout each frame for a list that only changes on navigation or resize.
     */
    /*
     * Nothing to collect any more. This used to query every section and every
     * layer so it could measure one against the other each frame; the scene
     * no longer depends on that relationship.
     */

    /*
     * Writing a custom property on the root invalidates style for everything
     * that reads it, so only write when the value has actually changed. During
     * a slow scroll most frames produce the same rounded value.
     */
    const last: Record<string, string> = {};
    const put = (name: string, value: string) => {
      if (last[name] === value) return;
      last[name] = value;
      root.style.setProperty(name, value);
    };
    const measure = () => {
      raf = 0;

      /*
       * Two numbers and no layout read. The interleaved read-write pass this
       * used to run existed to position the layers against their sections;
       * with the scene static there is nothing to measure.
       */
      const y = window.scrollY;
      const vh = Math.max(1, window.innerHeight);
      const travel = root.scrollHeight - vh;

      put("--vh", (y / vh).toFixed(4));
      put("--pr", (y / Math.max(1, travel)).toFixed(4));
    };

    /*
     * No will-change management left to do. It existed to hint four layer
     * transforms; with nothing transforming, hinting a full-viewport surface
     * would hold a compositor texture for no reason.
     */
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => onScroll();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
