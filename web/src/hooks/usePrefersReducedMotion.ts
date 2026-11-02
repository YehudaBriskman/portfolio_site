import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/* The OS setting is an external store, so it is read as one: no first render
   that claims "no preference" before an effect corrects it. */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const read = () => window.matchMedia(QUERY).matches;
const readOnServer = () => false;

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, read, readOnServer);
}
