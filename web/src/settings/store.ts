import { useSyncExternalStore } from "react";
import { z } from "zod";
import { setSiteThemeDefault } from "@/lib/theme";
import { applyAccent } from "./accents";
import { DEFAULT_SETTINGS, SiteSettingsSchema, type SiteSettings } from "./schema";

/*
 * The site's settings, read once at boot (#254).
 *
 * Like the content store: the page renders from DEFAULT_SETTINGS — the site
 * as it was built — from the first frame, and `loadSettings()` swaps in what
 * /api/settings serves once it answers. A dead API, a body that fails the
 * schema, or an empty store all leave the defaults in place, so the page
 * renders exactly as it did before settings existed.
 *
 * The visual settings normally arrive before this does, in the metas the
 * API's render writes into the shell (theme-boot.js reads them before first
 * paint). Applying them again here only matters where the shell was not
 * rendered by the API (the dev server, a static preview), and is a no-op
 * wherever it was.
 */

const Body = z.object({ settings: SiteSettingsSchema });

let current: SiteSettings = DEFAULT_SETTINGS;
let currentKey = JSON.stringify(DEFAULT_SETTINGS);
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function settingsSnapshot(): SiteSettings {
  return current;
}

/** Replaces the settings, if they differ, and tells every reader. */
export function setSettings(next: SiteSettings): void {
  const key = JSON.stringify(next);
  if (key === currentKey) return;
  current = next;
  currentKey = key;
  applyAccent(next.visuals.accent);
  setSiteThemeDefault(next.visuals.theme);
  listeners.forEach((fn) => fn());
}

/** Test seam: back to the defaults. */
export function resetSettings(): void {
  loading = null;
  setSettings(DEFAULT_SETTINGS);
}

export function loadSettings(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch("/api/settings", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const parsed = Body.safeParse(JSON.parse(await res.text()));
      if (parsed.success) setSettings(parsed.data.settings);
    } catch {
      /* The defaults are already rendered; a failed read changes nothing. */
    }
  })();
  return loading;
}

export function useSiteSettings(): SiteSettings {
  return useSyncExternalStore(subscribe, settingsSnapshot, settingsSnapshot);
}

/** The motion default a reader who has not chosen gets: the API's, else the shell's meta. */
export function siteMotionPaused(): boolean {
  if (current.visuals.motion === "paused") return true;
  if (typeof document === "undefined") return false;
  return document.querySelector('meta[name="site-motion-default"]')?.getAttribute("content") === "paused";
}
