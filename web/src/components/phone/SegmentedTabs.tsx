import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/*
 * Tabs that are a pill on a phone: a recessed track, 44px segments, the
 * current one raised, three or four of them (never more: past that the row
 * would need to scroll, and a chip scroller is the pattern for that).
 *
 * It is the one tablist implementation of the public site, on the APG tabs
 * pattern with automatic activation: a single tab stop (roving tabindex),
 * the arrows move and select, Home and End go to the ends, the panel is the
 * next stop. In Hebrew the row is mirrored, so the arrows are too: Left is
 * "next" there, as it is on the page. The selection is not kept here: the
 * page owns it (in the URL, `?tab=`) and this only reports the choice.
 *
 * `classes` is the page's own desktop look (the underline nav of
 * `work/Tabs.module.css`); the pill look is added on top by attribute
 * selectors inside the phone query, so above 640px nothing changes.
 */

export type TabSpec<K extends string> = { key: K; label: string; count?: number | null; icon?: ReactNode };

export type TabClasses = { bar?: string; list?: string; tab?: string; icon?: string; count?: string };

export default function SegmentedTabs<K extends string>({
  label,
  tabs,
  selected,
  onSelect,
  idBase,
  classes = {},
  formatCount = String,
  tabId,
  panelId,
}: {
  label: string;
  tabs: TabSpec<K>[];
  selected: K;
  onSelect: (key: K) => void;
  idBase: string;
  classes?: TabClasses;
  formatCount?: (n: number) => string;
  tabId: (base: string, key: string) => string;
  panelId: (base: string, key: string) => string;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  /* Which edges of a row that scrolls have more tabs past them (the page's
     fade cue). Read from the scroll position, which is logical in both
     directions (`scrollLeft` is negative in RTL), so compared by magnitude. */
  const [more, setMore] = useState({ start: false, end: false });

  /* The selected tab is kept in view if the row scrolls (a link to `?tab=docs`
     must not open on a tab the reader cannot see). Only the row scrolls. */
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
    <div className={`${styles.seg} ${classes.bar ?? ""}`} data-phone-segbar="">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className={classes.list}
        data-phone-segmented=""
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
              className={classes.tab}
              onClick={() => onSelect(tab.key)}
            >
              {tab.icon && (
                <span className={classes.icon} aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {tab.count != null && tab.count > 0 && <span className={classes.count}>{formatCount(tab.count)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
