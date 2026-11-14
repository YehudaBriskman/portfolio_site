import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { ICON } from "@/components/ui/icons";
import { useContentWords } from "./words";
import styles from "./EditorPhone.module.css";

/*
 * Reorder mode for a list on a phone.
 *
 * A list shows its records plainly; the controls that change the order or
 * remove one live behind one "Reorder" button, so a row is not four buttons
 * wide. In the mode every row is a name, Move up, Move down and Remove: real
 * buttons, so it works from a keyboard, a switch and a thumb with no drag
 * (WCAG 2.5.7). After a move, focus follows the row so the next press moves
 * it again, and the move is announced ("A moved to position 2 of 6").
 * Remove can be undone until something else changes.
 */

type Props<T> = {
  items: readonly T[];
  name: (item: T, i: number) => string;
  onChange: (next: T[]) => void;
};

export function ReorderRows<T>({ items, name, onChange }: Props<T>) {
  const w = useContentWords().reorder;
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState<T[] | null>(null);
  const focus = useRef<{ i: number; dir: "up" | "down" } | null>(null);
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    const row = root.current?.querySelector(`[data-i="${f.i}"]`);
    const pick = row?.querySelector<HTMLButtonElement>(`[data-move="${f.dir}"]`);
    const other = row?.querySelector<HTMLButtonElement>(`[data-move="${f.dir === "up" ? "down" : "up"}"]`);
    (pick && !pick.disabled ? pick : other)?.focus();
  });

  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    focus.current = { i: to, dir: to < from ? "up" : "down" };
    setUndo(null);
    setNote(w.moved(name(moved, from), to + 1, items.length));
    onChange(next);
  };

  const remove = (i: number) => {
    setUndo([...items]);
    setNote(w.removed(name(items[i], i)));
    onChange(items.filter((_, j) => j !== i));
  };

  return (
    <>
      <ul ref={root} className={styles.list}>
        {items.map((item, i) => {
          const label = name(item, i);
          return (
            <li key={i} data-i={i} className={styles.reorderRow}>
              <ICON.reorder className={styles.grip} size={20} aria-hidden="true" focusable="false" />
              <span className={styles.reorderName}>
                <bdi>{label}</bdi>
              </span>
              <span className={styles.reorderBtns}>
                <button type="button" data-move="up" className={`a-btn a-btn-ghost ${styles.iconBtn}`} aria-label={w.up(label)} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ChevronUp aria-hidden="true" focusable="false" />
                </button>
                <button type="button" data-move="down" className={`a-btn a-btn-ghost ${styles.iconBtn}`} aria-label={w.down(label)} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  <ChevronDown aria-hidden="true" focusable="false" />
                </button>
                <button type="button" className={`a-btn a-btn-ghost ${styles.iconBtn} ${styles.danger}`} aria-label={w.remove(label)} onClick={() => remove(i)}>
                  <Trash2 aria-hidden="true" focusable="false" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p role="status" className={styles.count}>
        {note}
        {undo && (
          <>
            {" "}
            <button
              type="button"
              className="a-btn a-btn-ghost min-h-11"
              onClick={() => {
                onChange(undo);
                setUndo(null);
                setNote("");
              }}
            >
              {w.undo}
            </button>
          </>
        )}
      </p>
    </>
  );
}

/** The one visible switch into and out of the mode. */
export function ReorderToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const w = useContentWords().reorder;
  return (
    <button type="button" className="a-btn a-btn-ghost min-h-11" aria-pressed={on} onClick={onToggle}>
      {on ? w.done : w.start}
    </button>
  );
}
