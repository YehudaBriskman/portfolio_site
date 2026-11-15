import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
 * One row geometry: a group is a small muted heading with its own chevron, an
 * item is an icon and a label, and every row starts at the same inline edge
 * (only a group inside a group steps in). The current item is a soft fill and
 * an accent bar, never a weight. With `collapsed` the same tree is an icon
 * rail: an item is a glyph with a tooltip, a group a button opening a flyout.
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

function holdsChildren(nodes: NavNode[], id: string): boolean {
  for (const n of nodes) {
    if (n.id === id) return !!n.children?.length;
    if (n.children && holdsChildren(n.children, id)) return true;
  }
  return false;
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

/** The row's mark: a plain glyph, no ring and no circle, the same box whether or not the row is current. */
function Mark({ node }: { node: NavNode }) {
  const Icon = node.icon;
  return (
    <span className={styles.mark} aria-hidden="true">
      {Icon ? <Icon /> : null}
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
      <Mark node={node} />
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
            <Row node={node} current={current} onNavigate={onNavigate} />
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
              <span className={styles.text}>{node.label}</span>
              {/* A count is said once: on the heading while the group is shut, on the row inside once it is open. */}
              {!open && <Badge n={node.badge} label={node.badgeLabel} />}
            </span>
          </DisclosureButton>
        )}
      </div>
      {/* The wrapper's row track is what moves (0fr to 1fr); the list inside is `hidden` once shut. */}
      <div className={styles.collapse} data-open={open ? "" : undefined}>
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
      </div>
    </li>
  );
}

const isRtl = () => typeof document !== "undefined" && document.documentElement.dir === "rtl";

/** A glyph, its name for a screen reader, and a dot for a count: what a rail row shows. */
function RailFace({ node }: { node: NavNode }) {
  return (
    <>
      <Mark node={node} />
      <span className="sr-only">{node.label}</span>
      {node.badge ? (
        <>
          <span className={styles.dot} aria-hidden="true" />
          {node.badgeLabel && <span className="sr-only">{node.badgeLabel}</span>}
        </>
      ) : null}
    </>
  );
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={isRtl() ? "left" : "right"} sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function RailGroup({ node, currentId, ancestors, onNavigate }: { node: NavNode; currentId?: string; ancestors: readonly string[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const holdsCurrent = ancestors.includes(node.id);
  const flat: Array<{ node: NavNode; depth: number }> = [];
  const walk = (list: NavNode[], depth: number) => {
    for (const n of list) {
      if (n.to) flat.push({ node: n, depth });
      if (n.children) walk(n.children, depth + 1);
    }
  };
  walk(node.children ?? [], 0);
  return (
    <li className={styles.railItem}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tip label={node.label}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={styles.railBtn}
              data-nav-item=""
              data-nav-group={node.id}
              data-active={holdsCurrent ? "" : undefined}
              aria-haspopup="dialog"
            >
              <RailFace node={node} />
            </button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent side={isRtl() ? "left" : "right"} align="start" sideOffset={10} className={styles.flyout}>
          <p className={styles.flyoutHead}>{node.label}</p>
          <ul className={styles.flyoutList}>
            {flat.map(({ node: n, depth }) => (
              <li key={n.id} data-depth={depth}>
                <Link
                  to={n.to!}
                  className={styles.link}
                  aria-current={n.id === currentId ? "page" : undefined}
                  data-nav-id={n.id}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                >
                  <Mark node={n} />
                  <span className={styles.text}>{n.label}</span>
                  <Badge n={n.badge} label={n.badgeLabel} />
                </Link>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </li>
  );
}

function RailNode({ node, currentId, ancestors, onNavigate }: { node: NavNode; currentId?: string; ancestors: readonly string[]; onNavigate?: () => void }) {
  if (node.children?.length) return <RailGroup node={node} currentId={currentId} ancestors={ancestors} onNavigate={onNavigate} />;
  return (
    <li className={styles.railItem}>
      <Tip label={node.label}>
        <Link
          to={node.to!}
          className={styles.railBtn}
          aria-current={node.id === currentId ? "page" : undefined}
          data-nav-item=""
          data-nav-id={node.id}
          onClick={onNavigate}
        >
          <RailFace node={node} />
        </Link>
      </Tip>
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
  /** Draw the icon rail: a glyph per row, groups as flyouts. */
  collapsed?: boolean;
};

export function SidebarNav({ nodes, label, storageKey, fallbackId, onNavigate, className, collapsed }: SidebarNavProps) {
  const { pathname, search } = useLocation();
  const idBase = useId();
  const root = useRef<HTMLElement>(null);
  const currentId = currentNodeId(nodes, pathname, search) ?? fallbackId;
  /* The groups on the way to the current row open, and so does a current group that has rows of its own (Marketing > Settings). */
  const trail = ancestorsOf(nodes, currentId);
  const ancestors = currentId && holdsChildren(nodes, currentId) ? [...trail, currentId] : trail;

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

  /* The first paint is the state as it is: only a change after mount moves (no group fades in on arrival). */
  /* An attribute set by hand, not state: React never renders it, so it is not undone and costs no render. */
  useEffect(() => root.current?.setAttribute("data-armed", ""), []);

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
        if (collapsed) return;
        const forward = (e.key === "ArrowRight") !== rtl;
        const isGroup = !!target.getAttribute("data-nav-group") || (group && target.closest("li")?.querySelector(":scope > div > ul[data-parent]"));
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
            const owner = p.parentElement?.parentElement?.querySelector<HTMLElement>(":scope > div:first-child [data-nav-item]");
            owner?.focus();
          }
        }
        return;
      }
    }
  };

  return (
    <nav ref={root} aria-label={label} className={[styles.nav, className].filter(Boolean).join(" ")} onKeyDown={onKeyDown} data-collapsed={collapsed ? "" : undefined}>
      {collapsed ? (
        <TooltipProvider delayDuration={300}>
          <ul className={styles.root}>
            {nodes.map((n) => (
              <RailNode key={n.id} node={n} currentId={currentId} ancestors={ancestors} onNavigate={onNavigate} />
            ))}
          </ul>
        </TooltipProvider>
      ) : (
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
      )}
    </nav>
  );
}
