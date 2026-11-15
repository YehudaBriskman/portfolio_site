import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ControlIcon } from "@/components/ui/IconButton";
import styles from "@/components/ui/Tabs.module.css";

/*
 * Tabs (A22): peers of one object, never a second copy of the sidebar. One
 * tab stop (roving tabindex), arrows move and select, Home and End jump, and
 * the arrows mirror in a right-to-left page. The current tab is a soft fill
 * plus a bar, one weight in every state (A3). A strip that is wider than its
 * row scrolls under an edge fade; a label is never cut mid-word (it ends in an
 * ellipsis at its own max width and carries its full text on `title`).
 *
 * `label` names the tablist and is the caller's word. Set `panels` and render a
 * `TabPanel` with the same `idBase` when the tabs switch content in place; leave
 * it off when the tabs are routes, so no `aria-controls` points at nothing.
 */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  glyph?: ControlIcon;
}

export interface TabsProps {
  value: string;
  onValueChange: (id: string) => void;
  items: TabItem[];
  /** Accessible name of the tablist. */
  label: string;
  /** Ids shared with `TabPanel`; defaults to a generated one. */
  idBase?: string;
  panels?: boolean;
  className?: string;
}

const tabId = (base: string, id: string) => `${base}-tab-${id}`;
const panelId = (base: string, id: string) => `${base}-panel-${id}`;

export function Tabs({ value, onValueChange, items, label, idBase, panels = false, className = "" }: TabsProps) {
  const auto = useId();
  const base = idBase ?? auto;
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const at = Math.abs(el.scrollLeft);
    const next = { start: at > 1, end: max - at > 1 };
    setEdge((p) => (p.start === next.start && p.end === next.end ? p : next));
  };
  useEffect(measure);

  /* The current tab stays in view when the strip scrolls (a long hub on a phone). */
  useEffect(() => {
    const cur = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    cur?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);

  const current = items.some((i) => i.id === value) ? value : items[0]?.id;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const root = ref.current;
    if (!root) return;
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const rtl = (root.closest("[dir]")?.getAttribute("dir") ?? getComputedStyle(root).direction) === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + step + tabs.length) % tabs.length;
    e.preventDefault();
    tabs[next]?.focus();
    const id = tabs[next]?.dataset.tabId;
    if (id) onValueChange(id);
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={`${styles.tabs} ${className}`.trim()}
      data-edge-start={edge.start || undefined}
      data-edge-end={edge.end || undefined}
      onKeyDown={onKeyDown}
      onScroll={measure}
    >
      {items.map((it) => {
        const selected = it.id === current;
        const Glyph = it.glyph;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            id={tabId(base, it.id)}
            data-tab-id={it.id}
            aria-selected={selected}
            aria-controls={panels && selected ? panelId(base, it.id) : undefined}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            title={it.label}
            onClick={() => onValueChange(it.id)}
          >
            {Glyph && <Glyph className={styles.glyph} aria-hidden="true" />}
            <span className={styles.text}>{it.label}</span>
            {it.count != null && (
              <>
                {" "}
                <span className={styles.count}>{it.count}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idBase: string;
  id: string;
  /** The current tab id; the panel renders only while it is current. */
  value: string;
  children?: ReactNode;
  className?: string;
}

export function TabPanel({ idBase, id, value, children, className }: TabPanelProps) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" id={panelId(idBase, id)} aria-labelledby={tabId(idBase, id)} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
