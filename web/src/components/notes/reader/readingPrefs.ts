import { useCallback, useState } from "react";

/*
 * The reader's own text size and line length (#249), borrowed from Bothy's
 * `reading.ts`: a small persisted object, clamped on the way in, applied as
 * CSS custom properties so nothing re-renders the body to change it.
 *
 * Scoped to a note's prose on purpose. A site-wide text-size control (#99)
 * would scale the root; this scales only the reading column on top of it,
 * so the two compose rather than fight.
 *
 * Per viewer and per browser, in localStorage; every access is guarded,
 * because a private window or blocked storage throws, and the page must read
 * at the house size then.
 */

export type ReadingPrefs = { scale: number; wide: boolean };

export const READING_KEY = "note-reading-v1";
export const READING_DEFAULT: ReadingPrefs = { scale: 1, wide: false };
export const SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;

export function clampScale(v: number): number {
  let best: number = SCALES[1];
  for (const s of SCALES) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

export function parsePrefs(raw: string | null): ReadingPrefs {
  if (!raw) return READING_DEFAULT;
  try {
    const v = JSON.parse(raw) as Partial<ReadingPrefs>;
    return {
      scale: typeof v.scale === "number" && Number.isFinite(v.scale) ? clampScale(v.scale) : 1,
      wide: v.wide === true,
    };
  } catch {
    return READING_DEFAULT;
  }
}

function read(): ReadingPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(READING_KEY));
  } catch {
    return READING_DEFAULT;
  }
}

export function prefsVars(p: ReadingPrefs): Record<string, string> {
  return { "--note-scale": String(p.scale), "--note-measure": p.wide ? "46rem" : "38rem" };
}

export function useReadingPrefs(): [ReadingPrefs, (next: Partial<ReadingPrefs>) => void] {
  const [prefs, setPrefs] = useState<ReadingPrefs>(() => (typeof window === "undefined" ? READING_DEFAULT : read()));
  const update = useCallback((next: Partial<ReadingPrefs>) => {
    setPrefs((prev) => {
      const merged = { ...prev, ...next, scale: clampScale(next.scale ?? prev.scale) };
      try {
        window.localStorage.setItem(READING_KEY, JSON.stringify(merged));
      } catch {
        /* storage blocked: the choice lasts for this page view */
      }
      return merged;
    });
  }, []);
  return [prefs, update];
}
