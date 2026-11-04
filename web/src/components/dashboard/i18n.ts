import { useSyncExternalStore } from "react";

/*
 * The dashboard's words, in both languages the site lists (#224).
 *
 * The site has no translation layer yet (`nav/locale.ts` says why Hebrew is
 * listed and disabled), so the language is read from where the locale
 * control writes it: `lang` on <html>. A MutationObserver turns that
 * attribute into a store, so the chrome of a dashboard re-renders the moment
 * the language changes, and the content inside it (titles, excerpts, which
 * come out of CouchDB in English) is left as it is written.
 *
 * Only chrome is here: headings, buttons, empty and error messages, and the
 * greeting. Every date and relative time goes through `Intl`, so Hebrew gets
 * Hebrew month names and "לפני 3 ימים" without a table of its own.
 */

export type Lang = "en" | "he";

function readLang(): Lang {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang.toLowerCase().startsWith("he") ? "he" : "en";
}

function subscribe(onChange: () => void) {
  if (typeof MutationObserver === "undefined") return () => {};
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => mo.disconnect();
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => "en" as Lang);
}

/** The BCP 47 tag `Intl` is given: the language, set in Israel for Hebrew. */
export const INTL: Record<Lang, string> = { en: "en-GB", he: "he-IL" };

/* ─────────────────────────────────────────────────────────────── greeting */

export type DayPart = "morning" | "afternoon" | "evening" | "night";

/**
 * The reader's hour, from `Intl` rather than `getHours()`, so the time zone
 * is the one the reader's browser resolves and a test can pin it.
 */
export function hourOf(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? date.getHours());
  return Number.isFinite(h) ? h % 24 : 0;
}

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

const GREETING: Record<Lang, Record<DayPart, string>> = {
  en: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" },
  he: { morning: "בוקר טוב", afternoon: "צהריים טובים", evening: "ערב טוב", night: "לילה טוב" },
};

export function greeting(date: Date, lang: Lang, timeZone?: string): string {
  return GREETING[lang][dayPart(hourOf(date, timeZone))];
}

