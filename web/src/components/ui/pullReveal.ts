import { useEffect, useRef } from "react";

/*
 * Pull to reveal the page title (#896, docs/admin-pull-title.md).
 *
 * On a phone the admin has no top bar. At the very top of the page a further downward pull draws the
 * page title in from above, in proportion to the pull and damped, and releasing sends it back. This file
 * is the whole mechanism: a pure state machine (`pullStart` / `pullMove` / `pullEnd`, unit-tested) and the
 * hook that feeds it from touch events and, as a second source, from the negative `scrollY` that iOS
 * Safari reports while it rubber-bands. It does not depend on the browser's own bounce: Chrome Android
 * has none (and its pull-to-refresh is switched off by `overscroll-behavior-y: contain`, index.css).
 *
 * Listeners are passive and never call preventDefault, so a scroll that starts below the top is never
 * touched: the machine only arms when a touch STARTS at scrollY <= 0, and disarms the moment the page
 * scrolls or the finger moves up.
 */

export const PULL_THRESHOLD = 8;
export const PULL_MAX = 72;

export type PullPhase = "idle" | "armed" | "pulling";
export type PullState = { phase: PullPhase; startY: number; offset: number };
export type PullEnv = { atTop: boolean; blocked: boolean };

export const PULL_IDLE: PullState = { phase: "idle", startY: 0, offset: 0 };

/** Finger travel (past the threshold) to the title's travel: it gives way the further it goes, and never passes `max`. */
export function damp(travel: number, max = PULL_MAX): number {
  if (travel <= 0) return 0;
  return max * (1 - Math.exp(-travel / (max * 1.6)));
}

export function pullStart(y: number, env: PullEnv): PullState {
  return env.atTop && !env.blocked ? { phase: "armed", startY: y, offset: 0 } : PULL_IDLE;
}

export function pullMove(s: PullState, y: number, env: PullEnv, max = PULL_MAX): PullState {
  if (s.phase === "idle") return s;
  /* Scrolled away from the top, a popup opened, or the finger went up: this is not our gesture. */
  if (!env.atTop || env.blocked) return PULL_IDLE;
  const d = y - s.startY;
  if (d < 0) return PULL_IDLE;
  if (d <= PULL_THRESHOLD) return { phase: "armed", startY: s.startY, offset: 0 };
  return { phase: "pulling", startY: s.startY, offset: damp(d - PULL_THRESHOLD, max) };
}

export function pullEnd(): PullState {
  return PULL_IDLE;
}

/** The offset a rubber-banding browser reports as a negative scrollY, damped the same way. */
export function overscrollOffset(scrollY: number, max = PULL_MAX): number {
  return scrollY < 0 ? Math.min(max, damp(-scrollY, max)) : 0;
}

const POPUP = '[role="dialog"], [role="menu"], [role="listbox"], dialog[open], [data-radix-popper-content-wrapper]';
/** A sheet, dialog or menu is open: the page underneath is not ours to pull. */
export function popupOpen(doc: Document = document): boolean {
  return Array.from(doc.querySelectorAll(POPUP)).some((e) => !(e as HTMLElement).hidden && !e.closest("[hidden], [inert]"));
}

export type PullRevealOptions = {
  enabled: boolean;
  /** True while something else owns the screen (the nav panel, the palette); a popup in the DOM counts too. */
  isBlocked?: () => boolean;
  /** Called with the title's travel in px (0 = at rest) and whether a finger is still down. */
  onChange: (offset: number, held: boolean) => void;
};

export function usePullReveal({ enabled, isBlocked, onChange }: PullRevealOptions) {
  const cb = useRef(onChange);
  const blocked = useRef(isBlocked);
  useEffect(() => {
    cb.current = onChange;
    blocked.current = isBlocked;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let s: PullState = PULL_IDLE;
    let down = false;
    let last = 0;
    const env = (): PullEnv => ({ atTop: window.scrollY <= 0, blocked: Boolean(blocked.current?.()) || popupOpen() });
    const emit = (offset: number) => {
      if (offset === last && !down) return;
      last = offset;
      cb.current(offset, down);
    };
    const onStart = (e: TouchEvent) => {
      down = e.touches.length === 1;
      s = down ? pullStart(e.touches[0].clientY, env()) : PULL_IDLE;
    };
    const onMove = (e: TouchEvent) => {
      if (!down || e.touches.length !== 1) return;
      s = pullMove(s, e.touches[0].clientY, env());
      emit(Math.max(s.offset, overscrollOffset(window.scrollY)));
    };
    const onEnd = () => {
      down = false;
      s = pullEnd();
      emit(overscrollOffset(window.scrollY));
    };
    /* iOS rubber-band: scrollY goes negative with or without our touch tracking, and returns to 0 on its own. */
    const onScroll = () => {
      if (window.scrollY < 0 && env().blocked) return emit(0);
      if (window.scrollY > 0 && s.phase !== "idle") s = PULL_IDLE;
      emit(Math.max(s.offset, overscrollOffset(window.scrollY)));
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("scroll", onScroll);
      cb.current(0, false);
    };
  }, [enabled]);
}
