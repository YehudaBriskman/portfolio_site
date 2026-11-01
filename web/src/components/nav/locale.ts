import { useEffect, useState } from "react";

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
 * The one place the document is told what language it is in.
 *
 * `lang` and `dir` on <html> are not bookkeeping here. `lang` is what selects
 * the type system: index.css re-points --font-display, --font-text and
 * --font-data under `:root:lang(he)`, so this single assignment switches all
 * three faces and nothing else in the tree hears about it. `dir` switches the
 * reading direction, which the layout already expresses in logical properties.
 *
 * There is still no translation layer — every string is written in English in
 * the component that renders it, and the notes and project copy come out of
 * CouchDB in English. Setting `lang` to `he` over English prose is not a
 * half-measure, it is a wrong answer: it tells a screen reader to pronounce
 * English with Hebrew phonetics, and tells a translation tool the page is
 * already in the language it is being asked for. So the second locale is
 * listed and disabled.
 *
 * What is left to do when the strings exist is therefore one line — flip
 * `available: true` above — plus whatever provides the strings. The font
 * switch, the direction switch and this function are already finished, and
 * deliberately so: a type system that needed a second pass to reach its other
 * half would be a type system with an untested half.
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
  /*
   * Applied on mount as well as on change, so the document cannot disagree
   * with the state it is supposed to be rendering. index.html ships
   * `lang="en" dir="ltr"` for the first paint — the stylesheet needs an
   * answer before React exists — and this is what keeps that static answer
   * honest if the default ever moves.
   */
  useEffect(() => {
    applyLocale(code);
  }, [code]);
  const select = (next: LocaleCode) => {
    setCode(next);
    applyLocale(next);
  };
  return [code, select];
}
