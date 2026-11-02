import { useEffect, useState } from "react";
import "./motion-paused.css";

/**
 * Where the choice is remembered.
 *
 * Exported because one other component has to read it directly. The restore
 * below happens in an effect, so `body.motion-paused` is not on the body
 * during the first render — which every motion component on the site accepts,
 * paying one frame of motion for someone who asked for none. `EntryShutter`
 * cannot: its first frame is the whole window going black, so it reads this
 * key itself rather than waiting for the class. The argument is in that file.
 */
export const MOTION_PAUSED_KEY = "yb-motion-paused";

/**
 * The section the reader is in, and how far through it they are.
 *
 * Toggling Pause collapses every pinned act to its natural height — on the
 * home page that is 2201px of document vanishing at once, as the pile's rail
 * goes 3402 to 1201. The browser's own scroll anchoring does not cover it,
 * because a `position: sticky` box is not a scroll-anchor candidate, so
 * `scrollY` is left exactly where it was and the reader lands somewhere else.
 *
 * Measured before this existed: pressing Pause 55% into the pile took the
 * reader from three pinned cards to the middle of the wall text, two sections
 * back. Unpausing from the wall text threw them forward into the pile.
 * Nothing was ever hidden — the page stayed perfectly legible, which is why
 * it read as the page having jumped rather than as a bug.
 *
 * Holding a single element still does not work here, and the first attempt at
 * this proved it: the only element on screen while the pile is pinned is
 * inside the subtree that collapses, and the section wrapping it does not
 * move at all, so the correction computed zero and changed nothing.
 *
 * What survives the collapse is the reader's *proportional* position within
 * the section they are reading. Three quarters of the way through Work before
 * is three quarters of the way through Work after, whatever Work now measures
 * — which puts them on the collapsed list of the same projects rather than
 * two sections downstream.
 */
type ReadingPosition = { section: HTMLElement; through: number };

function readingPosition(): ReadingPosition | null {
  const boxes = document.querySelectorAll<HTMLElement>("main section, main > div");
  for (const section of boxes) {
    const r = section.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
    /* Travel is the section's own scrollable length. A section shorter than
       the viewport has none, and `through` is then 0 — which is correct: there
       is only one place to be inside it. */
    const travel = Math.max(0, r.height - window.innerHeight);
    const into = -r.top;
    const through = travel === 0 ? 0 : Math.min(1, Math.max(0, into / travel));
    return { section, through };
  }
  return null;
}

function restore({ section, through }: ReadingPosition) {
  const r = section.getBoundingClientRect();
  const top = r.top + window.scrollY;
  const travel = Math.max(0, r.height - window.innerHeight);
  window.scrollTo({ top: top + through * travel, behavior: "auto" });
}

/**
 * Lets the visitor stop the page moving.
 *
 * Separate from the OS `prefers-reduced-motion` setting, and deliberately so:
 * that is a standing preference about every site, this is someone who wants
 * to read *this* page right now without ink arriving around the type.
 * The two compose rather than compete — the OS setting already collapses the
 * same durations from `index.css`, and this adds a second way in for a reader
 * who is not going to go and change a system preference to get through a
 * portfolio.
 *
 * The choice persists, because having to find the control again on every
 * visit would defeat the point of offering it.
 */
export function useMotionPaused(): [boolean, () => void] {
  /*
   * Starts unpaused, with the stored preference read in the effect below
   * rather than in this initialiser.
   *
   * This value is in the markup — it decides the control's label and its
   * `aria-pressed` — and the initialiser runs during the first render. Any
   * future prerender or hydration of this site would therefore have a
   * returning visitor who had pressed Pause hydrating against a tree that
   * disagreed with the served HTML, which React resolves by throwing away the
   * subtree. One frame of motion for someone who asked for none is the price,
   * and it is much the cheaper of the two.
   */
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      /* Reading an external store after mount, on purpose: see the comment on
         the initialiser above for why it cannot be read during render. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(MOTION_PAUSED_KEY) === "1") setPaused(true);
    } catch {
      // Private browsing, or site data blocked. Motion simply stays on; not
      // being able to remember the choice is not a reason to refuse it.
    }
  }, []);

  /* `document.body` is outside the React tree on purpose: the stylesheet
     hangs the paused state off it so every view-timeline animation on the
     page — the ink wipes, the iris panels, the rules that draw themselves —
     stops as well, none of which the nav renders or can reach. */
  useEffect(() => {
    /*
     * Hold the reader's place across the toggle.
     *
     * Pausing collapses every pinned act to its natural height, and on the
     * home page that is 2201px of document disappearing at once: the pile's
     * rail goes 3402 → 1201. The browser's own scroll anchoring does not
     * cover it, because a `position: sticky` box is not a scroll-anchor
     * candidate — so `scrollY` is simply left where it was and the reader
     * lands somewhere else entirely.
     *
     * Measured before this: pressing Pause 55% into the pile moved the
     * reader from three pinned cards to the middle of the wall text, two
     * sections back. Unpausing from the wall text threw them *forward* into
     * the pile. Nothing was ever hidden — the page stayed perfectly legible,
     * which is exactly why it reads as the page having jumped rather than as
     * a bug — but they lost their place in both directions.
     *
     * So: measure a real, non-sticky element's distance from the top of the
     * viewport, flip the class, then put that element back where it was. A
     * sticky element is useless as the reference for the same reason the
     * browser will not use one, and an element inside the collapsing subtree
     * is the thing that moved, so the anchor is chosen from the section
     * boxes themselves.
     */
    /*
     * Only when the class actually changes. This effect also runs on mount,
     * with nothing to toggle, and the restore then was not a no-op: a reader
     * near a section's foot reads as `through` 1, so restoring put that
     * section's bottom at the viewport's — and a cold load of `/#contact` on
     * a phone, already landed under the bar, was thrown 487px off the plate
     * (#196).
     */
    if (document.body.classList.contains("motion-paused") === paused) return;

    const where = readingPosition();

    document.body.classList.toggle("motion-paused", paused);

    /* Read back after the class change so layout has been recomputed; the two
       measurements bracket the only write. */
    if (where) restore(where);
  }, [paused]);

  /*
   * Written here, in the handler, rather than in an effect on `paused`.
   *
   * An effect would also fire on mount — before the effect above has read the
   * stored value — and would write the `false` default over a stored `"1"`.
   * The fix for the hydration mismatch would then have quietly eaten the
   * preference it exists to honour. Only a real press changes what is
   * remembered.
   */
  const toggle = () => {
    setPaused((was) => {
      const next = !was;
      try {
        localStorage.setItem(MOTION_PAUSED_KEY, next ? "1" : "0");
      } catch {
        // See above: the preference still applies for this visit.
      }
      return next;
    });
  };

  return [paused, toggle];
}
