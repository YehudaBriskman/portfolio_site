import { defineWords } from "@/i18n/words";

/*
 * The words the content editors add on a phone: the language switch, the
 * field groups, Reorder mode, the search over site copy, and the leave
 * warning. The desktop form keeps its own (English) labels; these are only
 * drawn under 600px, and read from the document's language like every table.
 * The Hebrew is a first draft for the owner's review.
 */
export const useContentWords = defineWords(
  "contentEditor",
  {
    lang: { label: "Language", en: "English", he: "Hebrew", hiddenError: (lang: string, message: string) => `${lang}: ${message}` },
    group: {
      basics: "Basics",
      links: "Links",
      media: "Media",
      details: "Details",
      attention: (n: number) => (n === 1 ? "1 field needs attention" : `${n} fields need attention`),
    },
    reorder: {
      start: "Reorder",
      done: "Done",
      up: (name: string) => `Move ${name} up`,
      down: (name: string) => `Move ${name} down`,
      remove: (name: string) => `Remove ${name}`,
      moved: (name: string, place: number, of: number) => `${name} moved to position ${place} of ${of}`,
      removed: (name: string) => `${name} removed`,
      undo: "Undo",
      edit: (name: string) => `Edit ${name}`,
      showAll: (n: number) => `Show all ${n} projects`,
      showFewer: "Show fewer",
      editing: "Editing",
      list: "Order on the site",
    },
    search: {
      label: "Search site copy",
      clear: "Clear search",
      none: "No group matches",
      found: (n: number) => (n === 1 ? "1 group found" : `${n} groups found`),
    },
    leaveConfirm: "You have changes that are not saved yet. Leave anyway?",
    frame: {
      builtIn: "The site is showing the built-in content. Publish, or seed the store, to start editing it here.",
      draft: (saved: string, published: string) => `A draft is waiting, saved ${saved}. The site still shows what was published ${published}.`,
      live: (published: string) => `Live as published ${published}.`,
      saveDraft: "Save draft",
      publish: "Publish",
      preview: "Preview",
      discard: "Discard draft",
      seed: "Seed the store",
      reload: "Reload",
      problems: "Problems",
    },
  },
  {
    lang: { label: "שפה", en: "אנגלית", he: "עברית", hiddenError: (lang: string, message: string) => `${lang}: ${message}` },
    group: {
      basics: "בסיס",
      links: "קישורים",
      media: "מדיה",
      details: "פרטים",
      attention: (n: number) => (n === 1 ? "שדה אחד דורש תשומת לב" : `${n} שדות דורשים תשומת לב`),
    },
    reorder: {
      start: "סידור",
      done: "סיום",
      up: (name: string) => `הזז את ${name} למעלה`,
      down: (name: string) => `הזז את ${name} למטה`,
      remove: (name: string) => `הסר את ${name}`,
      moved: (name: string, place: number, of: number) => `${name} הוזז למקום ${place} מתוך ${of}`,
      removed: (name: string) => `${name} הוסר`,
      undo: "ביטול",
      edit: (name: string) => `עריכת ${name}`,
      showAll: (n: number) => `הצגת כל ${n} הפרויקטים`,
      showFewer: "הצגת פחות",
      editing: "בעריכה",
      list: "סדר באתר",
    },
    search: {
      label: "חיפוש בטקסטי האתר",
      clear: "ניקוי החיפוש",
      none: "אין קבוצה תואמת",
      found: (n: number) => (n === 1 ? "נמצאה קבוצה אחת" : `נמצאו ${n} קבוצות`),
    },
    leaveConfirm: "יש שינויים שעוד לא נשמרו. לצאת בכל זאת?",
    frame: {
      builtIn: "האתר מציג את התוכן המובנה. פרסמו, או אכלסו את המאגר, כדי להתחיל לערוך אותו כאן.",
      draft: (saved: string, published: string) => `יש טיוטה ממתינה, נשמרה: ${saved}. האתר עדיין מציג את מה שפורסם: ${published}.`,
      live: (published: string) => `הגרסה הפעילה פורסמה: ${published}.`,
      saveDraft: "שמירת טיוטה",
      publish: "פרסום",
      preview: "תצוגה מקדימה",
      discard: "מחיקת טיוטה",
      seed: "אכלוס המאגר",
      reload: "טעינה מחדש",
      problems: "בעיות",
    },
  },
);
