/*
 * The one answer to "is motion off?" for code that cannot be a hook (event
 * handlers, effects, plain functions). Two off-switches, documented as
 * equivalent in docs/motion-contract.md: the OS setting and the site's Pause.
 * A missing matchMedia (old engines, some test envs) means nothing asked for less.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function motionPaused(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains("motion-paused");
}

export function motionOff(): boolean {
  return motionPaused() || prefersReducedMotion();
}
