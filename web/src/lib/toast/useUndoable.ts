import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/lib/toast";

export interface UndoJob {
  /** The toast's title ("Archived 3 posts"). */
  message: string;
  /** Runs when the window closes without Undo, on pagehide, on leaving the screen, or when another job replaces this one. */
  commit: () => void | Promise<void>;
  /** Runs when the user presses Undo (put the rows back on screen). */
  onUndo?: () => void;
  /** Ms; raised to the 8 s minimum if shorter. */
  duration?: number;
  /** One pending job per id: scheduling the same id commits the earlier one. */
  id?: string;
}

/*
 * A deferred action with an Undo window, for a screen: `schedule` shows the
 * toast and holds `commit` back (see `toast.undoable` for the rules). The one
 * thing a screen adds is leaving: when it unmounts, its pending jobs commit at
 * once rather than waiting out a window nobody can see the screen for.
 * Undo-then-leave commits nothing (the job is already settled).
 */
export function useUndoable(): { schedule: (job: UndoJob) => void } {
  const mine = useRef(new Set<string>());

  const schedule = useCallback((job: UndoJob) => {
    const id = toast.undoable({ title: job.message, commit: job.commit, onUndo: job.onUndo, duration: job.duration, id: job.id });
    if (id) mine.current.add(id);
  }, []);

  useEffect(() => {
    const ids = mine.current;
    return () => {
      for (const id of ids) toast.dismiss(id);
      ids.clear();
    };
  }, []);

  return { schedule };
}
