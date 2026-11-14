import { useSyncExternalStore } from "react";

/** A mouse or trackpad that can hover: the only place "press Enter" is a sentence worth reading. */
export const KEYBOARD_QUERY = "(hover: hover) and (pointer: fine)";

/** Wider than the public site's one phone breakpoint, 640px (plan D2). */
export const WIDE_QUERY = "(min-width: 40.0625rem)";

/** A media query as a boolean; false without matchMedia and before hydration. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

/*
 * True when keyboard-instruction copy ("Enter searches", "Left arrow opens")
 * belongs on screen. On a touch device there is no such key on the keyboard
 * the reader sees, and the sentence only squeezes the controls it sits
 * beside (#766). Without matchMedia (SSR, test shims) and before hydration it
 * is false: the safe default is to leave the instruction out.
 */
export function useKeyboardCopy(): boolean {
  return useMedia(KEYBOARD_QUERY);
}
