import { useEffect, useState } from "react";
import { DESKTOP_MIN_WIDTH, particlesAllowed, type Environment } from "@/components/hero/particleLayout";
import { motionPaused, prefersReducedMotion } from "@/hooks/motionOff";

/*
 * Whether the hero shows its desktop-only objects: the particle word and the
 * orbit constellation. One answer for both, so they can never disagree.
 *
 * Every input is a standing condition the reader controls, and each is
 * watched, so the hero falls back to the plain static word the moment one
 * flips (a window dragged below 1100px, Pause pressed, the OS preference
 * changed) and comes back when it flips again:
 *
 *   width >= 1100px        the owner's "UN-mobile": desktop only
 *   (pointer: fine)        no particles to push with a thumb, and no hover
 *   (hover: hover)         a touch laptop in tablet mode is not a desktop
 *   reduced motion         the OS preference (motion-contract §4, switch 1)
 *   body.motion-paused     the site's Pause toggle (switch 2)
 *   forced-colors, print   a forced palette and paper get the static word
 *   no 2D canvas           a browser or a test environment that cannot draw
 *
 * Starts `false` on the server and on first render and is set in an effect,
 * so the static word is what the HTML says and what hydrates.
 */

export function canvasSupported(): boolean {
  if (typeof document === "undefined" || typeof CanvasRenderingContext2D === "undefined") return false;
  try {
    return !!document.createElement("canvas").getContext?.("2d");
  } catch {
    return false;
  }
}

const mq = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;

export function readEnvironment(hasText: boolean): Environment {
  return {
    width: window.innerWidth,
    coarsePointer: mq("(pointer: coarse)"),
    noHover: typeof window.matchMedia === "function" && !mq("(hover: hover)"),
    reducedMotion: prefersReducedMotion(),
    paused: motionPaused(),
    forcedColors: mq("(forced-colors: active)"),
    print: mq("print"),
    canvas: canvasSupported(),
    hasText,
  };
}

const QUERIES = [
  `(min-width: ${DESKTOP_MIN_WIDTH}px)`,
  "(pointer: coarse)",
  "(hover: hover)",
  "(prefers-reduced-motion: reduce)",
  "(forced-colors: active)",
  "print",
];

export function useParticleGate(text: string): boolean {
  const [on, setOn] = useState(false);
  const hasText = text.trim().length > 0;

  useEffect(() => {
    const update = () => setOn(particlesAllowed(readEnvironment(hasText)));
    update();
    if (typeof window.matchMedia !== "function") return;
    const lists = QUERIES.map((q) => window.matchMedia(q));
    for (const l of lists) l.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    const mo = new MutationObserver(update);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      for (const l of lists) l.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      mo.disconnect();
    };
  }, [hasText]);

  return on;
}
