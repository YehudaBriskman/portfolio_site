import { useId } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/IconButton";
import { ICON } from "@/components/ui/icons";
import { DEFAULT_PINNED, MAX_PINNED, type ActionInfo } from "@/components/ui/useTablePrefs";
import styles from "@/components/ui/CustomiseActions.module.css";

/*
 * "Customise actions" (principle 13): which row actions show as icons; the rest
 * stay in the 3-dots menu. A popover, not a menu, because it holds a set of
 * checkboxes. At most four can be pinned: once four are, the others are
 * disabled until one is cleared. Destructive actions are not offered: they live
 * in the 3-dots menu behind a confirm, always. Saved per table by the caller.
 */

export interface CustomiseActionsProps {
  label: string;
  hint: (max: number) => string;
  reset: string;
  actions: ActionInfo[];
  /** null: the table's default (the first two). */
  pinned: string[] | null;
  onChange: (ids: string[] | null) => void;
}

/** The ids drawn as icons for a table whose person has not chosen. */
export function defaultPinned(actions: ActionInfo[]): string[] {
  return actions.filter((a) => !a.danger).slice(0, DEFAULT_PINNED).map((a) => a.id);
}

export function CustomiseActions({ label, hint, reset, actions, pinned, onChange }: CustomiseActionsProps) {
  const hintId = useId();
  const safe = actions.filter((a) => !a.danger);
  if (safe.length === 0) return null;
  const on = pinned ?? defaultPinned(actions);
  const full = on.length >= MAX_PINNED;
  const toggle = (id: string, next: boolean) => onChange(next ? [...on, id].slice(0, MAX_PINNED) : on.filter((x) => x !== id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton icon={ICON.everyday} label={label} size="sm" />
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={label} className={styles.panel}>
        <p id={hintId} className={styles.hint}>
          {hint(MAX_PINNED)}
        </p>
        <ul className={styles.list} aria-describedby={hintId}>
          {safe.map((a) => {
            const checked = on.includes(a.id);
            return (
              <li key={a.id}>
                <label className={styles.item}>
                  <input type="checkbox" checked={checked} disabled={!checked && full} onChange={(e) => toggle(a.id, e.target.checked)} />
                  <a.icon className={styles.glyph} aria-hidden="true" />
                  <span className={styles.name}>{a.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {pinned !== null && (
          <button type="button" className={styles.reset} onClick={() => onChange(null)}>
            {reset}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
