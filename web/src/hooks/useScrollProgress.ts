import { useEffect, type RefObject } from "react";

/*
 * Publishes on <html> and nothing else:
 *   --p          0..1 palette progress, floored to a minimum travel distance
 *   --pr         0..1 unfloored progress through the WHOLE document
 *   --vh         0..n viewports scrolled
 *   --layer-N    0..2 the Nth layer: 0..1 rises to its ridge, 1..2 pushes past
 * Every scroll-linked effect on the site reads these, so there is exactly one
 * scroll listener no matter how many things animate. Deliberately not a React
 * state value: this changes every frame and must never trigger a re-render.
 *
 * ── mounted on one route, deliberately ───────────────────────────────────
 *
 * This used to run on every page, from `Index` and from `PageShell`. An audit
 * measured what that cost and found the home page paying 30fps at 4x CPU
 * throttling for two root custom properties that nothing on it read: --pr's
 * only consumer fell back to a value `ReadingBar` always overwrites inline,
 * and --vh's only consumer is the parallax drift on a project detail page.
 *
 * So it is mounted in `pages/Project.tsx` and nowhere else. The home page,
 * the notes index and every post now have no scroll listener at all, which is
 * the state the rest of the motion system was built to allow: `view()`
 * timelines and IntersectionObservers do not need one.
 *
 * Before adding this to another page, check that something on it actually
 * reads --vh. A write with no reader is invisible, permanent and expensive.
 *
 * ── and on the one element that reads it, when it is given one (#174) ────
 *
 * Measured on a project page at 4x CPU throttle (`scripts/measure-written.mjs`),
 * the root write still re-styled about 1,100 elements every frame of a scroll
 * — 63–80ms of style a frame, a long task on every frame, with the site's
 * Pause on or off. That, and not the pen, was what made a project page's
 * sections slow to appear. Its only reader is one figure's transform, so the
 * page now hands the hook that element and the write lands there: an
 * inherited custom property invalidates the subtree it is set on, and this
 * one is a figure.
 */
export function useScrollProgress(target?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    /* Read per write, not once: the figure renders after the project loads,
       so it is not there on the first frame. Until it is, nothing reads the
       value and nothing is written. */
    const at = (): HTMLElement | null => (target ? target.current : document.documentElement);
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
    let last: Record<string, string> = {};
    let lastEl: HTMLElement | null = null;
    const put = (name: string, value: string) => {
      const el = at();
      if (!el) return;
      /* A new element (the page re-rendered it) has none of the old values. */
      if (el !== lastEl) {
        lastEl = el;
        last = {};
      }
      if (last[name] === value) return;
      last[name] = value;
      el.style.setProperty(name, value);
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

      /*
       * One write, three decimals, and it is still the most expensive thing
       * on any page that mounts this.
       *
       * These are inherited custom properties on the root, so every write
       * invalidates style for the whole document and re-resolves every var()
       * in it. The `put()` guard suppresses that when the value has not
       * changed, and quantising to a hundredth of a viewport means most
       * frames write nothing.
       *
       * It is not enough on its own. Measured over a six-second scroll at 4x
       * CPU throttling, with this line and the old --pr line stubbed out:
       * 29.9fps and 97.5% dropped frames became 59.9fps and 0.3%, and style
       * recalculation fell from 4.80s to 0.38s of a 6.3s pass. Either write
       * alone held the page at 30fps, so suppressing one saved nothing — the
       * cost is per-frame whole-document invalidation, not per-property.
       *
       * Which is why --pr is gone and why this hook is no longer mounted on
       * every page. It writes one value, for one reader, on one route.
       */
      put("--vh", (Math.round((y / vh) * 100) / 100).toFixed(2));
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
  }, [target]);
}
