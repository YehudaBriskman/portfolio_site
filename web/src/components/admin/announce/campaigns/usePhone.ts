import { useSyncExternalStore } from "react";

/* The phone layout is below 600px; from 600 the table and the desktop composer stand unchanged. */
export const PHONE_QUERY = "(max-width: 599px)";

export function usePhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
