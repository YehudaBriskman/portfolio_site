import { useEffect } from "react";

/*
 * How tall a loading placeholder should be.
 *
 * A placeholder a screen tall keeps the footer out of view until the real
 * page arrives (no layout shift), but Back and Forward restore a scroll
 * position only once the document is tall enough to reach it. A placeholder of
 * one screen cannot reach 3000px, so the restore gave up and the reader landed
 * somewhere else. So the page remembers how tall it was the last time it was
 * whole, per route, and the placeholder holds that height; the first visit,
 * which has nothing to restore, holds a screen.
 *
 * sessionStorage, because it is a per-tab convenience: it may be missing or
 * throw, and the page must work without it.
 */
const PREFIX = "held-height:";

function read(key: string): number {
  try {
    const n = Number(sessionStorage.getItem(PREFIX + key));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20000) : 0;
  } catch {
    return 0;
  }
}

/** A CSS `min-height` for the placeholder of the page `key`. */
export function heldHeight(key: string): string {
  const px = read(key);
  return px ? `max(100svh, ${px}px)` : "100svh";
}

/** While `ready`, keep the document's height on record under `key`. */
export function useRememberHeight(key: string, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        sessionStorage.setItem(PREFIX + key, String(document.documentElement.scrollHeight));
      } catch {
        /* Private mode or blocked storage: the placeholder falls back to a screen. */
      }
    };
    save();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(save);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [key, ready]);
}
