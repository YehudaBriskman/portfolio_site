import { createContext, useEffect, useState, type ReactNode } from "react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";

/** True inside a `SheetPresence` that is leaving: a `BottomSheet` below reads it as closed. */
export const SheetClosing = createContext(false);

/*
 * For a sheet its parent draws as `{x && <Sheet open ...>}`: the parent drops it
 * at once, so it could never leave. Wrap it instead: `<SheetPresence show={x}>`.
 * `show` is the state and flips on the event. When it goes false on a phone the
 * last children stay mounted for the length of the exit with the sheet told it
 * is closed (it falls, then is `display: none`); a timer drops them and never
 * decides open or closed. Elsewhere (desktop, reduced motion) they go at once.
 */
export function SheetPresence({ show, children }: { show: boolean; children: ReactNode }) {
  const motion = usePhoneMotion();
  const [last, setLast] = useState<ReactNode>(children);
  if (show && last !== children) setLast(children);
  const [leaving, setLeaving] = useState(false);
  const [was, setWas] = useState(show);
  if (show !== was) {
    setWas(show);
    setLeaving(!show && motion);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  if (!show && !leaving) return null;
  return <SheetClosing.Provider value={!show}>{show ? children : last}</SheetClosing.Provider>;
}
