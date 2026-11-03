import { defineWords, plural } from "@/i18n/words";
import type { Accent, HomeSection } from "@/settings/schema";

/*
 * /admin/settings' words (#254), in both languages, through the site's
 * `defineWords` (#248). The server's validation answers are keys
 * (`settings.*`), worded here.
 */

const EN = {
  title: "Settings",
  intro:
    "What comes before what on the home page, what is shown, and the defaults a visitor gets before choosing their own. Every save is kept below and can be put back.",
  homeHeading: "Home page",
  homeHint: "The hero is always first. The sections after it, in order:",
  hero: "Hero, always first",
  sections: {
    work: "Work (dark)",
    approach: "How I work",
    city: "The year (dark)",
    notes: "Notes",
    stack: "Specs",
    contact: "Contact",
  } satisfies Record<HomeSection, string>,
  shown: "Shown",
  hidden: "Hidden",
  show: (name: string) => `Show ${name}`,
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  visualsHeading: "Visuals",
  themeLegend: "Default theme",
  themeHint: "For a visitor who has not chosen. Their own choice always wins.",
  themes: { light: "Light", dark: "Dark", system: "Follow the device" },
  motionLegend: "Default motion",
  motionHint: "Pausing is a default only. A visitor's device setting for less motion always applies.",
  motions: { on: "Moving", paused: "Paused" },
  accentLegend: "Accent",
  accentHint: "Each preset is checked for readable contrast in both themes.",
  accents: { ink: "Ink blue", pine: "Pine", plum: "Plum", rust: "Rust" } satisfies Record<Accent, string>,
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  reset: "Undo changes",
  loading: "Loading…",
  loadFailed: "The settings could not be loaded. The site is showing its defaults.",
  notAuthorised: "Sign in to the admin to change the settings.",
  conflict: "These changed elsewhere. Reload to see the newer version.",
  reload: "Reload",
  unsaved: "Unsaved changes",
  version: (n: number) => `Version ${n}`,
  builtIn: "Built-in defaults",
  current: "Current",
  historyHeading: "History",
  historyEmpty: "Nothing saved yet. The site is using its built-in defaults.",
  restore: "Put back",
  restoreLabel: (what: string) => `Put back ${what}`,
  differences: (n: number) => plural("en", n, { one: "{n} difference from now", other: "{n} differences from now" }),
  issues: {
    "settings.ledger.darkAdjacent":
      "Work and The year are both on the dark ground; shown next to each other they read as one section. Put a section between them or hide one.",
    "settings.sections.duplicate": "A section is listed twice.",
    "settings.sections.missing": "Every section must be listed once.",
  } as Record<string, string>,
  genericIssue: "This value is not allowed.",
};

type Words = typeof EN;

const HE = {
  title: "הגדרות",
  intro: "מה בא לפני מה בדף הבית, מה מוצג, וברירות המחדל שמבקר מקבל לפני שבחר בעצמו. כל שמירה נשמרת למטה ואפשר להחזיר אותה.",
  homeHeading: "דף הבית",
  homeHint: "הפתיח תמיד ראשון. האזורים שאחריו, לפי הסדר:",
  hero: "פתיח, תמיד ראשון",
  sections: {
    work: "פרויקטים (כהה)",
    approach: "איך אני עובד",
    city: "השנה (כהה)",
    notes: "רשימות",
    stack: "נתונים",
    contact: "יצירת קשר",
  },
  shown: "מוצג",
  hidden: "מוסתר",
  show: (name) => `להציג את ${name}`,
  moveUp: (name) => `להזיז את ${name} למעלה`,
  moveDown: (name) => `להזיז את ${name} למטה`,
  visualsHeading: "מראה",
  themeLegend: "ערכת צבעים כברירת מחדל",
  themeHint: "למבקר שעוד לא בחר. הבחירה שלו תמיד קובעת.",
  themes: { light: "בהירה", dark: "כהה", system: "לפי המכשיר" },
  motionLegend: "תנועה כברירת מחדל",
  motionHint: "השהיה היא ברירת מחדל בלבד. הגדרת המכשיר של המבקר להפחתת תנועה תמיד חלה.",
  motions: { on: "בתנועה", paused: "מושהית" },
  accentLegend: "צבע הדגשה",
  accentHint: "כל אפשרות נבדקה לניגודיות קריאה בשתי הערכות.",
  accents: { ink: "כחול דיו", pine: "ירוק אורן", plum: "שזיף", rust: "חלודה" },
  save: "שמירה",
  saving: "שומר…",
  saved: "נשמר",
  reset: "ביטול השינויים",
  loading: "טוען…",
  loadFailed: "לא ניתן לטעון את ההגדרות. האתר מציג את ברירות המחדל.",
  notAuthorised: "יש להתחבר לניהול כדי לשנות את ההגדרות.",
  conflict: "ההגדרות שונו במקום אחר. יש לטעון מחדש כדי לראות את הגרסה החדשה.",
  reload: "טעינה מחדש",
  unsaved: "שינויים שלא נשמרו",
  version: (n) => `גרסה ${n}`,
  builtIn: "ברירות המחדל המובנות",
  current: "נוכחית",
  historyHeading: "היסטוריה",
  historyEmpty: "עוד לא נשמר דבר. האתר משתמש בברירות המחדל המובנות.",
  restore: "להחזיר",
  restoreLabel: (what) => `להחזיר ${what}`,
  differences: (n) => plural("he", n, { one: "הבדל אחד מהנוכחית", two: "שני הבדלים מהנוכחית", other: "{n} הבדלים מהנוכחית" }),
  issues: {
    "settings.ledger.darkAdjacent":
      "הפרויקטים והשנה שניהם על הרקע הכהה; כשהם מוצגים זה ליד זה הם נקראים כאזור אחד. יש לשים אזור ביניהם או להסתיר אחד מהם.",
    "settings.sections.duplicate": "אזור מופיע פעמיים.",
    "settings.sections.missing": "כל אזור צריך להופיע פעם אחת.",
  },
  genericIssue: "הערך הזה אינו מותר.",
};

export const useSettingsWords = defineWords("admin-settings", EN, HE);

export function issueText(w: Words, message: string): string {
  return w.issues[message] ?? w.genericIssue;
}
