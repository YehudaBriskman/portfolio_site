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
export function useLocale(): [LocaleCode, (code: LocaleCode) => void] {
  return [useLang(), switchLang];
}
