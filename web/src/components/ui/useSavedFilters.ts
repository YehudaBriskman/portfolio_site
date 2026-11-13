import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { parseFilters, rangeKeys, tidy, writeFilters, type FilterDef, type Filters } from "@/components/ui/filters";

/*
 * A screen's filters, held in its address.
 *
 * The URL is the truth (shareable, Back-friendly): what it holds is what the
 * screen shows. localStorage is only a per-viewer convenience, and every
 * touch of it is guarded, because it throws in a private window or with site
 * data blocked and the screen must work without it. It remembers the last
 * set the viewer chose themselves; a link someone shared does not overwrite
 * it. On a visit with no filter in the address the remembered set is put
 * back and `restored` is true until the viewer changes something, dismisses
 * the note or undoes it, so a remembered filter never hides rows unannounced.
 */

const memoryKey = (screen: string) => `admin.filters.${screen}`;

function recall(screen: string): string {
  try {
    return window.localStorage.getItem(memoryKey(screen)) ?? "";
  } catch {
    return "";
  }
}

function remember(screen: string, defs: FilterDef[], value: Filters) {
  try {
    const text = writeFilters(defs, new URLSearchParams(), value).toString();
    if (text) window.localStorage.setItem(memoryKey(screen), text);
    else window.localStorage.removeItem(memoryKey(screen));
  } catch {
    /* storage is a convenience; the address still holds the filters */
  }
}

const hasAny = (defs: FilterDef[], params: URLSearchParams) =>
  defs.some((d) => (d.kind === "range" ? rangeKeys(d.id) : [d.id]).some((k) => params.has(k)));

export interface SavedFiltersState {
  /** A remembered set was just put back; show the note. */
  restored: boolean;
  /** Drop the restored set (the address and the memory). */
  undoRestore: () => void;
  /** Keep the filters, hide the note. */
  dismissRestored: () => void;
  /** Clear every filter, in the address and in the memory. */
  clear: () => void;
}

export function useSavedFilters(screen: string, defs: FilterDef[]): [Filters, (next: Filters) => void, SavedFiltersState] {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  /* A remembered set to put back, decided once, on arrival: an empty address and something saved. */
  const [restore, setRestore] = useState<Filters | null>(() => {
    if (hasAny(defs, params)) return null;
    const saved = parseFilters(defs, new URLSearchParams(recall(screen)));
    return Object.keys(saved).length > 0 ? saved : null;
  });
  const fromAddress = useMemo(() => parseFilters(defs, new URLSearchParams(search)), [defs, search]);
  // Until the address catches up (one effect later) the screen already shows the restored set.
  const filters = restore && !hasAny(defs, params) ? restore : fromAddress;

  useEffect(() => {
    if (restore) setParams((prev) => writeFilters(defs, prev, restore), { replace: true });
    // Only arrival restores; later changes are the viewer's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (next: Filters) => {
      const clean = tidy(defs, next);
      setParams((prev) => writeFilters(defs, prev, clean), { replace: true });
      remember(screen, defs, clean);
      setRestore(null);
    },
    [defs, screen, setParams],
  );

  const clear = useCallback(() => set({}), [set]);
  const dismissRestored = useCallback(() => setRestore(null), []);
  const restored = restore !== null;
  const state = useMemo(() => ({ restored, undoRestore: clear, dismissRestored, clear }), [restored, clear, dismissRestored]);

  return [filters, set, state];
}
