import { useLang } from "@/components/dashboard/i18n";
import { switchLang } from "@/i18n/routing";

export type LocaleCode = "en" | "he";

export type Locale = {
  code: LocaleCode;
  /** Written in the language itself, which is how a language picker is read. */
  label: string;
  /** The two-letter form the trigger shows, so the island stays one row tall. */
  short: string;
  dir: "ltr" | "rtl";
  /** Whether there is anything to switch to. Both are, since #248. */
  available: boolean;
};

export const LOCALES: Locale[] = [
  { code: "en", label: "English", short: "EN", dir: "ltr", available: true },
  { code: "he", label: "עברית", short: "HE", dir: "rtl", available: true },
];

/** Narrows the bare string Radix hands back, rather than asserting it. */
export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((l) => l.code === value);
}

/**
 * The chosen language, and the way to change it.
 *
 * Until #248 this held the language in React state and refused to apply
 * Hebrew, because there was no translation behind it. The language now lives
 * in the address (`/he/...`, see `i18n/routing.ts`) and on `<html lang>`,
 * which is what this reads, so the two copies of the menu (the controls
 * island and the mobile sheet) cannot disagree about it.
 */
/**
 * Put keyboard focus back on the language control once the new language has
 * rendered. Choosing a language swaps the route, the menu closes with its
 * trigger remounted, and focus was left on `<body>` — a keyboard or
 * screen-reader user restarted from the top of the page (#349). The trigger is
 * where they were, and in the new language it names the language now in use.
 *
 * Polled by timer rather than by frame, and for a bounded time: the control is
 * not in the DOM until React has committed the new route, and a page that
 * never renders it must not leave a loop running. Only a visible trigger
 * counts, because the bar and the mobile sheet each carry one.
 */
export function focusLanguageControl(budgetMs = 1500): void {
  if (typeof document === "undefined") return;
  const started = Date.now();
  const tick = () => {
    const triggers = [...document.querySelectorAll<HTMLElement>("[data-language-trigger]")];
    const el = triggers.find((t) => t.offsetParent !== null || t.getClientRects().length > 0);
    if (el && el.isConnected) {
      el.focus({ preventScroll: true });
      return;
    }
    if (Date.now() - started < budgetMs) setTimeout(tick, 50);
  };
  setTimeout(tick, 50);
}

export function useLocale(): [LocaleCode, (code: LocaleCode) => void] {
  return [
    useLang(),
    (code) => {
      switchLang(code);
      focusLanguageControl();
    },
  ];
}
