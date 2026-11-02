import { useLang, type Lang } from "@/components/dashboard/i18n";

/*
 * The area history's own words (#225), beside the dashboard's shared ones in
 * `i18n.ts` rather than inside them, so the pages being built on the same
 * shell at the same time (#226, #227) never edit the same table.
 */

const EN = {
  historyLabel: "Notes in this area, newest first",
  notesOn: (day: string) => `Notes on ${day}`,
  undated: "Undated notes",
  noteId: "Note id",
  copyLink: "Copy link",
  copyLinkTo: (title: string) => `Copy a link to “${title}”`,
  shareNote: (title: string) => `Share “${title}”`,
  share: "Share",
  openNote: (title: string) => `Open “${title}”`,
  copied: "Link copied",
  copyFailed: "Couldn’t copy. The link is in the address bar once the note is open.",
  shareOn: (where: string) => `Share on ${where}`,
  updated: "Updated",
  updatedOn: (when: string) => `Updated ${when}`,
  repo: "Repository",
  language: "Language",
  stars: "Stars",
  forks: "Forks",
  release: "Latest release",
  pushed: "Last push",
  licence: "Licence",
  asOf: (when: string) => `as of ${when}`,
  factsAsOf: (when: string) => `Repository facts as of ${when}`,
  factsNoTime: "Repository facts from the last scheduled read",
  aboutArea: "About this area",
  goToProject: "Go to the project",
  viewRepo: "View the repository",
  rss: "RSS for this area",
  docs: "Published docs",
  topics: "Topics",
  topicShare: (tag: string, n: number, pct: string) => `${tag}: ${n} ${n === 1 ? "note" : "notes"}, ${pct}`,
  other: "Other",
  noTopics: "No topics yet.",
  filteredBy: "Topic",
  clearFilter: "Show every note",
  emptyArea: "No notes in this area yet.",
  emptyAreaBody: "Subscribe to the feed and the first one will find you.",
  keysHint: "move through the notes; Enter opens one.",
  shown: (n: number, total: number) => (n === total ? `${total} ${total === 1 ? "note" : "notes"}` : `${n} of ${total} notes`),
};

export type HistoryWords = typeof EN;

const HE: HistoryWords = {
  historyLabel: "הרשימות בתחום, מהחדשה",
  notesOn: (day: string) => `רשימות מ־${day}`,
  undated: "רשימות ללא תאריך",
  noteId: "מזהה רשימה",
  copyLink: "העתקת קישור",
  copyLinkTo: (title: string) => `העתקת קישור אל ”${title}“`,
  shareNote: (title: string) => `שיתוף ”${title}“`,
  share: "שיתוף",
  openNote: (title: string) => `פתיחת ”${title}“`,
  copied: "הקישור הועתק",
  copyFailed: "ההעתקה נכשלה. הקישור מופיע בשורת הכתובת כשהרשימה פתוחה.",
  shareOn: (where: string) => `שיתוף ב־${where}`,
  updated: "עודכנה",
  updatedOn: (when: string) => `עודכנה ב־${when}`,
  repo: "מאגר",
  language: "שפה",
  stars: "כוכבים",
  forks: "פיצולים",
  release: "גרסה אחרונה",
  pushed: "עדכון קוד אחרון",
  licence: "רישיון",
  asOf: (when: string) => `נכון ל־${when}`,
  factsAsOf: (when: string) => `נתוני המאגר נכונים ל־${when}`,
  factsNoTime: "נתוני המאגר מהקריאה המתוזמנת האחרונה",
  aboutArea: "על התחום",
  goToProject: "לפרויקט",
  viewRepo: "למאגר",
  rss: "RSS של התחום",
  docs: "מסמכים שפורסמו",
  topics: "נושאים",
  topicShare: (tag: string, n: number, pct: string) => `${tag}: ${n === 1 ? "רשימה אחת" : `${n} רשימות`}, ${pct}`,
  other: "אחר",
  noTopics: "עוד אין נושאים.",
  filteredBy: "נושא",
  clearFilter: "כל הרשימות",
  emptyArea: "עוד אין רשימות בתחום הזה.",
  emptyAreaBody: "אפשר להירשם לפיד, והראשונה תגיע אליך.",
  keysHint: "עוברים בין הרשימות; Enter פותח.",
  shown: (n: number, total: number) => (n === total ? (total === 1 ? "רשימה אחת" : `${total} רשימות`) : `${n} מתוך ${total} רשימות`),
};

const WORDS: Record<Lang, HistoryWords> = { en: EN, he: HE };

export function useHistoryWords(): [HistoryWords, Lang] {
  const lang = useLang();
  return [WORDS[lang], lang];
}
