import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "@/components/ui/PanelGrid.module.css";

/*
 * A 12-column grid of panels (principle 1). It sizes nothing itself: each Panel
 * names its width as a col-span token (3, 4, 6, 8 or 12). On a phone every panel
 * is one column. Which panel is expanded is held by the nearest `PanelScope`
 * (a grid makes its own when there is none), so a page of several grids, one
 * per collapsible row, still has only one panel expanded.
 */

export type PanelSpan = 3 | 4 | 6 | 8 | 12;

type Ctx = { expanded: string | null; setExpanded: (id: string | null) => void };
export const PanelGridContext = createContext<Ctx | null>(null);
export const usePanelGrid = () => useContext(PanelGridContext);

export function PanelScope({ children }: { children: ReactNode }) {
  const [expanded, set] = useState<string | null>(null);
  const setExpanded = useCallback((id: string | null) => set(id), []);
  const value = useMemo(() => ({ expanded, setExpanded }), [expanded, setExpanded]);
  return <PanelGridContext.Provider value={value}>{children}</PanelGridContext.Provider>;
}

export function PanelGrid({ children, className }: { children: ReactNode; className?: string }) {
  const grid = (
    <div className={[styles.grid, className].filter(Boolean).join(" ")} data-panel-grid="">
      {children}
    </div>
  );
  return usePanelGrid() ? grid : <PanelScope>{grid}</PanelScope>;
}
