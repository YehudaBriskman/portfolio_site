import { useMemo, useState, type ReactNode } from "react";
import { LocalBrowseContext } from "./localBrowse";

/* Holds the phone menu's local-section label and slot (`localBrowse.ts`). */
export default function LocalBrowseProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ label, setLabel, slot, setSlot }), [label, slot]);
  return <LocalBrowseContext.Provider value={value}>{children}</LocalBrowseContext.Provider>;
}
