import { defineWords } from "./words";

/*
 * The words of the filters kit (FilterChips, FilterSheet, the restore note).
 * Hebrew follows the glossary: filter = סינון, buttons are nouns, and the
 * count sentences take the Hebrew plural forms (one, two, other). A first
 * draft for the owner's review, like `mobile.ts`.
 */
const en = (n: number) => n.toLocaleString("en-US");
const he = (n: number) => n.toLocaleString("he-IL");

export const useFiltersWords = defineWords(
  "filters",
  {
    toolbar: "Filters",
    filters: "Filters",
    filtersActive: (n: number) => `Filters, ${en(n)} active`,
    clearAll: "Clear all",
    remove: (label: string) => `Remove filter ${label}`,
    all: "All",
    results: (n: number) => (n === 1 ? "1 result" : `${en(n)} results`),
    show: (n: number) => (n === 1 ? "Show 1 result" : `Show ${en(n)} results`),
    showPlain: "Show results",
    reset: "Reset",
    selectAll: "Select all",
    selectNone: "Select none",
    searchOptions: "Search options",
    noMatch: "Nothing matches",
    from: "From",
    to: "To",
    backwards: "The start date is after the end date.",
    restored: "Filters restored",
    undo: "Undo",
    dismiss: "Dismiss",
  },
  {
    toolbar: "מסננים",
    filters: "סינון",
    filtersActive: (n: number) => (n === 1 ? "סינון, 1 פעיל" : `סינון, ${he(n)} פעילים`),
    clearAll: "ניקוי הכול",
    remove: (label: string) => `הסרת המסנן ${label}`,
    all: "הכול",
    results: (n: number) => (n === 1 ? "תוצאה אחת" : n === 2 ? "שתי תוצאות" : `${he(n)} תוצאות`),
    show: (n: number) => (n === 1 ? "הצגת תוצאה אחת" : n === 2 ? "הצגת שתי תוצאות" : `הצגת ${he(n)} תוצאות`),
    showPlain: "הצגת תוצאות",
    reset: "איפוס",
    selectAll: "בחירת הכול",
    selectNone: "ניקוי הבחירה",
    searchOptions: "חיפוש באפשרויות",
    noMatch: "אין התאמות",
    from: "מתאריך",
    to: "עד תאריך",
    backwards: "תאריך ההתחלה מאוחר מתאריך הסיום.",
    restored: "המסננים שוחזרו",
    undo: "ביטול פעולה",
    dismiss: "סגירה",
  },
);
