import { useEffect, useState } from "react";

/*
 * Is a dark panel under the bar.
 *
 * The page is paper everywhere except one act — the pile — and the bar is a
 * translucent sheet of that paper. Over the dark act that sheet composites to
 * a mid grey: no contrast against the panel it is lying on, and none left for
 * the type lying on it. So the bar inverts, and this is the one question it
 * needs answered to know when.
 *
 * A panel opts in rather than being recognised:
 *
 *     <section data-chrome="dark"> … </section>
 *
 * The attribute is the contract. The alternative — the chrome keeping a list
 * of which section ids are dark — is the same drift the index was built to
 * avoid, one beat at a time, and it would be wrong the first time a panel
 * moved. A panel that inverts the ground declares it, and anything that
 * declares it gets the inverted chrome for free.
 *
 * One observer, no scroll listener
 * --------------------------------
 * `rootMargin` does the work a scroll handler would. Collapsing the root to a
 * band that is exactly the strip the bar occupies turns "is this panel behind
 * the bar" into plain intersection, which the browser answers off the main
 * thread and tells us about only when it changes. The site has no scroll
 * listener left but the one in `useScrollProgress`, and the measurements in
 * that file are the reason; the chrome is not adding a second.
 */

/** The selector a panel opts in with. Exported so a test can speak the contract. */
export const DARK_PANEL_SELECTOR = '[data-chrome="dark"]';

/* Same reasoning, and the same value, as the late read in
   `useCollectionIndex`: the panel is in the document on the first paint, but
   which beats exist can change once when the collections API answers. */
const LATE_READ_MS = 900;

/**
 * @param pathname the current route. The chrome does not unmount between
 *   routes, so the panels have to be looked for again when the page changes.
 * @param barBottom how far down the viewport the bar's lower edge sits, in
 *   px. The band this observer watches is the viewport's top edge down to
 *   here — the strip the bar is actually covering.
 */
export function useDarkChrome(pathname: string, barBottom: number): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let late = 0;
    /* How many of the observed panels are currently in the band. A count
       rather than a boolean, because two panels can overlap the band for one
       frame as one scrolls out behind the other, and a boolean would flicker
       the bar back to paper in between. */
    const inBand = new Set<Element>();

    const build = () => {
      observer?.disconnect();
      inBand.clear();

      const panels = document.querySelectorAll(DARK_PANEL_SELECTOR);
      if (panels.length === 0) {
        observer = null;
        setDark(false);
        return;
      }

      /*
       * The band, in px, recomputed because it depends on the window.
       *
       * A percentage would have been tidier and is wrong: `-92%` is 75px on a
       * laptop and 50px on a phone held sideways, and the bar is 56px tall on
       * both. The bottom inset is the whole viewport less the bar, so the
       * root is the bar's own strip and nothing else. Clamped at zero for the
       * degenerate case of a window shorter than its own chrome.
       */
      const below = Math.max(0, Math.round(window.innerHeight - barBottom));
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) inBand.add(e.target);
            else inBand.delete(e.target);
          }
          setDark(inBand.size > 0);
        },
        { rootMargin: `0px 0px -${below}px 0px`, threshold: 0 }
      );
      for (const panel of panels) observer.observe(panel);
    };

    build();
    late = window.setTimeout(build, LATE_READ_MS);

    /*
     * Rebuilt on resize, because the band is measured in px.
     *
     * Not debounced to a frame: a resize already runs at the browser's own
     * rate, constructing one observer over a handful of panels is cheap, and
     * the alternative — a band sized for the window before last — is a bar
     * that forgets to invert.
     */
    window.addEventListener("resize", build);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("resize", build);
      observer?.disconnect();
    };
  }, [pathname, barBottom]);

  return dark;
}
