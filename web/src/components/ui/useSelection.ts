import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/*
 * Select mode for a list: whether it is on, and which rows are chosen.
 *
 * Two ways in (the visible Select button, long-press on a row) call the same
 * `enter`. Three ways out: Done, Escape, and the Back button. Entering pushes
 * one history entry, like BottomSheet does, so Back leaves the mode instead
 * of the page; when a sheet is on top, Back pops the sheet's entry and ours is
 * still current, so it is left alone.
 *
 * `ids` is what the list shows right now. A selection never holds a row that
 * is not listed: change the filter and the hidden rows are dropped (and not
 * remembered for when they return), so a bulk action cannot touch something
 * the user can no longer see. The mode itself stays on.
 */
export type SelectionId = string | number;

export interface Selection<T extends SelectionId> {
  on: boolean;
  /** Turn the mode on, optionally with one row already chosen (long-press). */
  enter: (id?: T) => void;
  /** Leave the mode and forget the choice. */
  exit: () => void;
  toggle: (id: T) => void;
  has: (id: T) => boolean;
  /** Every listed row. */
  all: () => void;
  none: () => void;
  count: number;
  /** The chosen rows, in list order. */
  ids: T[];
  allSelected: boolean;
}

export function useSelection<T extends SelectionId>(ids: readonly T[]): Selection<T> {
  const key = useId();
  const [on, setOn] = useState(false);
  const [raw, setRaw] = useState<ReadonlySet<T>>(() => new Set());

  const listKey = ids.map((i) => `${typeof i}:${i}`).join("\u0000");
  // Rebuilt only when the listed rows change, not when the caller re-sends the same ones in a new array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const listed = useMemo(() => new Set(ids), [listKey]);

  // Drop what is no longer listed while rendering (React's "adjust state on a prop change"), not in an effect.
  const [seen, setSeen] = useState(listed);
  if (seen !== listed) {
    setSeen(listed);
    const kept = new Set<T>();
    raw.forEach((v) => listed.has(v) && kept.add(v));
    if (kept.size !== raw.size) setRaw(kept);
  }

  const chosen = useMemo(() => ids.filter((i) => raw.has(i)), [ids, raw]);

  const exit = useCallback(() => {
    setOn(false);
    setRaw(new Set());
  }, []);
  const enter = useCallback((id?: T) => {
    setOn(true);
    setRaw(id === undefined ? new Set() : new Set([id]));
  }, []);
  const toggle = useCallback((id: T) => {
    setRaw((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const has = useCallback((id: T) => raw.has(id), [raw]);
  const all = useCallback(() => setRaw(new Set(listed)), [listed]);
  const none = useCallback(() => setRaw(new Set()), []);

  /* Escape and Back, only while the mode is on. */
  const pushed = useRef(false);
  useEffect(() => {
    if (!on) return;
    window.history.pushState({ selection: key }, "");
    pushed.current = true;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // An open sheet owns Escape: it closes first, the mode stays.
      if (document.querySelector("dialog[open]")) return;
      exit();
    };
    const onPop = () => {
      if ((window.history.state as { selection?: string } | null)?.selection === key) return;
      pushed.current = false;
      exit();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (pushed.current) {
        pushed.current = false;
        if ((window.history.state as { selection?: string } | null)?.selection === key) window.history.back();
      }
    };
  }, [on, key, exit]);

  return {
    on, enter, exit, toggle, has, all, none,
    count: chosen.length,
    ids: chosen,
    allSelected: ids.length > 0 && chosen.length === ids.length,
  };
}
