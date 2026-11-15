import { defineWords } from "@/i18n/words";

/*
 * The command palette's own words (Ctrl+K, A32). Its name, "New post", "New
 * area" and "Upload media" are the admin's existing words (`useAdminWords`);
 * only what the palette itself says is here.
 */
export const useCommandWords = defineWords(
  "adminCommand",
  {
    placeholder: "Go to a page or create something",
    recent: "Recent",
    create: "Create",
    go: "Go to",
    empty: "Nothing matches",
    results: (n: number) => (n === 1 ? "1 result" : `${n} results`),
  },
  {
    placeholder: "מעבר לעמוד או יצירה של משהו חדש",
    recent: "אחרונים",
    create: "יצירה",
    go: "מעבר אל",
    empty: "אין התאמות",
    results: (n: number) => (n === 1 ? "תוצאה אחת" : `${n} תוצאות`),
  },
);
