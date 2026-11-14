import { useSyncExternalStore } from "react";

/** The admin's phone layout: under 600px, the one breakpoint the phone screens switch on. */
export const PHONE_QUERY = "(max-width: 599px)";

/*
 * True on a phone-width screen. A screen switches on this rather than hiding
 * half of itself in CSS, so a phone never mounts the desktop list it cannot
 * show. Without matchMedia (SSR, old test shims) it is false.
 */
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
