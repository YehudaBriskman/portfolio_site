import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { PUBLIC_PHONE_QUERY } from "@/lib/phoneBreakpoint";

/*
 * The page's own "Browse" behind the phone menu (#780, #808).
 *
 * Below 640px the floating circle is the one master control, and its menu is
 * the same on every page: the pages, the display and accessibility switches,
 * and the links elsewhere, all on the first screen. A page with something to
 * browse (the projects' filters, the blog's areas) adds ONE row at the top of
 * it: the page's existing Browse word, with how many filters are on. Pressing
 * it closes the menu and opens the page's own sheet (`gallery/PhoneBrowse`),
 * so the filters never crowd the navigation and one sheet is open at a time.
 *
 * The menu is mounted once above the routes (`SiteChrome`) and the page lives
 * inside the outlet, so the two meet here. The page registers its label and
 * count (a string and a number, so registering cannot loop); the row asks the
 * page to open by bumping `tick`, which the page watches.
 */

export type LocalBrowseHost = {
  label: string | null;
  count: number;
  /** Bumped each time the menu's Browse row is pressed. */
  tick: number;
  setBrowse: (label: string | null, count: number) => void;
  requestOpen: () => void;
};

const noop = () => {};
export const LocalBrowseContext = createContext<LocalBrowseHost>({ label: null, count: 0, tick: 0, setBrowse: noop, requestOpen: noop });

/** The menu's side: the label to show (null: no row), its count, and the press. */
export function useLocalBrowseHost(): LocalBrowseHost {
  return useContext(LocalBrowseContext);
}

/**
 * The page's side. While `label` is set the menu shows a Browse row carrying
 * `count`. Returns `tick`, which changes when the row is pressed: the page
 * opens its sheet when it sees a tick it has not seen.
 */
export function useLocalBrowse(label: string | null, count = 0): { tick: number } {
  const { setBrowse, tick } = useContext(LocalBrowseContext);
  useEffect(() => {
    if (!label) return;
    setBrowse(label, count);
    return () => setBrowse(null, 0);
  }, [label, count, setBrowse]);
  return { tick };
}

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const q = window.matchMedia(PUBLIC_PHONE_QUERY);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

/** Below the one public phone breakpoint (640). Mounts phone-only controls. */
export function usePublicPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(PUBLIC_PHONE_QUERY).matches,
    () => false,
  );
}
