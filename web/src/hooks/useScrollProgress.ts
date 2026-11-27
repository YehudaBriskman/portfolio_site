import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "@/hooks/motionOff";
import { useIsMotionPaused } from "@/hooks/useIsMotionPaused";

/*
 * Writes one custom property, --vh (viewports scrolled), on the element it is
 * given, or on <html> without one. One reader: the cover figure's drift on a
 * project page. Deliberately not a React state value: it changes while the
 * reader scrolls and must never trigger a re-render.
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
  const paused = useIsMotionPaused();
  useEffect(() => {
    /* Read per write, not once: the figure renders after the project loads,
       so it is not there on the first frame. Until it is, nothing reads the
       value and nothing is written. */
    const at = (): HTMLElement | null => (target ? target.current : document.documentElement);
    let raf = 0;

    /* Both off-switches: the drift is set from script, so no stylesheet rule
       can stop it, and a value nothing reads is not worth a listener. */
    if (paused || prefersReducedMotion()) return;

    /* Writing a custom property invalidates style for everything that
       inherits it, so only write when the value has actually changed. */
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

      const y = window.scrollY;
      const vh = Math.max(1, window.innerHeight);

      /*
       * One value, quantised to a hundredth of a viewport so most frames write
       * nothing. Measured over a six-second scroll at 4x CPU throttling, when
       * this and a second property were written on the root: 29.9fps and 97.5%
       * dropped frames against 59.9fps and 0.3% without them, style
       * recalculation 4.80s against 0.38s of a 6.3s pass. Either write alone
       * held the page at 30fps: the cost is per-frame whole-document
       * invalidation, not per-property. Hence the element target.
       */
      put("--vh", (Math.round((y / vh) * 100) / 100).toFixed(2));
    };

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
  }, [target, paused]);
}
