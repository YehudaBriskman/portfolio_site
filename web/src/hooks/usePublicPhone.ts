import { useSyncExternalStore } from "react";
import { PUBLIC_PHONE_QUERY } from "@/lib/phoneBreakpoint";

/*
 * True under the public site's one phone breakpoint (640, `phoneBreakpoint.ts`).
 * A component whose phone markup differs from its desktop markup switches on
 * this rather than shipping both and hiding one in CSS, so a phone never
 * mounts the desktop card (and a screen reader never meets two). Without
 * matchMedia it is false: the desktop markup is the default.
 */
export function usePublicPhone(): boolean {
  const ok = () => typeof window !== "undefined" && typeof window.matchMedia === "function";
  return useSyncExternalStore(
    (cb) => {
      if (!ok()) return () => {};
      const mq = window.matchMedia(PUBLIC_PHONE_QUERY);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => ok() && window.matchMedia(PUBLIC_PHONE_QUERY).matches,
    () => false,
  );
}
