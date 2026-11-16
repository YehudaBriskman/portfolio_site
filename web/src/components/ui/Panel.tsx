import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ICON } from "@/components/ui/icons";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { usePanelGrid, type PanelSpan } from "@/components/ui/PanelGrid";
import { useMobileWords } from "@/i18n/mobile";
import { usePanelWords } from "@/i18n/panels";
import styles from "@/components/ui/Panel.module.css";

/*
 * One panel of a dashboard: a title, a few actions, a body with four honest
 * states (ready, loading, empty, error). Every panel expands to full size with
 * the V key or the visible expand button and leaves with Esc (principle 2); the
 * menu holds View (the panel's own screen) and Expand. Focus goes to the same
 * button on the way in and the way out, so a keyboard user is never lost. The
 * grid slot keeps its size while the panel is lifted, so nothing else moves.
 * `children` may be a function of "am I expanded", for a longer list at full size.
 */

export type PanelState = "ready" | "loading" | "empty" | "error";

export interface PanelProps {
  /** Stable id: the grid knows which panel is expanded by it. */
  id: string;
  title: string;
  icon?: typeof ICON.note;
  /** The panel's own screen: gives the menu a View item. */
  to?: string;
  span?: PanelSpan;
  /** "content" sizes the panel to its body instead of the tallest panel in its row (a short body would otherwise sit in empty space). */
  fit?: "stretch" | "content";
  state?: PanelState;
  /** Shown in the body when state is "empty". */
  empty?: ReactNode;
  /** Replaces the default "Could not load" when state is "error". */
  error?: ReactNode;
  /** A short figure beside the title (a count). */
  meta?: ReactNode;
  /** Extra header controls, before expand. */
  actions?: ReactNode;
  children?: ReactNode | ((expanded: boolean) => ReactNode);
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

export function Panel({ id, title, icon, to, span = 6, fit = "stretch", state = "ready", empty, error, meta, actions, children }: PanelProps) {
  const w = usePanelWords();
  const icons = useMobileWords().icons;
  const grid = usePanelGrid();
  const [local, setLocal] = useState<string | null>(null);
  const expandedId = grid ? grid.expanded : local;
  const setExpanded = grid ? grid.setExpanded : setLocal;
  const expanded = expandedId === id;
  const headId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const viaMenu = useRef(false);
  const seen = useRef(expanded);

  /* Focus follows the expand button in and out. Not on first mount. */
  useEffect(() => {
    if (seen.current === expanded) return;
    seen.current = expanded;
    toggle.current?.focus();
  }, [expanded]);

  const flip = useCallback(() => setExpanded(expanded ? null : id), [expanded, id, setExpanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      /* An open menu or tooltip takes Esc first (Radix marks it handled); the menu is checked by role. */
      if (e.key === "Escape" && !document.querySelector('[role="menu"]')) setExpanded(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, setExpanded]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key.toLowerCase() !== "v" || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    e.preventDefault();
    flip();
  };

  const body = typeof children === "function" ? children(expanded) : children;
  const label = expanded ? icons.minimize : icons.maximize;

  return (
    <div className={styles.slot} data-span={span} data-fit={fit === "content" ? "content" : undefined}>
      {expanded && <div className={styles.scrim} aria-hidden="true" onClick={() => setExpanded(null)} />}
      <section
        className={styles.panel}
        aria-labelledby={headId}
        aria-busy={state === "loading" || undefined}
        data-panel={id}
        data-expanded={expanded ? "true" : undefined}
        onKeyDown={onKeyDown}
      >
        <header className={styles.head}>
          <h3 id={headId} className={styles.title}>
            {icon && <Icon icon={icon} size={16} aria-hidden="true" />}
            <span className={styles.titleText}>{title}</span>
          </h3>
          {meta != null && <span className={styles.meta}>{meta}</span>}
          <span className={styles.tools}>
            {actions}
            <IconButton
              ref={toggle}
              icon={expanded ? ICON.minimize : ICON.maximize}
              label={label}
              size="sm"
              pressed={expanded}
              aria-keyshortcuts="V"
              onClick={flip}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton icon={ICON.more} label={w.menu(title)} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => {
                  if (viaMenu.current) {
                    e.preventDefault();
                    viaMenu.current = false;
                  }
                }}
              >
                {to && (
                  <DropdownMenuItem asChild>
                    <Link to={to}>{w.view}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    viaMenu.current = true;
                    flip();
                  }}
                >
                  {expanded ? w.leave : w.expand}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </header>
        <div className={styles.body}>
          {state === "loading" ? (
            <>
              <span className="sr-only" role="status">{w.loading}</span>
              <span className={styles.skeleton} aria-hidden="true"><i /><i /><i /></span>
            </>
          ) : state === "error" ? (
            <p className={styles.note} role="alert">{error ?? w.failed}</p>
          ) : state === "empty" ? (
            <div className={styles.note}>{empty}</div>
          ) : (
            body
          )}
        </div>
      </section>
    </div>
  );
}
