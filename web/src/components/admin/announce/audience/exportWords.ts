import { defineWords } from "@/i18n/words";

/* Data-access export on the Audience tab. Hebrew follows the glossary. */
export const useExportWords = defineWords(
  "adminExport",
  {
    heading: "Export everything about an address",
    hint: "One JSON file with everything held about this address: the contact record, consent history, the never-mail line and which campaigns it was sent. Nothing is logged except that an export happened.",
    label: "Address",
    run: "Export",
    busy: "Exporting…",
    none: "Nothing is held about this address.",
    failed: "The export failed. Try again.",
  },
  {
    heading: "ייצוא כל המידע על כתובת",
    hint: "קובץ JSON אחד עם כל מה שנשמר על הכתובת: רשומת איש הקשר, היסטוריית ההסכמה, השורה ברשימת האסורים לדיוור והקמפיינים שנשלחו אליה. דבר לא נרשם ביומן מלבד עצם הייצוא.",
    label: "כתובת",
    run: "ייצוא",
    busy: "מייצא…",
    none: "לא נשמר מידע על הכתובת הזאת.",
    failed: "הייצוא נכשל. נסו שוב.",
  },
);
