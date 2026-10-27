import { useEffect } from "react";

/*
 * Publishes on <html> and nothing else:
 *   --p          0..1 palette progress, floored to a minimum travel distance
 *   --pr         0..1 true reading progress through the document
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
    let sections: HTMLElement[] = [];
    let layerEls: HTMLElement[] = [];
    const collect = () => {
      sections = [...document.querySelectorAll<HTMLElement>("[data-crest]")];
      layerEls = [...document.querySelectorAll<HTMLElement>("[data-layer]")];
    };
    collect();

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
       * Read everything, then write everything.
       *
       * This used to interleave: write a custom property, read a section's
       * getBoundingClientRect, write another, read again. Every write
       * invalidates style, so each following read forced a synchronous layout —
       * several per frame, and the same rectangles were measured twice. Batching
       * the reads means one layout pass, and the writes that follow cannot
       * invalidate anything we still need to measure.
       */
      const y = window.scrollY;
      const vh = Math.max(1, window.innerHeight);
      const travel = root.scrollHeight - vh;
      const tops = sections.map((section) => section.getBoundingClientRect().top);

      // Require a minimum travel distance before the palette moves. Without
      // this a short page races through every band in one flick of the wheel,
      // which reads as a glitch rather than a descent.
      const max = Math.max(1, travel, vh * 2.5);

      put("--p", (y / max).toFixed(4));
      put("--vh", (y / vh).toFixed(4));
      // --p is floored by the minimum travel above, so on a short post it never
      // reaches 1. A progress indicator driven by it would stop short of the
      // end and lie about it, hence a second, unfloored number.
      put("--pr", (y / Math.max(1, travel)).toFixed(4));

      /*
       * Position the layers. A layer runs from the moment its section's top
       * edge enters at the foot of the screen to the moment that edge reaches
       * the top, then keeps climbing so its colour ends up holding the whole
       * page rather than leaving the previous layer showing above the ridge.
       *
       * Written straight onto the elements. There is no --layer-N custom
       * property any more: nothing consumed it once the transforms moved here,
       * and writing five of them to :root every frame invalidated style for the
       * entire document to feed nobody.
       */
      const REST = 0.28;
      const OVERSHOOT = 0.66;
      for (const el of layerEls) {
        const i = Number(el.dataset.layer);
        if (!i) continue;

        let p: number;
        if (el.dataset.drive === "progress") {
          const count = Number(el.dataset.count) || 1;
          const span = 1 / count;
          const pr = travel > 0 ? y / travel : 0;
          p = (pr - i * span * 0.85) / (span * 0.62);
        } else {
          const top = tops[i];
          if (top === undefined) continue;
          p = (vh - top) / vh;
        }

        const clamped = p < 0 ? 0 : p > 2 ? 2 : p;
        const offset =
          vh - Math.min(clamped, 1) * vh * (1 - REST) - Math.min(Math.max(clamped - 1, 0), 1) * vh * OVERSHOOT;
        const next = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
        if (el.style.transform !== next) el.style.transform = next;
      }
    };

    /*
     * will-change, held only while it is being used.
     *
     * It used to be declared statically on every layer and never released,
     * which keeps a full-viewport compositor texture per layer resident for
     * the whole session — roughly 36MB on a 1440x1080 desktop and 68MB on a
     * 390x844 phone at DPR 3. The hint is worth having during a scroll and
     * worth nothing between them, so it is set on the first frame of a scroll
     * and dropped once the page has been still for a moment.
     */
    let hinted = false;
    let idle = 0;
    const setHint = (on: boolean) => {
      if (hinted === on) return;
      hinted = on;
      for (const el of layerEls) el.style.willChange = on ? "transform" : "";
    };

    const onScroll = () => {
      setHint(true);
      clearTimeout(idle);
      idle = window.setTimeout(() => setHint(false), 200);
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      collect();
      onScroll();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      clearTimeout(idle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
