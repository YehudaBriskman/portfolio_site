import { defineWords, plural } from "@/i18n/words";

/*
 * The desktop Translations page's own words. Statuses, types and the coverage line are shared with the phone
 * list (`adminPhone.translations`); what is here is what only the desktop list says.
 */
export const useTranslationsWords = defineWords(
  "adminTranslations",
  {
    intro: "Every field a reader sees in Hebrew, in the order they meet it. Stale Hebrew stays on the site until you update it or mark it still correct.",
    tablist: "Filter by Hebrew status",
    tabs: { missing: "Missing", stale: "Stale", draft: "Draft", done: "Done" },
    empty: {
      missing: "Every field a reader sees has Hebrew.",
      stale: "No Hebrew is behind its English.",
      draft: "No Hebrew is waiting in a draft.",
      done: "Nothing is translated yet.",
    },
    search: "Search items",
    clearSearch: "Clear search",
    visibilityAll: "Public and private",
    visibilityPrivate: "Private only",
    colItem: "Item",
    colFields: "Fields",
    colSeenOn: "Seen on",
    colHebrew: "Hebrew",
    open: "Open",
    count: (n: number, tab: string) => `${plural("en", n, { one: "{n} item", other: "{n} items" })}, ${tab}`,
    onlyShown: (what: string) => `Only ${what} are shown.`,
  },
  {
    intro: "כל שדה שהקורא רואה בעברית, לפי הסדר שבו הוא פוגש אותו. עברית שהאנגלית שלה השתנתה נשארת באתר עד שמעדכנים אותה או מסמנים שהיא עדיין נכונה.",
    tablist: "סינון לפי מצב העברית",
    tabs: { missing: "חסרה", stale: "לא עדכנית", draft: "טיוטה", done: "הושלמה" },
    empty: {
      missing: "לכל שדה שהקורא רואה יש עברית.",
      stale: "אין עברית שמפגרת אחרי האנגלית.",
      draft: "אין עברית שמחכה בטיוטה.",
      done: "עוד לא תורגם דבר.",
    },
    search: "חיפוש פריטים",
    clearSearch: "ניקוי החיפוש",
    visibilityAll: "ציבוריים ופרטיים",
    visibilityPrivate: "פרטיים בלבד",
    colItem: "פריט",
    colFields: "שדות",
    colSeenOn: "מופיע בכתובת",
    colHebrew: "עברית",
    open: "פתיחה",
    count: (n: number, tab: string) => `${plural("he", n, { one: "פריט אחד", two: "שני פריטים", other: "{n} פריטים" })}, ${tab}`,
    onlyShown: (what: string) => `מוצגים ${what} בלבד.`,
  },
);
