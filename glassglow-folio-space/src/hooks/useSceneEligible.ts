import { useEffect, useState } from "react";

/**
 * Can this browser actually create a WebGL context?
 * Checked by trying, once, on a throwaway canvas — not inferred from the user
 * agent. Machines with hardware acceleration disabled, a blocklisted GPU, or a
 * locked-down sandbox report every capability normally and then fail at
 * getContext, which makes three.js throw during render. Catching that in an
 * error boundary works, but it still downloads ~260 KB of three.js to do it.
 * Probing first means those visitors download none of it.
 */
function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Release it immediately; some drivers cap the number of live contexts.
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/*
 * Decides whether this visitor should pay for the 3D layer at all.
 * The scene is a background flourish; it must never cost a phone, a metered
 * connection, or a low-core machine anything. Everything below is checked
 * BEFORE the dynamic import fires, so gated-out visitors download zero bytes
 * of three.js.
 */
export function useSceneEligible() {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");
    const fine = window.matchMedia("(pointer: fine)");
    const contrast = window.matchMedia("(prefers-contrast: more)");

    const evaluate = () => {
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
      };
      setEligible(
        canUseWebGL() &&
          wide.matches &&
          fine.matches &&
          !contrast.matches &&
          nav.connection?.saveData !== true &&
          (navigator.hardwareConcurrency ?? 4) >= 4 &&
          (nav.deviceMemory ?? 4) >= 4
      );
      // Reduced motion does NOT gate the scene out — it renders a still frame.
      // Blank is not an accessible substitute for a static image.
      void reduced;
    };

    evaluate();
    const on = () => evaluate();
    [wide, fine, contrast].forEach((mq) => mq.addEventListener("change", on));
    return () => [wide, fine, contrast].forEach((mq) => mq.removeEventListener("change", on));
  }, []);

  return eligible;
}

/**
 * True while the hero is still on or near screen.
 * Deliberately a scroll check rather than an IntersectionObserver: IO can fire
 * once before layout settles, report not-intersecting, and — on a page nobody
 * has scrolled yet — never fire again, latching the scene off permanently.
 * The hero is always at scroll position 0, so this is exact and has no such race.
 */
export function useHeroOnScreen() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    // No visibilityState check: rAF is already paused in background tabs, so it
    // adds nothing — and some environments report "hidden" for a visible page,
    // which would freeze the scene permanently.
    const evaluate = () => setOn(window.scrollY < window.innerHeight + 200);
    evaluate();
    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);
  return on;
}
