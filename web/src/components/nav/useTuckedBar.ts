import { useCallback, useEffect, useState } from "react";

/*
 * Is the bar tucked away above the window right now (#161).
 *
 * The bar is a 56px sheet laid over the top of every page, and two of the
 * site's acts are held frames — the pile on the home page and the year on
 * /story — where the thing being read is pinned to the window and the bar sits
 * over the top of it for the whole run. So the bar gets out of the way while
 * the reader is going forward and comes back the moment they turn round, which
 * is the gesture every phone reader already uses to ask for the chrome.
 *
 * What it answers, and what it leaves to CSS
 * ------------------------------------------
 * This says one thing: tucked or not. How the bar leaves — a lift off the top
 * edge and a fade, or only the fade with motion off — is in Nav.module.css,
 * next to the material. And the one case that overrides it is there too:
 * `:has(:focus-visible)` holds the bar on screen whenever keyboard focus is
 * inside it, whatever this hook last said, because a control that receives
 * focus off-screen is a focus ring the reader cannot see.
 *
 * The scroll listener, and why it is not the one `useScrollProgress` warns
 * about
 * --------------------------------------------------------------------------
 * `hooks/useScrollProgress.ts` measured what a scroll listener cost the home
 * page and the finding was specific: a write to a root custom property every
 * frame invalidates style for the whole document. This writes nothing per
 * frame. It reads `scrollY`, keeps two numbers in a closure, and calls
 * `setTucked` — which React drops without rendering when the value is the one
 * it already holds — so the bar renders twice per reversal of direction and
 * not at all in between. There is no rAF, because there is nothing to batch:
 * the handler is a subtraction and a comparison.
 *
 * An IntersectionObserver cannot answer this. It says where things are, not
 * which way the reader is going, and direction is the whole question.
 */

/**
 * How far the reader must travel in one direction before the bar answers, in
 * px. Without it a trackpad's settle — a pixel or two back the other way as a
 * fling comes to rest — brings the bar back at the end of every scroll down.
 */
export const TUCK_SLACK = 12;

/**
 * @param pathname the current route. A new page starts with its bar shown.
 * @param barHeight within this distance of the top the bar never tucks — at
 *   the top of a page there is nothing under it to get out of the way of.
 * @param held while true the bar stays shown: the side panel is open, and the
 *   control that closes it is in the bar.
 * @returns whether the bar is tucked, and a function that brings it back —
 *   called when anything in the bar takes focus, so a reader who tabbed to it
 *   keeps it after their focus moves on, until they next scroll down.
 */
export function useTuckedBar(
  pathname: string,
  barHeight: number,
  held: boolean
): [boolean, () => void] {
  const [tucked, setTucked] = useState(false);
  const reveal = useCallback(() => setTucked(false), []);

  /* A new page, and the side panel opening or closing, each start the bar
     shown. Done while rendering rather than in an effect: React's pattern for
     resetting state when an input changes, which re-renders once, before
     paint, and does not trip react-hooks' set-state-in-effect rule (#156). */
  const [seen, setSeen] = useState({ pathname, held });
  if (seen.pathname !== pathname || seen.held !== held) {
    setSeen({ pathname, held });
    setTucked(false);
  }

  useEffect(() => {
    if (held) return;
    /* `last` is the previous offset; `run` is how far the reader has gone
       since they last changed direction, and `dir` is that direction. */
    let last = Math.max(0, window.scrollY);
    let run = 0;
    let dir = 0;

    const onScroll = () => {
      /* Clamped: iOS reports a negative offset while the page rubber-bands
         past its top, and that pull is upward travel that has already ended. */
      const y = Math.max(0, window.scrollY);
      const d = y - last;
      last = y;
      if (y <= barHeight) {
        run = 0;
        dir = 0;
        setTucked(false);
        return;
      }
      if (d === 0) return;
      const now = d > 0 ? 1 : -1;
      if (now !== dir) {
        dir = now;
        run = 0;
      }
      run += Math.abs(d);
      if (run >= TUCK_SLACK) setTucked(dir > 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [barHeight, held]);

  return [tucked && !held, reveal];
}
