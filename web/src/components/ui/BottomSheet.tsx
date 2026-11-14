import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/BottomSheet.module.css";

/*
 * The phone's detail surface: a native modal <dialog> that rises from the
 * bottom, opens at half height and pulls up to full.
 *
 * The browser does the hard parts (top layer, inert page, Escape, a focus
 * trap); this adds what it does not:
 *  - Back closes it. Opening pushes one history entry, Back pops it, and a
 *    close from code pops it once if it is still the current entry.
 *  - Focus lands on the title (no keyboard rising for a field) and returns to
 *    whatever opened it.
 *  - The handle is a real button, so resizing never needs a drag.
 *  - One sheet at a time: opening a second asks the first to close.
 * Dragging starts on the header only, so scrolling the body never fights it.
 * Opening and closing are state first: `open` flips the dialog on the event, the
 * stylesheet slides it (phones, motion allowed), and a closed sheet is
 * `display: none` and inert whatever its animation did. The last title, body and
 * footer are kept (`retained`) for the length of the exit so it leaves with its
 * content, then dropped by a timer that never decides open or closed.
 * Moves are the height itself while dragging up (it grows, so the body keeps
 * its room) and a translate while dragging below the lowest snap (it leaves).
 */

export type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["peek", "half", "full"];

/** Fraction of the viewport; peek never drops under 168px. */
const heightPx = (s: Snap, vh: number) => (s === "peek" ? Math.max(168, vh * 0.3) : vh * (s === "half" ? 0.55 : 0.92));

/** Release this far below the lowest snap and the sheet leaves. */
const DISMISS_FRACTION = 0.25;
/** A flick faster than this (px per ms) goes to the next snap, wherever it ended. */
const FLICK = 0.5;
/** A finger that rested this long before lifting is not flicking. */
const FLICK_STALE_MS = 100;
/** ...and travelled at least this far below the lowest snap, so a twitch is not a dismissal. */
const FLICK_MIN_PX = 48;
const DRAG_SLOP = 4;

export interface BottomSheetProps {
  open: boolean;
  /** Return false (or a promise of false) to veto, e.g. a form with unsaved changes. */
  onClose: () => void | boolean | Promise<boolean | void>;
  title: string;
  /** The snap it opens at. Default "half". */
  snap?: Snap;
  /** The snaps it can rest at. Default half and full. */
  snaps?: Snap[];
  onSnap?: (snap: Snap) => void;
  /** Default true. False: no Escape, backdrop, Close button or drag-to-dismiss. */
  dismissible?: boolean;
  /** Sticky and safe-area padded; the primary action lives here. */
  footer?: ReactNode;
  children?: ReactNode;
}

