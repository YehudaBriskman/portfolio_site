import { useSyncExternalStore } from "react";

/*
 * The site's own Pause (docs/motion-contract.md, "Off-switches"): a class on
 * <body> that every moving thing honours. Read as an external store, like
 * usePrefersReducedMotion, so a component sees the switch the moment it is
 * thrown, not on its next unrelated render.
 */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

const read = () => document.body.classList.contains("motion-paused");
const readOnServer = () => false;

export function useMotionPaused() {
  return useSyncExternalStore(subscribe, read, readOnServer);
}
