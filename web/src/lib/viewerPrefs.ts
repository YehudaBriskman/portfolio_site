import { useSyncExternalStore } from "react";

/*
 * The two viewer controls that are not the theme and not the motion pause
 * (#99): text size and contrast.
 *
 * They are kept in the same shape as `lib/theme.ts`: one store for the whole
 * document, so the copy of the menu in the bar and the one in the phone's side
 * panel cannot disagree. Each is remembered in localStorage and written to
 * <html> as a data attribute that `index.css` keys off. `public/theme-boot.js`
 * writes the same two attributes before first paint, so a reader on Larger
 * text never sees one frame at the default size; a test executes that file
 * and holds it to the same answers as `resolveContrast` and the keys here.
 *
 * Text size scales the ROOT, so every `rem` on the site moves. The notes
 * reader's own size and line-length tools (`notes/reader/readingPrefs.ts`,
 * #249) scale only a note's column on top of it, by design, so the two
 * compose: this is "the whole site, bigger", that is "this column, for
 * reading". They share the words "Text size" / "גודל טקסט" on purpose.
 *
 * Contrast's "system" follows `prefers-contrast: more` and is resolved to
 * "more" or "standard" before it reaches the attribute, the way the theme's
 * System is resolved to light or dark, so `index.css` carries one block for
 * More and not a second copy inside a media query.
 */

export const TEXT_SIZES = ["default", "large", "larger"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_KEY = "yb-text-size";

export const CONTRASTS = ["system", "standard", "more"] as const;
export type ContrastChoice = (typeof CONTRASTS)[number];
export type ResolvedContrast = "standard" | "more";
export const CONTRAST_KEY = "yb-contrast";

const MORE_QUERY = "(prefers-contrast: more)";

export function isTextSize(v: unknown): v is TextSize {
  return typeof v === "string" && (TEXT_SIZES as readonly string[]).includes(v);
}

export function isContrastChoice(v: unknown): v is ContrastChoice {
  return typeof v === "string" && (CONTRASTS as readonly string[]).includes(v);
}

export function resolveContrast(choice: ContrastChoice, systemMore: boolean): ResolvedContrast {
  if (choice === "system") return systemMore ? "more" : "standard";
  return choice;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Not remembered, still applied for this visit. */
  }
}

function systemMore(): boolean {
  try {
    return window.matchMedia(MORE_QUERY).matches;
  } catch {
    return false;
  }
}

function setAttr(name: string, value: string) {
  const root = document.documentElement;
  if (root.getAttribute(name) !== value) root.setAttribute(name, value);
}

let textSize: TextSize | null = null;
let contrast: ContrastChoice | null = null;
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

function currentTextSize(): TextSize {
  if (textSize === null) {
    const v = read(TEXT_SIZE_KEY);
    textSize = isTextSize(v) ? v : "default";
  }
  return textSize;
}

function currentContrast(): ContrastChoice {
  if (contrast === null) {
    const v = read(CONTRAST_KEY);
    contrast = isContrastChoice(v) ? v : "system";
  }
  return contrast;
}

function applyContrast(): ResolvedContrast {
  const resolved = resolveContrast(currentContrast(), systemMore());
  setAttr("data-contrast", resolved);
  return resolved;
}

function notify() {
  for (const l of listeners) l();
}

function onSystemChange() {
  if (currentContrast() !== "system") return;
  applyContrast();
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!media) {
    try {
      media = window.matchMedia(MORE_QUERY);
      media.addEventListener?.("change", onSystemChange);
    } catch {
      media = null;
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && media) {
      media.removeEventListener?.("change", onSystemChange);
      media = null;
    }
  };
}

export function setTextSize(next: TextSize) {
  textSize = next;
  write(TEXT_SIZE_KEY, next);
  setAttr("data-text-size", next);
  notify();
}

export function setContrast(next: ContrastChoice) {
  contrast = next;
  write(CONTRAST_KEY, next);
  applyContrast();
  notify();
}

/** Re-read storage and re-apply both. For tests, and for the boot hand-over. */
export function syncViewerPrefs(): { textSize: TextSize; contrast: ResolvedContrast } {
  textSize = null;
  contrast = null;
  setAttr("data-text-size", currentTextSize());
  return { textSize: currentTextSize(), contrast: applyContrast() };
}

function resolvedContrast(): ResolvedContrast {
  return document.documentElement.getAttribute("data-contrast") === "more" ? "more" : "standard";
}

export function useViewerPrefs(): {
  textSize: TextSize;
  contrast: ContrastChoice;
  resolvedContrast: ResolvedContrast;
} {
  const t = useSyncExternalStore(subscribe, currentTextSize, () => "default" as TextSize);
  const c = useSyncExternalStore(subscribe, currentContrast, () => "system" as ContrastChoice);
  const r = useSyncExternalStore(subscribe, resolvedContrast, () => "standard" as ResolvedContrast);
  return { textSize: t, contrast: c, resolvedContrast: r };
}
