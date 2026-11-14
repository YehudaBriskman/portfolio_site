import { useSyncExternalStore } from "react";

/* The phone layout of Settings: under 600px, the breakpoint the rest of the phone series uses. */
const QUERY = "(max-width: 599.98px)";

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
