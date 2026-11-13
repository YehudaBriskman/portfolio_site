import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import Ring from "@/components/motion/Ring";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/SidebarGroup.module.css";

/*
 * Hierarchical navigation for the admin drawer and sidebar (#675).
 *
 * The pattern is APG "disclosure navigation", not a tree widget: every row is
 * an ordinary link or button in a nested list, so Tab, screen readers and
 * find-in-page behave as on any page. A group with an address is a link plus
 * its own 44px chevron (the label navigates, the chevron expands); a group
 * with none is one toggle. The arrow keys are an enhancement over that: Up and
 * Down walk the visible rows, Home and End jump, and the inline-end and
 * inline-start arrows open and close (swapped in RTL).
 *
 * Depth is two groups deep (Marketing > Settings > Sender & delivery): the
 * reference patterns cap a sidebar at two levels of grouping.
 */

export type NavNode = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Pathname plus an optional query string. A node with children and no `to` is only a toggle. */
  to?: string;
  badge?: number;
  /** What a screen reader hears for the badge ("3 unread"). */
  badgeLabel?: string;
  children?: NavNode[];
};

const BASE = "http://nav.invalid";
const parse = (to: string) => new URL(to, BASE);

/**
 * The node whose address the URL satisfies most closely: same pathname, every
 * query parameter of the node present in the URL, most parameters wins, and a
 * leaf beats a group at a tie. `undefined` when no address matches (an editor
 * route, which the shell resolves by its section).
 */
export function currentNodeId(nodes: NavNode[], pathname: string, search: string): string | undefined {
  const have = new URLSearchParams(search);
  let best: { id: string; score: number } | undefined;
  const walk = (list: NavNode[]) => {
    for (const n of list) {
      if (n.to) {
        const u = parse(n.to);
        const want = [...u.searchParams];
        if (u.pathname === pathname && want.every(([k, v]) => have.get(k) === v)) {
          const score = want.length * 2 + (n.children?.length ? 0 : 1);
          if (!best || score > best.score) best = { id: n.id, score };
        }
      }
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return best?.id;
}

/** The ids of the groups that contain `id`, outermost first. */
export function ancestorsOf(nodes: NavNode[], id: string | undefined): string[] {
  if (!id) return [];
  const path: string[] = [];
  const find = (list: NavNode[]): boolean => {
    for (const n of list) {
      if (n.id === id) return true;
      if (n.children) {
        path.push(n.id);
        if (find(n.children)) return true;
        path.pop();
      }
    }
    return false;
  };
  return find(nodes) ? path : [];
}

/** Every leaf pathname in a tree, for the test that each one is a route. */
export function leafPaths(nodes: NavNode[]): string[] {
  return nodes.flatMap((n) => [...(n.to && !n.children ? [parse(n.to).pathname] : []), ...(n.children ? leafPaths(n.children) : [])]);
}

type OpenMap = Record<string, boolean>;

function readOpen(key: string): OpenMap {
  try {
    const raw = localStorage.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as OpenMap) : {};
  } catch {
    return {};
  }
}

function writeOpen(key: string, map: OpenMap) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* private window or blocked storage: the nav still works, it just forgets */
  }
}

const Badge = ({ n, label }: { n?: number; label?: string }) =>
  n ? (
    <span className="a-counter" title={label}>
      <span aria-hidden="true">{new Intl.NumberFormat("en-GB").format(n)}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  ) : null;

type GroupProps = {
  node: NavNode;
  currentId?: string;
  ancestors: readonly string[];
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  /** Called after a link is followed (the drawer closes itself). */
  onNavigate?: () => void;
  idBase: string;
  depth?: number;
};

/** The row's mark: the living line's ring on the current item, as the old flat nav had. */
function Mark({ node, current }: { node: NavNode; current: boolean }) {
  const Icon = node.icon;
  if (!Icon) return <span className={styles.mark} aria-hidden="true" />;
  return (
    <span className={styles.mark} aria-hidden="true">
      {current ? (
        <Ring size={26} draw={false}>
          <Icon />
        </Ring>
      ) : (
        <Icon />
      )}
    </span>
  );
}

function Row({ node, current, onNavigate }: { node: NavNode; current: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to={node.to!}
      aria-current={current ? "page" : undefined}
      className={styles.link}
      data-nav-item=""
      data-nav-id={node.id}
      onClick={onNavigate}
    >
      <Mark node={node} current={current} />
      <span className={styles.text}>{node.label}</span>
      <Badge n={node.badge} label={node.badgeLabel} />
    </Link>
  );
}

