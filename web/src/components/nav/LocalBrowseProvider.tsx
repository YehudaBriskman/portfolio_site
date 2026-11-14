import { useCallback, useMemo, useState, type ReactNode } from "react";
import { LocalBrowseContext } from "./localBrowse";

/* Holds the phone menu's Browse row: label, filter count and the press (`localBrowse.ts`). */
export default function LocalBrowseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ label: string | null; count: number }>({ label: null, count: 0 });
  const [tick, setTick] = useState(0);
  const setBrowse = useCallback((label: string | null, count: number) => setState({ label, count }), []);
  const requestOpen = useCallback(() => setTick((n) => n + 1), []);
  const value = useMemo(() => ({ ...state, tick, setBrowse, requestOpen }), [state, tick, setBrowse, requestOpen]);
  return <LocalBrowseContext.Provider value={value}>{children}</LocalBrowseContext.Provider>;
}
