import { useState } from "react";

export type LocaleCode = "en" | "he";

export type Locale = {
  code: LocaleCode;
  /** Written in the language itself, which is how a language picker is read. */
  label: string;
  /** The two-letter form the trigger shows, so the island stays one row tall. */
  short: string;
  dir: "ltr" | "rtl";
  /**
   * Whether there is anything to switch to. Hebrew is listed and disabled
   * rather than hidden; see the note on `applyLocale`.
   */
  available: boolean;
};

export const LOCALES: Locale[] = [
  { code: "en", label: "English", short: "EN", dir: "ltr", available: true },
  { code: "he", label: "עברית", short: "HE", dir: "rtl", available: false },
];

const DEFAULT_LOCALE: LocaleCode = "en";

/** Narrows the bare string Radix hands back, rather than asserting it. */
export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((l) => l.code === value);
}

/*
 * A stub, and it is marked as one on purpose.
 *
 * There is no translation layer on this site yet — every string is written in
 * English in the component that renders it, and the notes and project copy
 * come out of CouchDB in English. Setting `document.documentElement.lang` to
 * `he` over English prose is not a half-measure, it is a wrong answer: it
 * tells a screen reader to pronounce English with Hebrew phonetics, and tells
 * a translation tool the page is already in the language it is being asked
 * for. So the second locale is listed and disabled, the control is real, and
 * this function is the single place that has to grow when the strings exist.
 *
 * When they do, this needs to: set `lang` and `dir` on <html>, persist the
 * choice the way the motion toggle does, and hand the code to whatever
 * provides the strings. Flipping `available: true` above is the other half.
 */
function applyLocale(code: LocaleCode): void {
  const locale = LOCALES.find((l) => l.code === code);
  if (!locale?.available) return;
  document.documentElement.lang = locale.code;
  document.documentElement.dir = locale.dir;
}

/**
 * The chosen language.
 *
 * Owned by one caller and handed down, rather than held inside the menu: the
 * menu is rendered twice — once in the controls island and once in the mobile
 * sheet — and two copies of this state would be two answers to the question
 * of what language the site is in.
 */
export function useLocale(): [LocaleCode, (code: LocaleCode) => void] {
  const [code, setCode] = useState<LocaleCode>(DEFAULT_LOCALE);
  const select = (next: LocaleCode) => {
    setCode(next);
    applyLocale(next);
  };
  return [code, select];
}