/* ─────────────────────────────────────────────────────────────── time */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365.25 * 86_400_000],
  ["month", 30.44 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 days ago" / "לפני 3 ימים". Empty for a missing or unreadable date. */
export function relative(iso: string | null | undefined, now: number, lang: Lang): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = then - now;
  const rtf = new Intl.RelativeTimeFormat(INTL[lang], { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "minute");
}

/** "2 Nov 2026" / "2 בנוב׳ 2026". */
export function shortDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(INTL[lang], { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** The full date and time, for a `title` beside a relative time. */
export function fullDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(INTL[lang], { dateStyle: "long", timeStyle: "short" }).format(d);
}

/** "November 2026", for a month heading in a feed. */
export function monthLabel(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return lang === "he" ? "ללא תאריך" : "Undated";
  return new Intl.DateTimeFormat(INTL[lang], { month: "long", year: "numeric" }).format(new Date(iso));
}

export function count(n: number, lang: Lang): string {
  return new Intl.NumberFormat(INTL[lang]).format(n);
}

/* ─────────────────────────────────────────────────────────────── words */

const EN = {
  role: "Technical team lead",
  views: "Views",
  home: "Home",
  feed: "Feed",
  topAreas: "Top areas",
  findArea: "Find an area",
  showMore: "Show more",
  showLess: "Show less",
  noAreaMatch: "No area matches.",
  filter: "Filter",
  browse: "Browse",
  close: "Close",
  backTo: "Back to the notes",
  askLabel: "Search the notes",
  askPlaceholder: "Search notes, # for a topic, @ for an area…",
  askSubmit: "Search",
  searchPlaceholder: "Title, topic or phrase…",
  askHint: "# picks a topic, @ picks an area. Enter searches.",
  suggestions: "Suggestions",
  quickTopics: "Topics",
  topPosts: "Top posts",
  viewAll: "View all",
  tree: "Browse by area",
  treeHint: "Arrow keys move, Right opens an area, Enter opens a note.",
  latest: "Latest",
  everything: "Every note",
  timeline: "Latest on the site",
  channelLog: "View full channel log",
  noEvents: "Nothing has happened on the site yet.",
  /** A push event's sentence, built here from the repository's name (#306). */
  pushedTo: (repo: string) => `Pushed to ${repo}`,
  eventsFailed: "The activity couldn’t be loaded.",
  retry: "Try again",
  notesFailedTitle: "The notes couldn’t be loaded.",
  notesFailedBody: "The writing is served by a small machine I run myself, and it isn’t answering right now. Usually that means a restart.",
  seeProjects: "See the projects",
  emptyTitle: "Nothing published yet.",
  emptyBody: "The notes go up as the work gets done. The projects are further along.",
  noMatch: "No note matches these filters.",
  clearFilters: "Clear the filters",
  sparse: "That’s every note so far.",
  showMoreNotes: "Show more notes",
  minRead: (n: number) => `${n} min read`,
  notes: (n: number) => (n === 1 ? "1 note" : `${n} notes`),
  ofNotes: (shown: number, total: number) => `${shown} of ${total} notes`,
  featured: "Featured",
  kind: {
    post: "New note",
    release: "Release",
    push: "Pushed",
    site: "Site release",
    area: "New area",
  },
  areaPage: "Area",
  areaInterim: "The full area history arrives with its own page; until then, every note filed here, newest first.",
  areaMissing: "There is no area by that name.",
  goToProject: "Go to the project",
};

export type Words = typeof EN;

const HE: Words = {
  role: "ראש צוות טכני",
  views: "תצוגות",
  home: "בית",
  feed: "פיד",
  topAreas: "תחומים מובילים",
  findArea: "חיפוש תחום",
  showMore: "הצגת עוד",
  showLess: "הצגת פחות",
  noAreaMatch: "אין תחום כזה.",
  filter: "סינון",
  browse: "עיון",
  close: "סגירה",
  backTo: "חזרה לרשימות",
  askLabel: "חיפוש ברשימות",
  askPlaceholder: "חיפוש רשימות, # לנושא, @ לתחום…",
  askSubmit: "חיפוש",
  searchPlaceholder: "כותרת, נושא או ביטוי…",
  askHint: "‏# בוחר נושא, @ בוחר תחום. Enter מחפש.",
  suggestions: "הצעות",
  quickTopics: "נושאים",
  topPosts: "רשימות מומלצות",
  viewAll: "לכל הרשימות",
  tree: "עיון לפי תחום",
  treeHint: "מקשי החיצים מנווטים, חץ שמאלה פותח תחום, Enter פותח רשימה.",
  latest: "אחרונות",
  everything: "כל הרשימות",
  timeline: "חדש באתר",
  channelLog: "יומן הפעילות המלא",
  noEvents: "עוד לא קרה כלום באתר.",
  pushedTo: (repo: string) => `עדכוני קוד ב־${repo}`,
  eventsFailed: "לא ניתן לטעון את הפעילות.",
  retry: "ניסיון חוזר",
  notesFailedTitle: "לא ניתן לטעון את הרשימות.",
  notesFailedBody: "הרשימות מוגשות משרת קטן שאני מפעיל בעצמי, והשרת לא עונה כרגע. לרוב מדובר בהפעלה מחדש ולא בתקלה קבועה.",
  seeProjects: "לפרויקטים",
  emptyTitle: "עוד לא פורסם כלום.",
  emptyBody: "הרשימות עולות ככל שהעבודה מתקדמת. בעמוד הפרויקטים יש כבר הרבה יותר.",
  noMatch: "אין רשימה שמתאימה לסינון.",
  clearFilters: "ניקוי הסינון",
  sparse: "אלה כל הרשימות עד עכשיו.",
  showMoreNotes: "עוד רשימות",
  minRead: (n: number) => `${n} דק׳ קריאה`,
  notes: (n: number) => (n === 1 ? "רשימה אחת" : `${n} רשימות`),
  ofNotes: (shown: number, total: number) => `${shown} מתוך ${total} רשימות`,
  featured: "מומלצת",
  kind: {
    post: "רשימה חדשה",
    release: "גרסה",
    push: "עדכוני קוד",
    site: "גרסת אתר",
    area: "תחום חדש",
  },
  areaPage: "תחום",
  areaInterim: "ההיסטוריה המלאה של התחום תגיע בעמוד משלה; עד אז, כל הרשימות שתויקו כאן, מהחדשה לישנה.",
  areaMissing: "אין תחום בשם הזה.",
  goToProject: "לפרויקט",
};

export const WORDS: Record<Lang, Words> = { en: EN, he: HE };

export function useWords(): [Words, Lang] {
  const lang = useLang();
  return [WORDS[lang], lang];
}
