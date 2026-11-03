import { useSyncExternalStore } from "react";
import { isThemeChoice, SITE_THEME_DEFAULT, THEME_KEY, type ThemeChoice } from "./themeDefault";

/*
 * The viewer's theme: Light, Dark or System (#247).
 *
 * `public/theme-boot.js` has already put the resolved theme on <html> before
 * the first paint; this module owns it from then on. One store for the whole
 * document rather than React state, because the control is rendered twice —
 * in the bar and in the phone's side panel — and two copies of a stored
 * preference are two chances to disagree about what the reader asked for.
 *
 * Storage is wrapped at every touch: a private window or a sandboxed frame
 * throws on `localStorage` access, and the theme must still work there for
 * the length of the visit.
 */

export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/* The browser chrome's colour, per theme: the two grounds in index.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#ECE8DC", dark: "#1C1A16" };

/** The site's default, as the page carries it, falling back to the constant. */
export function siteDefault(): ThemeChoice {
  const meta = document.querySelector('meta[name="site-theme-default"]')?.getAttribute("content");
  return isThemeChoice(meta) ? meta : SITE_THEME_DEFAULT;
}

function readStored(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemeChoice(v) ? v : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

function apply(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, prefersDark());
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== resolved) root.setAttribute("data-theme", resolved);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
  return resolved;
}

let choice: ThemeChoice | null = null;
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

function current(): ThemeChoice {
  if (choice === null) choice = readStored() ?? siteDefault();
  return choice;
}

function notify() {
  for (const l of listeners) l();
}

/* System follows the OS while the page is open, not only at load. */
function onSystemChange() {
  if (current() !== "system") return;
  apply("system");
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!media) {
    try {
      media = window.matchMedia(DARK_QUERY);
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

export function getThemeChoice(): ThemeChoice {
  return current();
}

export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Choose, remember and apply. The choice is stored as made, System included,
    so a reader who picked System keeps it if the site default changes. */
export function setThemeChoice(next: ThemeChoice) {
  choice = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* Not remembered, still applied. */
  }
  apply(next);
  notify();
}

/** Re-read storage and re-apply. For tests, and for the boot hand-over. */
export function syncTheme(): ResolvedTheme {
  choice = null;
  return apply(current());
}

export function useTheme(): {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (next: ThemeChoice) => void;
} {
  const c = useSyncExternalStore(subscribe, getThemeChoice, () => SITE_THEME_DEFAULT);
  const resolved = useSyncExternalStore(subscribe, getResolvedTheme, () => "light" as const);
  return { choice: c, resolved, setChoice: setThemeChoice };
}
