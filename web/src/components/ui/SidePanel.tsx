import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ICON } from "@/components/ui/icons";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EXIT_KEEP_MS } from "@/hooks/usePhoneMotion";
import { usePhone } from "@/hooks/usePhone";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/SidePanel.module.css";

/*
 * Look-and-edit while the list matters (A21): a non-modal side panel at the
 * inline-end edge on a desktop, a half BottomSheet on a phone. The list stays
 * on screen and usable, so the panel is not a modal: no inert page, no
 * backdrop, no <dialog>. What it keeps from a dialog is what a keyboard needs:
 *  - focus moves to the title on open (no keyboard rising for a field) and
 *    returns to whatever opened it on close; Escape inside it closes it, and
 *    an Escape something inside already handled (a menu) is not a close;
 *  - `trapFocus` wraps Tab inside it, for a panel that is a task of its own;
 *    the default lets Tab leave, because the list beside it is meant to be used;
 *  - `beforeClose` may veto (return false): pair it with `useUnsavedGuard`;
 *  - the page reserves its width (`--a-panel-w`, read by `.a-main`), so the
 *    panel never covers the rows it is about;
 *  - its edge is a separator: drag it or use the arrow keys, 360 to 560.
 * Open and closed are state first: `open` flips `data-state` on the event, the
 * stylesheet moves it (transform and opacity, reduced motion gets it hidden at
 * once), and a timer, never an animation event, drops it after its exit.
 * The words are the caller's; Close and Resize are the sheet's own.
 */

export const SIDE_PANEL_MIN = 360;
export const SIDE_PANEL_MAX = 560;
export const SIDE_PANEL_DEFAULT = 420;
const STEP = 16;
const STORE = "admin-sidepanel-w";
/** The panel never takes more than this share of the viewport, so a narrow window keeps its list. */
const MAX_SHARE = 0.6;

const clamp = (n: number) => Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, Math.round(n)));

function readWidth(): number {
  try {
    const n = Number(localStorage.getItem(STORE));
    return n ? clamp(n) : SIDE_PANEL_DEFAULT;
  } catch {
    return SIDE_PANEL_DEFAULT;
  }
}
function writeWidth(n: number) {
  try {
    localStorage.setItem(STORE, String(n));
  } catch {
    /* blocked storage: the width still works, it just forgets */
  }
}

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
const CloseGlyph = (p: { className?: string; "aria-hidden"?: boolean | "true" }) => <Icon icon={ICON.close} {...p} />;

export interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Sticky at the bottom; the primary action lives here. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Return false (or a promise of false) to keep it open, e.g. unsaved changes. */
  beforeClose?: () => boolean | void | Promise<boolean | void>;
  /** Wrap Tab inside the panel. Default false: the list beside it stays reachable. */
  trapFocus?: boolean;
}

export function SidePanel(props: SidePanelProps) {
  const phone = usePhone();
  const { open, onOpenChange, title, footer, children, beforeClose } = props;
  if (phone) {
    return (
      <BottomSheet
        open={open}
        title={title}
        footer={footer}
        onClose={async () => {
          if ((await beforeClose?.()) === false) return false;
          onOpenChange(false);
        }}
      >
        {children}
      </BottomSheet>
    );
  }
  return <DesktopPanel {...props} />;
}