type Active = { id: string; requestClose: () => void; release: () => void; opener: HTMLElement | null };
let active: Active | null = null;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Where focus goes when the control that opened a sheet is gone: a neighbour of it (a list's next row), then the page's main area. Never <body>. */
function fallbackFocus(near: Array<Element | null>) {
  const target = (el: Element | null): HTMLElement | null => {
    if (!el?.isConnected || el.closest("dialog, [inert]")) return null;
    if (el.matches(FOCUSABLE)) return el as HTMLElement;
    return el.querySelector<HTMLElement>(FOCUSABLE);
  };
  for (const el of near) {
    const t = target(el);
    if (t) return void t.focus();
  }
  const main = document.querySelector("main, [role=main]") ?? document.body;
  [...main.querySelectorAll<HTMLElement>(FOCUSABLE)].find((e) => !e.closest("dialog, [role=toolbar], [inert]"))?.focus();
}

export function BottomSheet({
  open, onClose, title, snap: initial = "half", snaps: snapsProp, onSnap, dismissible = true, footer, children,
}: BottomSheetProps) {
  const w = useMobileWords().sheet;
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pushed = useRef(false);
  /* Set when the effect closes the dialog itself, so the `close` event that follows is not mistaken for a native close. */
  const ownClose = useRef(false);
  const latest = useRef({ onClose, dismissible, open });
  useEffect(() => {
    latest.current = { onClose, dismissible, open };
  });

  const snaps = [...new Set<Snap>([...(snapsProp ?? ["half", "full"]), initial])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const [snap, setSnapState] = useState<Snap>(initial);
  const motion = usePhoneMotion();
  const [wasOpen, setWasOpen] = useState(open);
  const [retained, setRetained] = useState(false);
  const [last, setLast] = useState({ title, children, footer });
  if (open && (last.title !== title || last.children !== children || last.footer !== footer)) setLast({ title, children, footer });
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnapState(initial);
    setRetained(!open && motion);
  }
  useEffect(() => {
    if (!retained) return;
    const t = setTimeout(() => setRetained(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [retained]);
  const view = open ? { title, children, footer } : last;

  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const short = useMedia("(max-height: 479px)");
  const shown: Snap = short ? "full" : snap;

  const setSnap = (s: Snap) => {
    if (s === snap) return;
    setSnapState(s);
    onSnap?.(s);
  };

  const attemptClose = async (fromHistory: boolean) => {
    const { onClose: close, dismissible: ok } = latest.current;
    let vetoed = !ok;
    if (ok) vetoed = (await close()) === false;
    if (vetoed && fromHistory) {
      window.history.pushState({ sheet: id }, "");
      pushed.current = true;
    }
    return !vetoed;
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (!d || !open) return;
    let opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    /* Every open starts from the resting place, whatever a drag left on the persistent dialog. */
    resetPlace();
    drag.current = null;
    ownClose.current = false;
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }

    const prev = active;
    /* Opened from a control inside the sheet it replaces (More, then Delete): return to what opened that one. */
    if (prev?.opener && opener?.closest("dialog")) opener = prev.opener;
    const near: Array<Element | null> = [];
    for (let el: Element | null = opener, n = 0; el && n < 3; el = el.parentElement, n++) near.push(el.nextElementSibling, el.previousElementSibling);
    if (prev) {
      prev.release();
      prev.requestClose();
      window.history.replaceState({ sheet: id }, "");
    } else {
      window.history.pushState({ sheet: id }, "");
    }
    pushed.current = true;
    const me: Active = {
      id,
      requestClose: () => void attemptClose(false),
      release: () => {
        pushed.current = false;
      },
      opener,
    };
    active = me;

    const onPop = () => {
      /* Our entry is still current: this is some other traversal, not Back. */
      if ((window.history.state as { sheet?: string } | null)?.sheet === id) return;
      pushed.current = false;
      void attemptClose(true);
    };
    window.addEventListener("popstate", onPop);
    titleRef.current?.focus();

    return () => {
      window.removeEventListener("popstate", onPop);
      if (active === me) active = null;
      /* Transitions back on so the exit plays from wherever a drag left the sheet; the next open resets the place. */
      if (drag.current) resetPlace();
      else delete d.dataset.dragging;
      drag.current = null;
      if (d.open) ownClose.current = true;
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
      if (pushed.current) {
        pushed.current = false;
        if ((window.history.state as { sheet?: string } | null)?.sheet === id) window.history.back();
      }
      if (opener?.isConnected && !opener.closest("[inert]")) opener.focus();
      else fallbackFocus(near);
    };
    // attemptClose reads the latest props through a ref; only opening and closing restart this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ----------------------------------------------------------- keyboard */

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hidden);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === titleRef.current || at === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const step = (dir: 1 | -1) => {
    if (short || snaps.length < 2) return;
    const i = snaps.indexOf(snap);
    const next = snaps[Math.min(snaps.length - 1, Math.max(0, i + dir))];
    setSnap(next);
  };
  const cycle = () => {
    if (short || snaps.length < 2) return;
    setSnap(snaps[(snaps.indexOf(snap) + 1) % snaps.length]);
  };

  /* --------------------------------------------------------------- drag */

  const drag = useRef<{ y: number; h: number; moved: boolean; last: { y: number; t: number }; v: number } | null>(null);
  const suppressClick = useRef(false);

  const place = (eff: number, lowest: number) => {
    const d = dialogRef.current;
    if (!d) return;
    const vh = window.innerHeight;
    const clamped = Math.min(Math.max(eff, lowest), heightPx("full", vh));
    d.style.blockSize = `${clamped}px`;
    d.style.transform = eff < lowest ? `translateY(${lowest - eff}px)` : "";
  };
  const resetPlace = () => {
    const d = dialogRef.current;
    if (!d) return;
    d.style.blockSize = "";
    d.style.transform = "";
    delete d.dataset.dragging;
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (short || (e.button ?? 0) !== 0) return;
    drag.current = {
      y: e.clientY,
      h: heightPx(shown, window.innerHeight),
      moved: false,
      last: { y: e.clientY, t: performance.now() },
      v: 0,
    };
  };

  const lowest = () => heightPx(snaps[0], window.innerHeight);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = drag.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (!s.moved) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      s.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (dialogRef.current) dialogRef.current.dataset.dragging = "true";
    }
    const now = performance.now();
    if (now - s.last.t >= 1) s.v = (e.clientY - s.last.y) / (now - s.last.t);
    s.last = { y: e.clientY, t: now };
    place(s.h - dy, lowest());
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = drag.current;
    drag.current = null;
    if (!s?.moved) return;
    suppressClick.current = true;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const vh = window.innerHeight;
    const eff = s.h - (e.clientY - s.y);
    const low = lowest();
    /* A pause before lifting cancels the speed: only a flick that is still moving at release counts. */
    const flick = performance.now() - s.last.t > FLICK_STALE_MS ? 0 : s.v;
    const flickedOff = flick > FLICK && snaps.indexOf(shown) <= 0 && low - eff >= FLICK_MIN_PX;
    if (dismissible && (flickedOff || (low - eff) / low > DISMISS_FRACTION)) {
      // Vetoed or not, the sheet is back at its resting place; a close also resets it when the effect tears down.
      void attemptClose(false).then(resetPlace);
      return;
    }
    let target: Snap;
    if (Math.abs(flick) > FLICK) {
      const i = snaps.indexOf(shown);
      target = snaps[Math.min(snaps.length - 1, Math.max(0, i + (flick < 0 ? 1 : -1)))];
    } else {
      target = snaps.reduce((best, c) => (Math.abs(heightPx(c, vh) - eff) < Math.abs(heightPx(best, vh) - eff) ? c : best), snaps[0]);
    }
    resetPlace();
    setSnap(target);
  };

  const onPointerCancel = () => {
    drag.current = null;
    resetPlace();
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.sheet, "pop-dialog", "pop-dialog--bottom")}
      aria-modal="true"
      aria-labelledby={titleId}
      data-snap={shown}
      inert={!open}
      data-reduced={reduced ? "true" : undefined}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        void attemptClose(false);
      }}
      onClose={(e) => {
        /* The browser closed it without being asked (Back's second press, a dialog form): tell the owner, or `open` stays true. */
        const d = e.currentTarget;
        if (ownClose.current) {
          ownClose.current = false;
          return;
        }
        if (d.open || !latest.current.open) return;
        void attemptClose(false).then((closed) => {
          // Vetoed: the sheet is still wanted, so it comes back.
          if (!closed && latest.current.open && !d.open && d.isConnected && typeof d.showModal === "function") d.showModal();
        });
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void attemptClose(false);
      }}
    >
      {(open || retained) && (
        <div className={styles.panel}>
          <div
            className={styles.head}
            data-sheet-header=""
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                suppressClick.current = false;
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            <button
              type="button"
              className={styles.handle}
              aria-label={w.resize}
              onClick={cycle}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  step(1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  step(-1);
                }
              }}
            >
              <span className={styles.pill} aria-hidden="true" />
            </button>
            <div className={styles.titlebar}>
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
                {view.title}
              </h2>
              {dismissible && (
                <button type="button" className={styles.close} aria-label={w.close} onClick={() => void attemptClose(false)}>
                  <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
                </button>
              )}
            </div>
          </div>
          <div className={styles.body}>{view.children}</div>
          {view.footer && (
            <div className={styles.footer} data-sheet-footer="">
              {view.footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
