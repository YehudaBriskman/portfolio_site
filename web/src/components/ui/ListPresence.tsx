import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";
import styles from "@/components/ui/ListPresence.module.css";

/*
 * A list whose rows arrive and leave softly on a phone: Presence for many.
 *
 * The list is the caller's state and it is always correct at once. Each row is
 * drawn from `items`; a row that drops out is kept as a ghost, in the place it
 * had, marked `data-state="closed"`, `inert` and `aria-hidden`, and the
 * stylesheet collapses it (height and opacity) while the neighbours slide into
 * the gap. A timer then drops every ghost. The timer only removes a leftover:
 * it never decides open or closed, and nothing here listens for
 * `animationend` or `transitionend`, so a throttled, cancelled or skipped
 * animation cannot leave a row stuck (a closed row is `display: none` as
 * soon as the transition has had its time, whatever the animation did).
 *
 * An inserted row is `data-fresh` and the stylesheet grows it in with
 * `@starting-style`. The rows of the first draw, and the first rows that
 * arrive after an empty list (a load, not an insert), are not fresh: nothing
 * animates when a page opens. A row that was removed and comes back (Undo)
 * flips to open again and grows back through the same transition.
 *
 * Where the stylesheet will not animate (desktop, reduced motion) no ghost is
 * kept and no row is fresh: a removal is simply a removal.
 *
 * Reorder is not animated: a row that moves keeps its DOM node, so it lands in
 * its new place at once.
 */

type Key = string | number;
type Entry<T> = { key: Key; open: boolean; fresh: boolean; ghost?: T };
type Mirror<T> = { sig: string; entries: Entry<T>[]; items: T[] };

function reconcile<T>(prev: Mirror<T>, items: T[], keyOf: (item: T) => Key, motion: boolean, sig: string): Mirror<T> {
  const old = new Map(prev.entries.map((e) => [e.key, e]));
  const hadRows = prev.entries.some((e) => e.open);
  const next: Entry<T>[] = items.map((item) => {
    const key = keyOf(item);
    const was = old.get(key);
    return { key, open: true, fresh: was ? was.fresh : motion && hadRows };
  });
  if (motion) {
    const live = new Set(next.map((e) => e.key));
    const lastItem = new Map(prev.items.map((i) => [keyOf(i), i]));
    prev.entries.forEach((e, at) => {
      if (live.has(e.key)) return;
      const ghost: Entry<T> = { key: e.key, open: false, fresh: e.fresh, ghost: e.open ? lastItem.get(e.key) : e.ghost };
      if (ghost.ghost === undefined) return;
      // Sit where it was: after the nearest earlier row that is still drawn.
      let after = -1;
      for (let j = at - 1; j >= 0 && after < 0; j--) after = next.findIndex((n) => n.key === prev.entries[j].key);
      next.splice(after + 1, 0, ghost);
      live.add(e.key);
    });
  }
  return { sig, entries: next, items };
}

export interface ListPresenceProps<T> extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  items: T[];
  itemKey: (item: T) => Key;
  children: (item: T) => ReactNode;
  /** The list element; rows are `li` inside `ul`/`ol`, `div` otherwise. */
  as?: "ul" | "ol" | "div";
  /** "rows" collapses a row's height; "tiles" (a grid) fades and shrinks the tile in place. */
  variant?: "rows" | "tiles";
}

export function ListPresence<T>({ items, itemKey, children, as: Tag = "ul", variant = "rows", className, ...rest }: ListPresenceProps<T>) {
  const motion = usePhoneMotion();
  const sig = items.map((i) => String(itemKey(i))).join("\u0000");
  const [mirror, setMirror] = useState<Mirror<T>>(() => ({
    sig,
    items,
    entries: items.map((i) => ({ key: itemKey(i), open: true, fresh: false })),
  }));
  let m = mirror;
  if (mirror.sig !== sig) {
    m = reconcile(mirror, items, itemKey, motion, sig);
    setMirror(m);
  } else if (!motion && mirror.entries.some((e) => !e.open)) {
    // motion went away while rows were leaving (a rotation, a setting): drop them.
    m = { ...mirror, entries: mirror.entries.filter((e) => e.open) };
    setMirror(m);
  }

  const leaving = m.entries.filter((e) => !e.open).map((e) => e.key).join("\u0000");
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setMirror((cur) => ({ ...cur, entries: cur.entries.filter((e) => e.open) })), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  const live = new Map(items.map((i) => [itemKey(i), i]));
  const Row = Tag === "div" ? "div" : "li";
  return (
    <Tag {...rest} className={className}>
      {m.entries.map((e) => {
        const item = e.open ? live.get(e.key) : e.ghost;
        if (item === undefined) return null;
        return (
          <Row
            key={e.key}
            className={styles.row}
            data-list-row=""
            data-variant={variant}
            data-state={e.open ? "open" : "closed"}
            data-fresh={e.fresh ? "" : undefined}
            inert={!e.open}
            aria-hidden={e.open ? undefined : true}
          >
            <div className={styles.inner}>{children(item)}</div>
          </Row>
        );
      })}
    </Tag>
  );
}
