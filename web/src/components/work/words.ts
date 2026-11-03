import { useLang, type Lang } from "@/components/dashboard/i18n";

/*
 * Work's own words (#227), in both languages, beside the dashboard's
 * (`dashboard/i18n.ts`) rather than inside it: #225 and #226 are adding to
 * that table at the same time, and three branches appending to one object
 * is three merge conflicts for nothing. The language store is the
 * dashboard's, so this page switches with the others.
 *
 * Project names, taglines and descriptions come out of CouchDB and the seed
 * table in English and are left as written; only the chrome is here.
 */

const EN = {
  title: "Work",
  lede: "Everything I’ve built, pinned first. Open a project for the decisions behind it, its notes, its releases and its docs.",
  browse: "Browse the work",
  pinned: "Pinned",
  pinnedHint: "In use now",
  projects: "Projects",
  areas: "Areas with notes",
  findArea: "Find an area",
  sortBy: "Sort by",
  sort: { updated: "Recently updated", newest: "Newest", name: "Name" },
  releases: "Latest releases",
  noReleases: "No project has published a release yet.",
  updated: (when: string) => `Updated ${when}`,
  notesLink: "Notes",
  notesLinkFor: (name: string) => `Notes on ${name}`,
  stars: (n: string) => `${n} stars`,
  forks: (n: string) => `${n} forks`,
  release: "Latest release",
  strip: "Recent pushes and releases",
  stripEmpty: "No pushes or releases in the last year",
  pushed: "Pushed",
  released: (tag: string) => `Released ${tag}`,
  ofProjects: (shown: number, total: number) => `${shown} of ${total} projects`,
  noMatch: "No project matches these filters.",
  noMatchBody: "Take a filter off, or start again from the whole list.",
  clear: "Show every project",
  liveFailed: "The live index isn’t answering, so stars, pushes and releases may be missing. Every project is still listed.",
  noun: (n: number): string => (n === 1 ? "project" : "projects"),
  facet: { state: "State", year: "Year", stack: "Stack" },
  /* The project page. */
  backToWork: "Work",
  tabs: "Project sections",
  tab: { overview: "Overview", notes: "Notes", releases: "Releases", docs: "Docs" },
  areaHistory: "Open the area’s full history",
  noNotes: "Nothing written about this one yet.",
  noNotesLive: "Notes are filed by area, and this project’s area has none yet.",
  releasesFrom: "Releases, newest first, from the repository.",
  noReleasesHere: "No releases published for this project.",
  releasesFailed: "The releases couldn’t be loaded.",
  noDocs: "No docs are published from this repository.",
  docsFrom: "Pages published from the repository’s own docs.",
  retry: "Try again",
  onGitHub: "View on GitHub",
  latest: "Latest",
  /* The project page on the dashboard (#242). */
  allWork: "All work",
  projectNav: "Projects",
  about: "About",
  source: "Source",
  areaNotes: "Notes in this area",
  repository: "Repository",
  feed: "The area’s RSS feed",
  releasesOnGitHub: "Releases on GitHub",
  loadingProject: "Loading project",
  notHere: "Not here",
  notHereBody: "No project at that address.",
  seeEverything: "See everything",
};

export type WorkWords = typeof EN;

const HE: WorkWords = {
  title: "עבודות",
  lede: "כל מה שבניתי, המוצמדים קודם. פתחו פרויקט כדי לראות את ההחלטות שמאחוריו, את הרשימות, הגרסאות והתיעוד.",
  browse: "עיון בעבודות",
  pinned: "מוצמדים",
  pinnedHint: "בשימוש עכשיו",
  projects: "פרויקטים",
  areas: "תחומים עם רשימות",
  findArea: "חיפוש תחום",
  sortBy: "מיון לפי",
  sort: { updated: "עודכנו לאחרונה", newest: "החדשים", name: "שם" },
  releases: "גרסאות אחרונות",
  noReleases: "אף פרויקט עוד לא פרסם גרסה.",
  updated: (when: string) => `עודכן ${when}`,
  notesLink: "רשימות",
  notesLinkFor: (name: string) => `רשימות על ${name}`,
  stars: (n: string) => `${n} כוכבים`,
  forks: (n: string) => `${n} מזלגות`,
  release: "גרסה אחרונה",
  strip: "עדכוני קוד וגרסאות אחרונים",
  stripEmpty: "אין עדכוני קוד או גרסאות בשנה האחרונה",
  pushed: "עדכון קוד",
  released: (tag: string) => `גרסה ${tag}`,
  ofProjects: (shown: number, total: number) => `${shown} מתוך ${total} פרויקטים`,
  noMatch: "אין פרויקט שמתאים לסינון.",
  noMatchBody: "הסירו מסנן, או התחילו מחדש מהרשימה המלאה.",
  clear: "כל הפרויקטים",
  liveFailed: "האינדקס החי לא עונה, כך שכוכבים, עדכונים וגרסאות עשויים לחסור. כל הפרויקטים עדיין מופיעים.",
  noun: () => "פרויקטים",
  facet: { state: "מצב", year: "שנה", stack: "טכנולוגיה" },
  backToWork: "עבודות",
  tabs: "חלקי הפרויקט",
  tab: { overview: "סקירה", notes: "רשימות", releases: "גרסאות", docs: "תיעוד" },
  areaHistory: "להיסטוריה המלאה של התחום",
  noNotes: "עוד לא נכתב כלום על הפרויקט הזה.",
  noNotesLive: "הרשימות מתויקות לפי תחום, ובתחום של הפרויקט הזה עוד אין.",
  releasesFrom: "גרסאות, מהחדשה, מתוך המאגר.",
  noReleasesHere: "לא פורסמו גרסאות לפרויקט הזה.",
  releasesFailed: "לא ניתן לטעון את הגרסאות.",
  noDocs: "לא מתפרסם תיעוד מהמאגר הזה.",
  docsFrom: "עמודים שמתפרסמים מתוך התיעוד של המאגר.",
  retry: "לנסות שוב",
  onGitHub: "ב־GitHub",
  latest: "אחרונה",
  allWork: "כל העבודות",
  projectNav: "פרויקטים",
  about: "אודות",
  source: "קוד מקור",
  areaNotes: "רשימות בתחום הזה",
  repository: "מאגר",
  feed: "פיד RSS של התחום",
  releasesOnGitHub: "הגרסאות ב־GitHub",
  loadingProject: "הפרויקט נטען",
  notHere: "אין כאן כלום",
  notHereBody: "אין פרויקט בכתובת הזאת.",
  seeEverything: "לכל העבודות",
};

export const WORK_WORDS: Record<Lang, WorkWords> = { en: EN, he: HE };

/*
 * The status pill's word. The four states the owner named are translated;
 * a release tag standing in for a state (`useProjects` does that for a
 * collection with no seed) becomes "Released", because the tag itself is
 * already on the card's facts row and a datum is said once. Anything else is
 * printed as written.
 */
const STATE_WORDS: Record<Lang, Record<string, string>> = {
  en: { released: "Released" },
  he: { live: "באוויר", "in use": "בשימוש", archive: "ארכיון", "open source": "קוד פתוח", released: "פורסם" },
};

export function stateWord(state: string, lang: Lang): string {
  const key = /^v\d/i.test(state) ? "released" : state.toLowerCase();
  return STATE_WORDS[lang][key] ?? state;
}

export function useWorkWords(): [WorkWords, Lang] {
  const lang = useLang();
  return [WORK_WORDS[lang], lang];
}
