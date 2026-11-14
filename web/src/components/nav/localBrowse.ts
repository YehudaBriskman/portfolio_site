import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { PUBLIC_PHONE_QUERY } from "@/lib/phoneBreakpoint";

/*
 * The page's own "Browse" inside the phone menu (#780).
 *
 * Below 640px the floating circle is the one master control. Its sheet opens
 * with a local section for the page the reader is on (the blog's areas and
 * topics, the project filters) above the global links; a page with nothing to
 * browse shows only the global links. The page does not draw a Browse row or
 * button of its own on a phone.
 *
 * The menu is mounted once above the routes (`SiteChrome`) and the page lives
 * inside the outlet, so the two meet here: the menu owns an empty slot element
 * in its sheet (`LocalSection.tsx`), the page registers its Browse label and
 * portals its content into the slot. A portal keeps the page's React context,
 * state and event handlers, so the content is the page's own component, not a
 * copy. The label is a string, so registering it cannot loop; the content never
 * goes through state.
 */

export type LocalBrowseHost = {
  label: string | null;
  setLabel: (label: string | null) => void;
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
};

const noop = () => {};
export const LocalBrowseContext = createContext<LocalBrowseHost>({ label: null, setLabel: noop, slot: null, setSlot: noop });

/** The menu's side: the label to show (null: no local section) and the slot. */
export function useLocalBrowseHost(): LocalBrowseHost {
  return useContext(LocalBrowseContext);
}

/**
 * The page's side. While `label` is set the menu shows a local section with
 * that heading; the returned element is where the page portals its content
 * (null until the menu has drawn the section).
 */
export function useLocalBrowse(label: string | null): HTMLElement | null {
  const { setLabel, slot } = useContext(LocalBrowseContext);
  useEffect(() => {
    if (!label) return;
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return label ? slot : null;
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
