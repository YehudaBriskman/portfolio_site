import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { useTableWords } from "@/i18n/tables";
import { useToastWords } from "@/i18n/toast";
import styles from "@/components/ui/EditableCell.module.css";

/*
 * Click-to-edit for a cell that holds ONE short value: a choice (select), a
 * number or a few words (principle 11). Anything richer, or more than one
 * field, opens the side panel instead: inputs inside a complex table are a
 * trap (Atlassian).
 *
 *  - The cell is a button that reads as text. Click or Enter opens the field.
 *  - Enter saves, Escape cancels (and is not passed on, so it never also
 *    closes a panel), leaving the field saves, a select saves on choice.
 *  - An invalid number (empty, out of range) keeps the field open with
 *    aria-invalid; nothing is sent.
 *  - A save raises a toast with Undo; Undo calls `onSave` with the old value.
 *  - A rejected save puts the old value back and says nothing is changed.
 *
 * `label` names the field ("Views") and becomes "Edit Views"; the words are
 * the kit's (`i18n/tables`), the values and options are the caller's.
 */

export type EditableValue = string | number;

export interface EditableOption {
  value: string;
  label: string;
}

export interface EditableCellProps {
  value: EditableValue;
  kind?: "text" | "number" | "select";
  /** Names the field: "Title". */
  label: string;
  /** What the cell shows at rest; default the value. */
  display?: ReactNode;
  options?: EditableOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** Numbers read right, tabular (same as a `num` column). */
  align?: "start" | "num";
  disabled?: boolean;
  onSave: (next: EditableValue) => void | Promise<void>;
  /** Text of the toast; default "Saved". */
  savedText?: string;
}

export function EditableCell({ value, kind = "text", label, display, options = [], min, max, maxLength, align = "start", disabled, onSave, savedText }: EditableCellProps) {
  const w = useTableWords();
  const tw = useToastWords();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [bad, setBad] = useState(false);
  const field = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (editing) {
      field.current?.focus();
      if (kind !== "select") field.current?.select();
    }
  }, [editing, kind]);

  const open = () => {
    if (disabled) return;
    done.current = false;
    setDraft(String(value));
    setBad(false);
    setEditing(true);
  };

  const close = (refocus: boolean) => {
    setEditing(false);
    if (refocus) requestAnimationFrame(() => btn.current?.focus());
  };

  const parse = (raw: string): EditableValue | null => {
    if (kind !== "number") return raw.trim();
    if (raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) return null;
    return n;
  };

  const commit = async (raw: string, refocus: boolean) => {
    if (done.current) return;
    const next = parse(raw);
    if (next === null || (kind === "text" && next === "")) {
      /* An invalid number stays open; an emptied text field is a cancel, not a blank title. */
      if (kind === "number") return void setBad(true);
      done.current = true;
      return close(refocus);
    }
    done.current = true;
    close(refocus);
    if (next === value) return;
    const before = value;
    try {
      await onSave(next);
    } catch {
      return;
    }
    toast.success(savedText ?? w.saved, { action: { label: tw.undo, onClick: () => void onSave(before) } });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      void commit((e.target as HTMLInputElement).value, true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      done.current = true;
      close(true);
    } else {
      /* The grid around us moves on arrows; inside a field they move the caret. */
      e.stopPropagation();
    }
  };

  if (!editing) {
    return (
      <button ref={btn} type="button" className={styles.read} data-align={align} aria-label={`${w.edit(label)}: ${String(display && typeof display !== "object" ? display : value)}`} disabled={disabled} onClick={open}>
        <span className={styles.text}>{display ?? (kind === "select" ? options.find((o) => o.value === value)?.label ?? value : value)}</span>
      </button>
    );
  }

  const common = {
    ref: field,
    className: styles.field,
    "data-align": align,
    "aria-label": w.edit(label),
    "aria-invalid": bad || undefined,
    onKeyDown: onKey,
  };

  return kind === "select" ? (
    <select
      {...common}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        void commit(e.target.value, true);
      }}
      onBlur={() => !done.current && close(false)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ) : (
    <input
      {...common}
      type={kind === "number" ? "number" : "text"}
      inputMode={kind === "number" ? "decimal" : undefined}
      min={min}
      max={max}
      maxLength={maxLength}
      dir="auto"
      value={draft}
      onChange={(e) => (setDraft(e.target.value), setBad(false))}
      onBlur={(e) => void commit(e.target.value, false)}
    />
  );
}