export function SidebarGroup({ node, currentId, ancestors, isOpen, onToggle, onNavigate, idBase, depth = 0 }: GroupProps): ReactNode {
  const w = useMobileWords().nav;
  const current = node.id === currentId;
  const kids = node.children;

  if (!kids?.length) {
    return (
      <li className={styles.item} data-depth={depth}>
        <Row node={node} current={current} onNavigate={onNavigate} />
      </li>
    );
  }

  const open = isOpen(node.id);
  const listId = `${idBase}-${node.id}`;
  const ancestor = ancestors.includes(node.id);
  const toggle = () => onToggle(node.id);

  return (
    <li className={styles.item} data-depth={depth} data-open={open ? "" : undefined}>
      <div className={styles.head} data-ancestor={ancestor ? "" : undefined}>
        {node.to ? (
          <>
            <DisclosureButton
              expanded={open}
              controls={listId}
              onToggle={toggle}
              className={styles.chevron}
              aria-label={open ? w.collapse(node.label) : w.expand(node.label)}
              data-nav-group={node.id}
            >
              {null}
            </DisclosureButton>
            <Row node={node} current={current} onNavigate={onNavigate} />
          </>
        ) : (
          <DisclosureButton
            expanded={open}
            controls={listId}
            onToggle={toggle}
            className={styles.toggle}
            data-nav-item=""
            data-nav-group={node.id}
          >
            <span className={styles.toggleLabel}>
              <Mark node={node} current={false} />
              <span className={styles.text}>{node.label}</span>
              <Badge n={node.badge} label={node.badgeLabel} />
            </span>
          </DisclosureButton>
        )}
      </div>
      <ul id={listId} className={styles.children} hidden={!open} data-parent={node.id}>
        {kids.map((k) => (
          <SidebarGroup
            key={k.id}
            node={k}
            currentId={currentId}
            ancestors={ancestors}
            isOpen={isOpen}
            onToggle={onToggle}
            onNavigate={onNavigate}
            idBase={idBase}
            depth={depth + 1}
          />
        ))}
      </ul>
    </li>
  );
}

export type SidebarNavProps = {
  nodes: NavNode[];
  /** The accessible name of the landmark. */
  label: string;
  /** localStorage key for what the viewer opened. */
  storageKey: string;
  /** The node to treat as current when the URL matches none (an editor route's section). */
  fallbackId?: string;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({ nodes, label, storageKey, fallbackId, onNavigate, className }: SidebarNavProps) {
  const { pathname, search } = useLocation();
  const idBase = useId();
  const root = useRef<HTMLElement>(null);
  const currentId = currentNodeId(nodes, pathname, search) ?? fallbackId;
  const ancestors = ancestorsOf(nodes, currentId);

  const [open, setOpen] = useState<OpenMap>(() => {
    const stored = readOpen(storageKey);
    for (const id of ancestors) stored[id] = true;
    return stored;
  });

  /* A new route opens the groups on its way, once; the viewer may shut them again. */
  const [seen, setSeen] = useState(currentId);
  if (seen !== currentId) {
    setSeen(currentId);
    if (ancestors.some((id) => !open[id])) setOpen({ ...open, ...Object.fromEntries(ancestors.map((id) => [id, true])) });
  }

  const set = useCallback(
    (id: string, value: boolean) => {
      setOpen((cur) => ({ ...cur, [id]: value }));
    },
    [],
  );
  useEffect(() => writeOpen(storageKey, open), [storageKey, open]);

  const isOpen = (id: string) => !!open[id];
  const onToggle = (id: string) => set(id, !open[id]);

  const items = () => [...(root.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? [])].filter((el) => !el.closest("[hidden]"));

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-nav-item], [data-nav-group]")) return;
    const list = items();
    const at = list.indexOf(target);
    const go = (i: number) => {
      e.preventDefault();
      list[Math.max(0, Math.min(list.length - 1, i))]?.focus();
    };
    const rtl = document.documentElement.dir === "rtl";
    const group = target.closest<HTMLElement>("[data-nav-group]")?.getAttribute("data-nav-group") ?? target.getAttribute("data-nav-id");
    const parentOf = (el: HTMLElement) => el.closest<HTMLElement>("ul[data-parent]");
    switch (e.key) {
      case "ArrowDown":
        return go(at + 1);
      case "ArrowUp":
        return go(at - 1);
      case "Home":
        return go(0);
      case "End":
        return go(list.length - 1);
      case "ArrowRight":
      case "ArrowLeft": {
        const forward = (e.key === "ArrowRight") !== rtl;
        const isGroup = !!target.getAttribute("data-nav-group") || (group && target.closest("li")?.querySelector(":scope > ul[data-parent]"));
        if (forward && isGroup && group) {
          e.preventDefault();
          if (!open[group]) set(group, true);
          else go(at + 1);
          return;
        }
        if (!forward) {
          if (isGroup && group && open[group]) {
            e.preventDefault();
            set(group, false);
            return;
          }
          const p = parentOf(target);
          if (p) {
            e.preventDefault();
            const owner = p.parentElement?.querySelector<HTMLElement>(":scope > div [data-nav-item]");
            owner?.focus();
          }
        }
        return;
      }
    }
  };

  return (
    <nav ref={root} aria-label={label} className={[styles.nav, className].filter(Boolean).join(" ")} onKeyDown={onKeyDown}>
      <ul className={styles.root}>
        {nodes.map((n) => (
          <SidebarGroup
            key={n.id}
            node={n}
            currentId={currentId}
            ancestors={ancestors}
            isOpen={isOpen}
            onToggle={onToggle}
            onNavigate={onNavigate}
            idBase={idBase}
          />
        ))}
      </ul>
    </nav>
  );
}
