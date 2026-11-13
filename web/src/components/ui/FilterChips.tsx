import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Check, FilterX, SlidersHorizontal, X } from "lucide-react";
import styles from "@/components/ui/FilterChips.module.css";
import { describeValue, filterCount, tidy, type FilterDef, type Filters } from "@/components/ui/filters";
import { useLang } from "@/components/dashboard/i18n";
import { useFiltersWords } from "@/i18n/filters";
import { numberIn } from "@/i18n/words";

/*
 * The row above a list: the few filters people reach for as one-tap toggle
 * chips, a "Filters" button with the number of filters on, and Clear all.
 *
 * It is a toolbar: one tab stop, arrow keys (mirrored in a right-to-left
 * page), Home and End move between the buttons. Only the chips scroll,
 * sideways, behind a fade at both edges; the Filters button and Clear all
 * stay put so the count and the way out are never off screen. Every chip is
 * a toggle button with aria-pressed, a tick when on (never colour alone),
 * and a 44px target. A filter that is on but has no chip (set in the sheet)
 * shows as a removable chip, so nothing hides rows without saying so.
 */

export interface FilterChipsProps {
  defs: FilterDef[];
  value: Filters;
  onChange: (next: Filters) => void;
  /** Ids of the segmented or multi filters shown as chips, one chip per option. */
  common?: string[];
  /** The "Filters" button; leave out for a row with no sheet behind it. */
  onOpenSheet?: () => void;
  /** Rows now showing. Spoken (not drawn) while a filter is on. */
  resultCount?: number;
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export function FilterChips({ defs, value, onChange, common = [], onOpenSheet, resultCount }: FilterChipsProps) {
  const w = useFiltersWords();
  const lang = useLang();
  const count = filterCount(defs, value);
  const [current, setCurrent] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);
  // A chip that is on may start off screen: bring the first one into view once, on arrival.
  useEffect(() => {
    rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, []);

  const chipDefs = common.map((id) => defs.find((d) => d.id === id)).filter((d): d is FilterDef & { kind: "segmented" | "multi" } => d?.kind === "segmented" || d?.kind === "multi");
  const hidden = defs.filter((d) => d.kind !== "sort" && !common.includes(d.id) && describeValue(d, value[d.id]) !== "");

  const set = (def: FilterDef, v: Filters[string] | undefined) => {
    const next = { ...value };
    if (v === undefined) delete next[def.id];
    else next[def.id] = v;
    onChange(tidy(defs, next));
  };

  const toggle = (def: FilterDef & { kind: "segmented" | "multi" }, option: string) => {
    if (def.kind === "segmented") {
      set(def, value[def.id] === option ? undefined : option);
      return;
    }
    const list = Array.isArray(value[def.id]) ? (value[def.id] as string[]) : [];
    set(def, list.includes(option) ? list.filter((x) => x !== option) : [...list, option]);
  };

  const isOn = (def: FilterDef, option: string) => {
    const v = value[def.id];
    return Array.isArray(v) ? v.includes(option) : v === option;
  };

  const clearAll = () => {
    const keep: Filters = {};
    for (const d of defs) if (d.kind === "sort" && value[d.id] !== undefined) keep[d.id] = value[d.id];
    onChange(tidy(defs, keep));
  };

  /* One tab stop: the button that last had focus, else the first. */
  const keys = [
    ...(onOpenSheet ? ["filters"] : []),
    ...chipDefs.flatMap((d) => d.options.map((o) => `${d.id}:${o.value}`)),
    ...hidden.map((d) => `x:${d.id}`),
    ...(count > 0 ? ["clear"] : []),
  ];
  const stop = keys.includes(current) ? current : keys[0];
  const tab = (key: string) => (key === stop ? 0 : -1);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const rtl = e.currentTarget.closest("[dir]")?.getAttribute("dir") === "rtl";
    const delta = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const to = delta ? at + delta : e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : -1;
    if (to < 0 && !delta) return;
    e.preventDefault();
    const target = buttons[Math.min(buttons.length - 1, Math.max(0, to))];
    target?.focus();
  };

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const key = (e.target as HTMLElement).dataset.key;
    if (key) setCurrent(key);
    (e.target as HTMLElement).scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className={styles.bar} role="toolbar" aria-label={w.toolbar} onKeyDown={onKeyDown} onFocus={onFocus}>
      {onOpenSheet && (
        <button type="button" className={cx(styles.chip, styles.filters)} aria-label={count > 0 ? w.filtersActive(count) : w.filters} data-key="filters" tabIndex={tab("filters")} onClick={onOpenSheet}>
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
          <span className={styles.wide}>{w.filters}</span>
          {count > 0 && (
            <span className={styles.badge} data-badge="" aria-hidden="true">
              {numberIn(lang, count)}
            </span>
          )}
        </button>
      )}
      <div className={styles.row} ref={rowRef}>
        {chipDefs.map((def) => (
          <span key={def.id} role="group" aria-label={def.label} className={styles.group}>
            {def.options.map((o) => {
              const on = isOn(def, o.value);
              return (
                <button key={o.value} type="button" className={styles.chip} aria-pressed={on} data-key={`${def.id}:${o.value}`} tabIndex={tab(`${def.id}:${o.value}`)} onClick={() => toggle(def, o.value)}>
                  {on && <Check size={16} strokeWidth={2.5} aria-hidden="true" focusable="false" />}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </span>
        ))}
        {hidden.map((def) => {
          const text = `${def.label}: ${describeValue(def, value[def.id])}`;
          return (
            <button key={def.id} type="button" className={cx(styles.chip, styles.removable)} aria-label={w.remove(text)} data-key={`x:${def.id}`} tabIndex={tab(`x:${def.id}`)} onClick={() => set(def, undefined)}>
              <span className={styles.text}>{text}</span>
              <X size={16} strokeWidth={2.5} aria-hidden="true" focusable="false" />
            </button>
          );
        })}
      </div>
      {count > 0 && (
        <button type="button" className={cx(styles.chip, styles.clear)} data-key="clear" aria-label={w.clearAll} tabIndex={tab("clear")} onClick={clearAll}>
          <FilterX size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
          <span className={styles.wide}>{w.clearAll}</span>
        </button>
      )}
      <span role="status" className={styles.sr}>
        {resultCount !== undefined && count > 0 ? w.results(resultCount) : ""}
      </span>
    </div>
  );
}

/**
 * "Filters restored" with Undo: shown when a remembered set was put back on an
 * empty address, so a remembered filter can never silently hide rows.
 */
export function FiltersRestoredNote({ restored, onUndo, onDismiss }: { restored: boolean; onUndo: () => void; onDismiss: () => void }) {
  const w = useFiltersWords();
  return (
    <div role="status" className={styles.note}>
      {restored && (
        <>
          <span className={styles.noteText}>{w.restored}</span>
          <button type="button" className={styles.noteBtn} onClick={onUndo}>
            {w.undo}
          </button>
          <button type="button" className={styles.noteBtn} onClick={onDismiss}>
            {w.dismiss}
          </button>
        </>
      )}
    </div>
  );
}
