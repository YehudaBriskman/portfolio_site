import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import styles from "@/components/ui/CollapsibleRow.module.css";

/*
 * A collapsible group of panels (principle 3). The header is one button with
 * aria-expanded that controls the body; the body stays mounted and is `hidden`,
 * so a panel keeps what it loaded. `useCollapsibleRows` holds which rows are
 * open, remembers it per browser, and binds one key (E) that opens all rows,
 * or closes all when all are open.
 */

export interface CollapsibleRowProps {
  id: string;
  title: string;
  /** A figure beside the title (the number of panels, or things needing you). */
  count?: number | string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function CollapsibleRow({ id, title, count, open, onToggle, children }: CollapsibleRowProps) {
  const bodyId = `row-${id}`;
  return (
    <section className={styles.row} data-row={id} data-open={open ? "true" : "false"}>
      <h2 className={styles.heading}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <Icon icon={ICON.open} size={16} mirrorInRtl className={styles.chevron} aria-hidden="true" />
          <span className={styles.title}>{title}</span>
          {count != null && <span className={styles.count}>{count}</span>}
        </button>
      </h2>
      <div id={bodyId} className={styles.body} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

function read(key: string, defaults: Record<string, boolean>): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(`admin-rows:${key}`) ?? "null");
    if (raw && typeof raw === "object") {
      return Object.fromEntries(Object.entries(defaults).map(([id, d]) => [id, typeof raw[id] === "boolean" ? raw[id] : d]));
    }
  } catch {
    /* a broken value means the defaults */
  }
  return { ...defaults };
}

export function useCollapsibleRows(key: string, defaults: Record<string, boolean>) {
  const [open, setOpen] = useState(() => read(key, defaults));

  const commit = useCallback(
    (next: (cur: Record<string, boolean>) => Record<string, boolean>) => {
      setOpen((cur) => {
        const v = next(cur);
        try {
          localStorage.setItem(`admin-rows:${key}`, JSON.stringify(v));
        } catch {
          /* private mode: the choice lasts for the visit */
        }
        return v;
      });
    },
    [key],
  );

  const toggle = useCallback((id: string) => commit((cur) => ({ ...cur, [id]: !cur[id] })), [commit]);
  const toggleAll = useCallback(
    () => commit((cur) => {
      const to = !Object.values(cur).every(Boolean);
      return Object.fromEntries(Object.keys(cur).map((id) => [id, to]));
    }),
    [commit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return;
      toggleAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleAll]);

  return { open, toggle, toggleAll, allOpen: Object.values(open).every(Boolean) };
}
