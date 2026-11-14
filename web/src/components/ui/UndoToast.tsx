import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { Presence } from "@/components/ui/Presence";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/UndoToast.module.css";

/*
 * A deferred action with an Undo window.
 *
 * `schedule` does not do the thing; it shows the toast and holds `commit`
 * back. Undo drops it (and runs `onUndo`, to put the rows back on screen);
 * otherwise `commit` runs when the timer ends. That is how an irreversible
 * server action (mark posted, revoke) gets an Undo at all.
 *
 * The timer pauses while the pointer is over the toast or focus is inside it
 * (WCAG 2.2.1), and never runs under 8 seconds. The live region is mounted
 * before any toast so the message is announced. A closing tab must not lose
 * the action, so `pagehide` and unmount commit at once. One toast at a time:
 * a second `schedule` commits the first.
 */

/** The shortest Undo window, in ms (admin design guide, section 2). */
export const UNDO_MIN_MS = 8000;

export interface UndoJob {
  message: string;
  /** Runs when the window closes without Undo, on pagehide, on unmount, or when another job replaces this one. */
  commit: () => void | Promise<void>;
  /** Runs when the user presses Undo. */
  onUndo?: () => void;
  /** Ms; raised to UNDO_MIN_MS if shorter. */
  duration?: number;
}

type Current = UndoJob & { key: number };

export interface Undoable {
  current: Current | null;
  schedule: (job: UndoJob) => void;
  undo: () => void;
  /** Commit the pending job now. */
  flush: () => void;
}

export function useUndoable(): Undoable {
  const [current, setCurrent] = useState<Current | null>(null);
  const job = useRef<UndoJob | null>(null);
  const seq = useRef(0);

  const flush = useCallback(() => {
    const j = job.current;
    if (!j) return;
    job.current = null;
    setCurrent(null);
    void j.commit();
  }, []);

  const schedule = useCallback(
    (next: UndoJob) => {
      flush();
      job.current = next;
      seq.current += 1;
      setCurrent({ ...next, key: seq.current });
    },
    [flush],
  );

  const undo = useCallback(() => {
    const j = job.current;
    if (!j) return;
    job.current = null;
    setCurrent(null);
    j.onUndo?.();
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { current, schedule, undo, flush };
}

export function UndoToast({ undoable }: { undoable: Undoable }) {
  const w = useMobileWords().undo;
  const { current, undo, flush } = undoable;

  const left = useRef(0);
  const since = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef({ pointer: false, focus: false });

  const stop = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    left.current -= Date.now() - since.current;
  };
  const go = () => {
    if (timer.current !== null || held.current.pointer || held.current.focus) return;
    since.current = Date.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, Math.max(0, left.current));
  };

  const key = current?.key;
  const duration = current?.duration;
  useEffect(() => {
    if (key === undefined) return;
    left.current = Math.max(duration ?? UNDO_MIN_MS, UNDO_MIN_MS);
    held.current = { pointer: false, focus: false };
    go();
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
    // go reads refs only; a new toast (key) restarts the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      <Presence
        show={Boolean(current)}
        className={styles.toast}
        data-testid="undo-toast"
        onPointerEnter={() => {
          held.current.pointer = true;
          stop();
        }}
        onPointerLeave={() => {
          held.current.pointer = false;
          go();
        }}
        onFocus={() => {
          held.current.focus = true;
          stop();
        }}
        onBlur={() => {
          held.current.focus = false;
          go();
        }}
      >
        <span className={styles.message}>{current?.message}</span>
        <button type="button" className={styles.undo} onClick={undo}>
          <Undo2 size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
          {w.action}
        </button>
      </Presence>
    </div>
  );
}
