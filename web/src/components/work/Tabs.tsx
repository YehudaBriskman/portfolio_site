import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "@/components/work/Tabs.module.css";
import { count as fmt, useLang } from "@/components/dashboard/i18n";
import { panelId, tabId } from "@/components/work/order";

/*
 * A repository's tabs (#227), on the APG tabs pattern with automatic
 * activation: one tab stop for the whole list (roving tabindex), the arrows
 * move and select, Home and End go to the ends, and the panel is the next
 * stop. In Hebrew the row is mirrored, so the arrows are too: Left is
 * "next" there, as it is on the page.
 *
 * The selection is not kept here. The page owns it, in the URL, and this
 * only reports which tab was chosen.
 *
 * No motion: the underline moves by being drawn on a different tab, not by
 * sliding (`docs/motion-contract.md`).
 */

export type TabSpec<K extends string> = { key: K; label: string; count?: number | null; icon?: ReactNode };

export default function Tabs<K extends string>({
  label,
  tabs,
  selected,
  onSelect,
  idBase,
}: {
  label: string;
  tabs: TabSpec<K>[];
  selected: K;
  onSelect: (key: K) => void;
  idBase: string;
}) {
  const lang = useLang();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  /* Which edges of the row have more tabs past them: the cue that a tab is
     not simply missing. Read from the scroll position, which is logical in
     both directions (`scrollLeft` is negative in RTL), so it is compared by
     magnitude. */
  const [more, setMore] = useState({ start: false, end: false });

  /* On a phone the row scrolls sideways; the selected tab is kept in it, so
     a link to `?tab=docs` does not open on a tab the reader cannot see. Only
     the row scrolls: the page is left where it is. */
  useEffect(() => {
    const el = refs.current.get(selected);
    const row = el?.parentElement;
    if (!el || !row || row.scrollWidth <= row.clientWidth) return;
    const a = el.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    if (a.left < b.left || a.right > b.right) row.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2);
  }, [selected]);

  useEffect(() => {
    const row = listRef.current;
    if (!row) return;
    const read = () => {
      const max = row.scrollWidth - row.clientWidth;
      const at = Math.abs(row.scrollLeft);
      const next = { start: max > 1 && at > 1, end: max > 1 && at < max - 1 };
      setMore((m) => (m.start === next.start && m.end === next.end ? m : next));
    };
    read();
    row.addEventListener("scroll", read, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    ro?.observe(row);
    return () => {
      row.removeEventListener("scroll", read);
      ro?.disconnect();
    };
  }, [tabs.length]);

  const go = (i: number) => {
    const next = tabs[(i + tabs.length) % tabs.length];
    onSelect(next.key);
    refs.current.get(next.key)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((tab) => tab.key === selected);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) go(i + 1);
    else if (e.key === back) go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(tabs.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className={styles.bar}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className={styles.list}
        data-more-start={more.start || undefined}
        data-more-end={more.end || undefined}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => {
          const on = tab.key === selected;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) refs.current.set(tab.key, el);
                else refs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              id={tabId(idBase, tab.key)}
              aria-selected={on}
              aria-controls={panelId(idBase, tab.key)}
              tabIndex={on ? 0 : -1}
              className={styles.tab}
              onClick={() => onSelect(tab.key)}
            >
              {tab.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={styles.count}>{fmt(tab.count, lang)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
