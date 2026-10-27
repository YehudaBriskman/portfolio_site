import { useEffect, useState } from "react";
import "./motion-paused.css";

const KEY = "yb-motion-paused";

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
      if (localStorage.getItem(KEY) === "1") setPaused(true);
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
    document.body.classList.toggle("motion-paused", paused);
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
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // See above: the preference still applies for this visit.
      }
      return next;
    });
  };

  return [paused, toggle];
}
