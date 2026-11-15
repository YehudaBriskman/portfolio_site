import { useEffect, useState } from "react";

/*
 * Has the site footer's top reached the bottom floating controls (the Dock, the
 * pinned action, the reading bar)? They get out of the way then, so they never
 * sit on the footer. One IntersectionObserver on the footer, not a scroll
 * listener, and no rAF: it answers "is the footer inside the window shrunk from
 * the bottom by the dock's reach", nothing about direction.
 *
 * `reach` is how far up from the bottom edge the controls extend (dock bottom +
 * pill + a little air). The footer may mount after this does (a route that
 * lazy-loads), so when it is absent a MutationObserver waits for it.
 */
export const DOCK_REACH = 72;

export function useFooterReached(enabled = true, reach = DOCK_REACH): boolean {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const find = () => document.querySelector<HTMLElement>("footer[data-ph-foot]") ?? document.querySelector<HTMLElement>("footer");
    const watch = (el: HTMLElement) => {
      io = new IntersectionObserver(([e]) => setReached(e.isIntersecting), { root: null, threshold: 0, rootMargin: `0px 0px -${reach}px 0px` });
      io.observe(el);
    };
    const el = find();
    if (el) watch(el);
    else {
      mo = new MutationObserver(() => {
        const f = find();
        if (!f) return;
        mo?.disconnect();
        mo = null;
        watch(f);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      io?.disconnect();
      mo?.disconnect();
      setReached(false);
    };
  }, [enabled, reach]);
  return reached;
}
