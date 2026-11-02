import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "@/components/dashboard/Dashboard.module.css";
import { visibleIds, type TreeNode } from "@/components/dashboard/tree";

/*
 * A file tree (#224): the areas and their notes, so the writing reads like a
 * repository you can browse. Shared by the dashboards (#225–#227).
 *
 * THE PATTERN: WAI-ARIA APG treeview, navigation variant
 * ------------------------------------------------------
 * `role="tree"` on the list; a branch is an `<li role="treeitem">` holding
 * its label and, when open, a `role="group"` of its children; a leaf is the
 * link itself carrying `role="treeitem"`, so Enter follows it natively and
 * Cmd/Ctrl/middle-click still open a new tab.
 *
 *   Down / Up     the next / previous visible item
 *   Right         a closed branch opens; an open one moves to its first child
 *   Left          an open branch closes; a child moves to its branch
 *   Home / End    the first / last visible item
 *   Enter, Space  a branch toggles; a leaf is a link and Enter follows it
 *   *             opens every branch at the same level
 *   a letter      the next visible item whose name starts with it
 *
 * Right and Left are physical keys, and in a right-to-left page the tree
 * opens toward the left, so the two swap there (as APG asks). The direction
 * is read from the tree's own computed `direction`, not from a prop, so the
 * tree is right wherever it is placed.
 *
 * Focus is a roving `tabindex`: one item is in the tab order, the arrows
 * move it, so the whole tree is one tab stop. Which branches are open is the
 * caller's state (on the Blogs dashboard it is the URL, `?open=`), so an
 * open tree is a link like any other view.
 *
 * Nothing in it moves. A branch opens by being drawn; there is no height
 * animation to wait through on the hundredth press (`docs/motion-contract.md`).
 */

export type { TreeNode } from "@/components/dashboard/tree";

type Props = {
  nodes: TreeNode[];
  /** The ids of the open branches. */
  expanded: string[];
  onExpandedChange: (next: string[]) => void;
  /** The tree's accessible name. */
  label: string;
  /** Spoken once on focus, so the keys are discoverable. */
  describedBy?: string;
};

