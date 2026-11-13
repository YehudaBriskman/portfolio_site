import { useSyncExternalStore } from "react";

/* Below 600px the admin is a phone: the drawer carries the Marketing sections and the tab strip goes. */
const QUERY = "(max-width: 599px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const read = () => window.matchMedia(QUERY).matches;

export function usePhone() {
  return useSyncExternalStore(subscribe, read, () => false);
}
