import { useSyncExternalStore } from "react";

/* The admin's phone layout is below 600px; from there up the page is the desktop one. */
const QUERY = "(max-width: 599px)";

export function usePhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(QUERY);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches,
    () => false,
  );
}
