import { useSyncExternalStore } from "react";

/* The admin's phone breakpoint: the table gives way to rows below it. Where matchMedia is missing (jsdom) it is a wide screen. */
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
