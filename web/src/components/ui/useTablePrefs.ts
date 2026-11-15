import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ControlIcon } from "@/components/ui/IconButton";

/*
 * What a person chose for one table, remembered in this browser: the row tier,
 * the columns they hid and the row actions they pinned. One record per table
 * under `a-table:<id>`. The id is the route plus the table's label unless the
 * caller names it (`tableId`), so a screen gets this with no edit.
 *
 * Reads and writes never throw (private windows, blocked storage): the table
 * then simply forgets between visits. A bad record is ignored, not trusted.
 */

export type Tier = "compact" | "cozy" | "comfy";
export const TIERS: Tier[] = ["compact", "cozy", "comfy"];
/** Row heights in px: the header row matches (Carbon, Primer). */
export const TIER_PX: Record<Tier, number> = { compact: 28, cozy: 36, comfy: 44 };
/** The most row actions a person can pin (the rest live in the 3-dots menu). */
export const MAX_PINNED = 4;
/** What a table pins until the person chooses. */
export const DEFAULT_PINNED = 2;

export interface TablePrefs {
  /** null: the pointer decides (cozy on a fine pointer, comfy on touch). */
  density: Tier | null;
  /** null: the table's own default (the first two safe actions). */
  pinned: string[] | null;
  hidden: string[];
}

const EMPTY: TablePrefs = { density: null, pinned: null, hidden: [] };
const KEY = (id: string) => `a-table:${id}`;

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function readPrefs(id: string): TablePrefs {
  try {
    const raw = window.localStorage.getItem(KEY(id));
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<TablePrefs>;
    return {
      density: TIERS.includes(v.density as Tier) ? (v.density as Tier) : null,
      pinned: isStrings(v.pinned) ? v.pinned.slice(0, MAX_PINNED) : null,
      hidden: isStrings(v.hidden) ? v.hidden : [],
    };
  } catch {
    return EMPTY;
  }
}

function writePrefs(id: string, p: TablePrefs) {
  try {
    if (p.density === null && p.pinned === null && p.hidden.length === 0) window.localStorage.removeItem(KEY(id));
    else window.localStorage.setItem(KEY(id), JSON.stringify(p));
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/** "/admin/posts" + "Posts" -> "admin/posts:posts". The language prefix is dropped so en and he share a choice. */
export function deriveTableId(label: string, path = typeof window === "undefined" ? "" : window.location.pathname): string {
  const clean = path.replace(/^\/he(?=\/|$)/, "").replace(/^\/+|\/+$/g, "") || "root";
  return `${clean}:${label.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

export interface TablePrefsApi extends TablePrefs {
  id: string;
  setDensity: (t: Tier | null) => void;
  setPinned: (ids: string[] | null) => void;
  setHidden: (ids: string[]) => void;
  reset: () => void;
}

export function useTablePrefs(label: string, tableId?: string): TablePrefsApi {
  const id = useMemo(() => tableId ?? deriveTableId(label), [tableId, label]);
  const [state, setState] = useState<{ id: string; p: TablePrefs }>(() => ({ id, p: readPrefs(id) }));
  /* A table whose id changes (a tab that renames it) reads its own record. */
  const prefs = state.id === id ? state.p : readPrefs(id);

  const patch = useCallback(
    (next: Partial<TablePrefs>) => {
      const merged = { ...readPrefs(id), ...next };
      writePrefs(id, merged);
      setState({ id, p: merged });
    },
    [id],
  );

  return {
    ...prefs,
    id,
    setDensity: (density) => patch({ density }),
    setPinned: (pinned) => patch({ pinned: pinned ? pinned.slice(0, MAX_PINNED) : null }),
    setHidden: (hidden) => patch({ hidden }),
    reset: () => patch(EMPTY),
  };
}

/* ------------------------------------------------ what RowActions reads */

export interface ActionInfo {
  id: string;
  label: string;
  icon: ControlIcon;
  danger: boolean;
}

export interface TableActionsContextValue {
  pinned: string[] | null;
  /** RowActions tell the table which actions exist, so "Customise actions" can list them. */
  register: (actions: ActionInfo[]) => void;
  /** Select mode / batch: row actions are off. */
  disabled: boolean;
}

export const TableActionsContext = createContext<TableActionsContextValue | null>(null);
export const useTableActions = () => useContext(TableActionsContext);
