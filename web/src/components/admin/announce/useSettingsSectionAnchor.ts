import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/*
 * The sidebar's Settings sub-items (#852) link to `?tab=settings&section=<id>`. On a phone the panel already
 * opens that group; on a desktop the form is one page, so this brings the section into view: it opens the
 * closed <details> the section sits in (Advanced, and a section's own expander) and scrolls to it. The ids
 * are the phone's group ids (SettingsPhone); `data-section` marks the Everyday rows, the rest are found by
 * the test ids their sections already carry.
 */

/** The sections that live inside the Advanced expander. */
export const ADVANCED_SECTIONS = ["sender", "limits", "texts", "notices", "advanced"] as const;
export const inAdvanced = (section: string | null): boolean => ADVANCED_SECTIONS.includes(section as never);

const SELECTOR: Record<string, string> = {
  mail: '[data-section="mail"]',
  channels: '[data-section="channels"]',
  wording: '[data-section="wording"]',
  signature: '[data-testid="signature-image"]',
  sender: '[data-testid="sender-section"]',
  limits: '[data-testid="sec-limits"]',
  texts: '[data-testid="sec-texts"]',
  notices: '[data-testid="notify-section"]',
  advanced: '[data-testid="advanced"]',
};

/** `section` is the address's value on a desktop (null on a phone); `ready` once the form has rendered. */
export function useSettingsSectionAnchor(section: string | null, ready: boolean) {
  /* A new history entry (the same link pressed again) scrolls again. */
  const { key } = useLocation();
  useEffect(() => {
    if (!section || !ready) return;
    const el = document.querySelector<HTMLElement>(SELECTOR[section] ?? "");
    if (!el) return;
    for (let d: HTMLDetailsElement | null | undefined = el.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
    el.scrollIntoView?.({ block: "start" });
  }, [section, ready, key]);
}
