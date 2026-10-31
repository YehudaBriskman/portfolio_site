import { useEffect, useRef, useState } from "react";

/**
 * Fires once, the first time the element reaches the viewport, and then stops
 * observing anything.
 *
 * This is the one thing on the page that a view timeline cannot do, and the
 * reason is the word "once". A scroll-driven animation is tied to a position
 * rather than to an event: scroll back up and it runs backwards, which is
 * right for ink arriving on a card and wrong for a figure counting up, where
 * running backwards would mean a number that counts *down* to zero every time
 * the reader scrolls past it. A count is a statement that lands; it does not
 * un-land.
 *
 * So it is an IntersectionObserver, which this codebase otherwise has none of
 * — see the note at the top of `pages/Index.tsx` about why `Reveal` was
 * deleted. The objection there was a scroll observer and a state update per
 * section, per scroll. This one fires at most once in the life of the page and
 * disconnects itself in the same callback, so it costs one observation and one
 * render and then nothing at all. That is a different thing from a listener.
 *
 * The flag is handed back rather than the class being applied here, because
 * what it should switch is the caller's business: the spec plate uses it to
 * start a time-driven animation from the stylesheet, which is also what lets
 * `prefers-reduced-motion` and the Pause toggle collapse that animation to its
 * final frame without this hook knowing either of them exists.
 */
export function useEnteredOnce<T extends Element>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entered) return;
    const el = ref.current;
    if (!el) return;

    /*
     * No observer, no waiting. An engine without IntersectionObserver gets
     * the figures immediately — which is the same place all three off-switches
     * land, and the only honest fallback for a plate whose whole job is to
     * state true numbers. A count that never fires because the API it needed
     * was missing would leave four noughts on the page.
     */
    if (typeof IntersectionObserver !== "function") {
      setEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setEntered(true);
        /* Disconnected here rather than in the cleanup, so the second pass
           cannot re-arm it: the effect does not re-run on scroll, but it does
           re-run when `entered` changes, and that is exactly the moment the
           observation has stopped being wanted. */
        observer.disconnect();
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [entered, threshold]);

  return [ref, entered] as const;
}