export default function Tree({ nodes, expanded, onExpandedChange, label, describedBy }: Props) {
  const open = new Set(expanded);
  const visible = visibleIds(nodes, open);
  const [active, setActive] = useState<string | null>(null);
  const current = active !== null && visible.includes(active) ? active : (visible[0] ?? null);

  const items = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  /* A move to an item that only exists after this render (a first child,
     once its branch has opened) is finished here. */
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    items.current.get(id)?.focus();
  });

  const parentOf = new Map<string, string>();
  const byId = new Map<string, TreeNode>();
  const walk = (list: TreeNode[], parent: string | null) => {
    for (const n of list) {
      byId.set(n.id, n);
      if (parent) parentOf.set(n.id, parent);
      if (n.children) walk(n.children, n.id);
    }
  };
  walk(nodes, null);

  const focusId = (id: string) => {
    setActive(id);
    const el = items.current.get(id);
    if (el) el.focus();
    else pendingFocus.current = id;
  };

  const setOpen = (id: string, on: boolean) => {
    if (on === open.has(id)) return;
    onExpandedChange(on ? [...expanded, id] : expanded.filter((x) => x !== id));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, id: string) => {
    /* A branch holds its children, so their keys bubble through it. */
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const node = byId.get(id);
    if (!node) return;
    const branch = !!node.children?.length;
    const i = visible.indexOf(id);
    const rtl = treeRef.current ? getComputedStyle(treeRef.current).direction === "rtl" : false;
    let key = e.key;
    if (rtl && key === "ArrowRight") key = "ArrowLeft";
    else if (rtl && key === "ArrowLeft") key = "ArrowRight";

    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    switch (key) {
      case "ArrowDown":
        handled();
        if (i < visible.length - 1) focusId(visible[i + 1]);
        return;
      case "ArrowUp":
        handled();
        if (i > 0) focusId(visible[i - 1]);
        return;
      case "Home":
        handled();
        focusId(visible[0]);
        return;
      case "End":
        handled();
        focusId(visible[visible.length - 1]);
        return;
      case "ArrowRight":
        handled();
        if (!branch) return;
        if (!open.has(id)) setOpen(id, true);
        else focusId(node.children![0].id);
        return;
      case "ArrowLeft": {
        handled();
        if (branch && open.has(id)) {
          setOpen(id, false);
          return;
        }
        const parent = parentOf.get(id);
        if (parent) focusId(parent);
        return;
      }
      case "Enter":
      case " ":
        if (branch) {
          handled();
          setOpen(id, !open.has(id));
        } else if (key === " ") {
          /* Space on a link scrolls the page; on a tree item it should do
             what Enter does. */
          handled();
          items.current.get(id)?.click();
        }
        return;
      case "*": {
        handled();
        const parent = parentOf.get(id);
        const siblings = parent ? (byId.get(parent)?.children ?? []) : nodes;
        const add = siblings.filter((s) => s.children?.length && !open.has(s.id)).map((s) => s.id);
        if (add.length) onExpandedChange([...expanded, ...add]);
        return;
      }
      default:
        if (key.length === 1 && /\S/.test(key)) {
          const ch = key.toLocaleLowerCase();
          const order = [...visible.slice(i + 1), ...visible.slice(0, i + 1)];
          const hit = order.find((v) => byId.get(v)?.text.toLocaleLowerCase().startsWith(ch));
          if (hit) {
            handled();
            focusId(hit);
          }
        }
    }
  };

  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) items.current.set(id, el);
    else items.current.delete(id);
  };

  const render = (list: TreeNode[], level: number): ReactNode =>
    list.map((n, idx) => {
      const branch = !!n.children?.length;
      const common = {
        "aria-level": level,
        "aria-setsize": list.length,
        "aria-posinset": idx + 1,
        tabIndex: n.id === current ? 0 : -1,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, n.id),
        onFocus: (e: FocusEvent<HTMLElement>) => {
          if (e.target === e.currentTarget) setActive(n.id);
        },
        "aria-describedby": describedBy,
      };
      if (branch) {
        const isOpen = open.has(n.id);
        return (
          <li
            key={n.id}
            role="treeitem"
            aria-expanded={isOpen}
            ref={register(n.id)}
            className={styles.treeBranch}
            {...common}
          >
            {/* The row is the press target; the `li` is what is focused, so
                its group is inside it as APG's structure requires. */}
            <span
              className={styles.treeRow}
              data-level={level}
              onClick={() => {
                setActive(n.id);
                setOpen(n.id, !isOpen);
              }}
            >
              <span className={styles.treeTwisty} data-open={isOpen ? "" : undefined} aria-hidden="true" />
              {n.icon}
              <span className={styles.treeLabel}>{n.label}</span>
              {n.meta !== undefined && <span className={styles.treeMeta}>{n.meta}</span>}
            </span>
            {isOpen && (
              <ul role="group" className={styles.treeGroup}>
                {render(n.children!, level + 1)}
              </ul>
            )}
          </li>
        );
      }
      return (
        <li key={n.id} role="none">
          <Link
            to={n.href ?? "#"}
            role="treeitem"
            ref={register(n.id)}
            className={`${styles.treeRow} ${styles.treeLeaf}`}
            data-level={level}
            {...common}
          >
            {n.icon}
            <span className={styles.treeLabel}>{n.label}</span>
            {n.meta !== undefined && <span className={styles.treeMeta}>{n.meta}</span>}
          </Link>
        </li>
      );
    });

  return (
    <ul ref={treeRef} role="tree" aria-label={label} className={styles.tree}>
      {render(nodes, 1)}
    </ul>
  );
}
