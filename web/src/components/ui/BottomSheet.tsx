import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
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

type Active = { id: string; requestClose: () => void; release: () => void };
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

export function BottomSheet({
  open, onClose, title, snap: initial = "half", snaps: snapsProp, onSnap, dismissible = true, footer, children,
}: BottomSheetProps) {
  const w = useMobileWords().sheet;
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pushed = useRef(false);
  const latest = useRef({ onClose, dismissible });
  useEffect(() => {
    latest.current = { onClose, dismissible };
  });

  const snaps = [...new Set<Snap>([...(snapsProp ?? ["half", "full"]), initial])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const [snap, setSnapState] = useState<Snap>(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnapState(initial);
  }

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
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");

    const prev = active;
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
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
      if (pushed.current) {
        pushed.current = false;
        if ((window.history.state as { sheet?: string } | null)?.sheet === id) window.history.back();
      }
      if (opener?.isConnected) opener.focus();
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
    if (dismissible && (low - eff) / low > DISMISS_FRACTION) {
      void attemptClose(false).then((closed) => {
        if (!closed) resetPlace();
      });
      return;
    }
    let target: Snap;
    if (Math.abs(s.v) > FLICK) {
      const i = snaps.indexOf(shown);
      target = snaps[Math.min(snaps.length - 1, Math.max(0, i + (s.v < 0 ? 1 : -1)))];
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
      data-reduced={reduced ? "true" : undefined}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        void attemptClose(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void attemptClose(false);
      }}
    >
      {open && (
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
                {title}
              </h2>
              {dismissible && (
                <button type="button" className={styles.close} aria-label={w.close} onClick={() => void attemptClose(false)}>
                  <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
                </button>
              )}
            </div>
          </div>
          <div className={styles.body}>{children}</div>
          {footer && (
            <div className={styles.footer} data-sheet-footer="">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
