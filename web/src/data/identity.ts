import type { Lang } from "@/components/dashboard/i18n";

/*
 * The owner's name in the two spellings the site uses (#308).
 *
 * Latin is the display name everywhere, the owner's choice. The Hebrew
 * spelling is his own, and it is how a Hebrew search finds him: it ends the
 * Hebrew page titles, and it stands beside the Latin name in the Hebrew home
 * page's fact line. The server render applies the same rule
 * (backend/src/services/seo-entity.ts), so the two print one string.
 */
export const NAME = "Yehuda Briskman";
export const NAME_HE = "יהודה בריסקמן";

/**
 * "Yehuda Briskman — …" on a Hebrew page becomes
 * "Yehuda Briskman (יהודה בריסקמן) — …". A line that already carries the
 * Hebrew name, or never names him, is left as it is.
 */
export function withHebrewName(text: string, lang: Lang): string {
  if (lang !== "he" || text.includes(NAME_HE) || !text.includes(NAME)) return text;
  return text.replace(NAME, `${NAME} (${NAME_HE})`);
}
