import { useSyncExternalStore } from "react";
import { PHONE_QUERY } from "@/hooks/usePhone";

/** The gate every phone state-change transition sits behind (docs/motion-contract.md section 13). */
export const PHONE_MOTION_QUERY = `(prefers-reduced-motion: no-preference) and ${PHONE_QUERY}`;

/*
 * True when the stylesheet will animate a state change: a phone, motion allowed.
 *
 * The CSS decides what moves; this only decides whether a surface that has
 * just closed is kept in the page for the length of its exit. Where it is
 * false the surface goes at once, which is also what the CSS would show. The
 * open or closed STATE never reads this: it flips on the event.
 */
export function usePhoneMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(PHONE_MOTION_QUERY);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_MOTION_QUERY).matches,
    () => false,
  );
}

/** How long a closed surface is kept for its exit; longer than the slowest exit token. */
export const EXIT_KEEP_MS = 420;