function DesktopPanel({ open, onOpenChange, title, footer, children, beforeClose, trapFocus = false }: SidePanelProps) {
  const w = useMobileWords().sheet;
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [width, setWidthState] = useState(readWidth);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  /* Mounted from open until the timer after its exit. */
  const [shown, setShown] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  const [last, setLast] = useState({ title, children, footer });
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShown(true);
  }
  if (open && (last.title !== title || last.children !== children || last.footer !== footer)) setLast({ title, children, footer });
  const view = open ? { title, children, footer } : last;

  useEffect(() => {
    if (open || !shown) return;
    const t = setTimeout(() => setShown(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [open, shown]);

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const effective = Math.min(width, Math.max(SIDE_PANEL_MIN, Math.floor(vw * MAX_SHARE)));

  /* The page makes room for it while it is open. */
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.setProperty("--a-panel-w", `${effective}px`);
    return () => {
      root.style.removeProperty("--a-panel-w");
    };
  }, [open, effective]);

  /* It sits under the top bar, whatever height large text gives that bar. */
  useEffect(() => {
    const bar = document.querySelector(".a-top");
    const el = panel.current;
    if (!open || !bar || !el) return;
    const place = () => el.style.setProperty("--sp-top", `${Math.max(0, Math.round(bar.getBoundingClientRect().bottom))}px`);
    place();
    window.addEventListener("resize", place);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    ro?.observe(bar);
    return () => {
      window.removeEventListener("resize", place);
      ro?.disconnect();
    };
  }, [open, shown]);

  /* Focus in on open, back out on close. */
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus();
    return () => {
      const a = document.activeElement;
      const lost = !a || a === document.body || !!panel.current?.contains(a);
      if (!lost) return;
      const back = opener.current;
      if (back?.isConnected && !back.closest("[inert]")) back.focus();
      else document.querySelector<HTMLElement>("main, [role=main]")?.focus();
    };
  }, [open]);

  const request = useCallback(() => {
    const r = beforeClose?.();
    if (r instanceof Promise) void r.then((ok) => ok !== false && onOpenChange(false));
    else if (r !== false) onOpenChange(false);
  }, [beforeClose, onOpenChange]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      request();
      return;
    }
    if (e.key !== "Tab" || !trapFocus || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const lastItem = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !panel.current.contains(at) || at === heading.current)) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && at === lastItem) {
      e.preventDefault();
      first.focus();
    }
  };

  const setWidth = (n: number) => {
    const v = clamp(n);
    setWidthState(v);
    writeWidth(v);
  };
  const rtl = () => document.documentElement.dir === "rtl";
  const onSepKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const wider = rtl() ? "ArrowRight" : "ArrowLeft";
    const narrower = rtl() ? "ArrowLeft" : "ArrowRight";
    if (e.key === wider) setWidth(width + STEP);
    else if (e.key === narrower) setWidth(width - STEP);
    else if (e.key === "Home") setWidth(SIDE_PANEL_MIN);
    else if (e.key === "End") setWidth(SIDE_PANEL_MAX);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const drag = useRef(false);
  const onSepDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onSepMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidthState(clamp(rtl() ? e.clientX : window.innerWidth - e.clientX));
  };
  const onSepUp = () => {
    if (!drag.current) return;
    drag.current = false;
    writeWidth(width);
  };

  if (!shown) return null;
  return (
    <div
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="side-panel-title"
      data-side-panel=""
      data-state={open ? "open" : "closed"}
      inert={!open || undefined}
      style={{ ["--sp-w" as string]: `${effective}px` }}
      onKeyDown={onKeyDown}
    >
      <div
        className={styles.edge}
        role="separator"
        aria-orientation="vertical"
        aria-label={w.resize}
        aria-valuemin={SIDE_PANEL_MIN}
        aria-valuemax={SIDE_PANEL_MAX}
        aria-valuenow={effective}
        tabIndex={0}
        onKeyDown={onSepKey}
        onPointerDown={onSepDown}
        onPointerMove={onSepMove}
        onPointerUp={onSepUp}
        onPointerCancel={onSepUp}
      />
      <header className={styles.head}>
        <h2 id="side-panel-title" ref={heading} tabIndex={-1} className={styles.title}>
          {view.title}
        </h2>
        <IconButton icon={CloseGlyph} label={w.close} onClick={request} />
      </header>
      <div className={styles.body}>{view.children}</div>
      {view.footer && <footer className={styles.foot}>{view.footer}</footer>}
    </div>
  );
}

/* ───────────────────────────────────────────────────────── hooks */

/**
 * `beforeClose` for a panel (or a sheet) holding a form: nothing changed means go
 * ahead; changed means `ask()`, which the caller words and draws (a ConfirmDialog
 * with "Discard changes" and "Keep editing"), and its answer is the veto. While
 * dirty. It deliberately does not hold a leave-the-page prompt: an unload handler can
 * cost the back/forward cache, and a guard test keeps it off the site.
 */
export function useUnsavedGuard(dirty: boolean, ask: () => boolean | Promise<boolean>): () => Promise<boolean> {
  const latest = useRef({ dirty, ask });
  useEffect(() => {
    latest.current = { dirty, ask };
  });
  return useCallback(async () => (latest.current.dirty ? await latest.current.ask() : true), []);
}

/**
 * The open record's id in the address (`?panel=7`), so a reload or a pasted
 * link reopens it and other params (tab, filters) are left alone. It replaces
 * rather than pushes: the phone's sheet owns its own Back entry, and a panel
 * opened on a desktop is not a page.
 */
export function useSidePanelParam(key = "panel") {
  const [params, setParams] = useSearchParams();
  const id = params.get(key);
  const open = useCallback(
    (next: string) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set(key, next);
          return q;
        },
        { replace: true },
      ),
    [key, setParams],
  );
  const close = useCallback(
    () =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.delete(key);
          return q;
        },
        { replace: true },
      ),
    [key, setParams],
  );
  return { id, open, close };
}
