import { useLang, type Lang } from "@/components/dashboard/i18n";

/*
 * The note reader's own words (#249), in both languages, beside the
 * dashboard's and Work's tables rather than inside either: the same reason
 * `work/words.ts` gives (parallel branches appending to one object is a merge
 * conflict for nothing). The language store is the dashboard's, so the reader
 * switches with the rest of the site.
 *
 * Only chrome is here. A note's title and body are the author's and are left
 * as written; dates and counts go through `Intl`.
 */

const EN = {
  contents: "Contents",
  onThisPage: "On this page",
  details: "About this note",
  contentsAndDetails: "Contents and details",
  close: "Close",
  area: "Area",
  project: "Project",
  published: "Published",
  updated: "Updated",
  updatedTitle: (when: string) => `Updated ${when}`,
  whatChanged: "What changed",
  readTime: (n: number) => `${n} min read`,
  tags: "Tags",
  share: "Share",
  linkCopied: "Link copied",
  edit: "Edit",
  editNote: "Edit this note",
  reading: "Reading",
  textSize: "Text size",
  smaller: "Smaller text",
  larger: "Larger text",
  width: "Line length",
  narrow: "Narrow",
  wide: "Wide",
  reset: "Reset",
  sizeNow: (pct: string) => `Text at ${pct}`,
  /* The picture view */
  picture: "Picture",
  diagram: "Diagram",
  openPicture: (alt: string) => (alt ? `Open the picture: ${alt}` : "Open the picture"),
  openDiagram: (alt: string) => (alt ? `Open the diagram: ${alt}` : "Open the diagram"),
  viewer: "Picture view",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Fit to screen",
  zoomLevel: (pct: string) => `Zoom ${pct}`,
  previous: "Previous picture",
  next: "Next picture",
  ofCount: (i: number, n: number) => `${i} of ${n}`,
  viewerHint: "Arrow keys move between pictures, + and − zoom, drag to pan, Escape closes.",
  /* Code */
  copyCode: "Copy the code",
  codeCopied: "Code copied",
  codeIn: (lang: string) => `Code, ${lang}`,
  plain: "text",
  table: "Table, scrolls sideways",
  /* Links */
  external: "(opens on another site)",
  kindNote: "Note",
  kindArea: "Area",
  kindProject: "Project",
  missingLink: "No note by that name yet",
  /* The page */
  back: "Blogs",
  note: "Note",
  work: "Work",
  loading: "Loading the post",
  notHere: "Not here",
  notHereBody: "That post doesn’t exist, or isn’t published yet. The address may have changed when the notes moved from /notes to /blog.",
  unavailable: "Post unavailable",
  noAnswer: "The server didn’t answer.",
  noAnswerBody: "The page loaded; the post behind it didn’t. It is served by a small machine I run myself, so this is usually a restart rather than anything permanent.",
  tryAgain: "Try again",
};

export type ReaderWords = typeof EN;

const HE: ReaderWords = {
  contents: "תוכן העניינים",
  onThisPage: "בעמוד הזה",
  details: "על הרשימה",
  contentsAndDetails: "תוכן העניינים ופרטים",
  close: "סגירה",
  area: "תחום",
  project: "פרויקט",
  published: "פורסם",
  updated: "עודכן",
  updatedTitle: (when) => `עודכן ${when}`,
  whatChanged: "מה השתנה",
  /* Hebrew counts one, two and the rest differently (#248). */
  readTime: (n) => (n === 1 ? "דקת קריאה אחת" : n === 2 ? "שתי דקות קריאה" : `${n} דקות קריאה`),
  tags: "תגיות",
  share: "שיתוף",
  linkCopied: "הקישור הועתק",
  edit: "עריכה",
  editNote: "עריכת הרשימה",
  reading: "קריאה",
  textSize: "גודל טקסט",
  smaller: "טקסט קטן יותר",
  larger: "טקסט גדול יותר",
  width: "אורך שורה",
  narrow: "צר",
  wide: "רחב",
  reset: "איפוס",
  sizeNow: (pct) => `גודל טקסט: ${pct}`,
  picture: "תמונה",
  diagram: "תרשים",
  openPicture: (alt) => (alt ? `פתיחת התמונה: ${alt}` : "פתיחת התמונה"),
  openDiagram: (alt) => (alt ? `פתיחת התרשים: ${alt}` : "פתיחת התרשים"),
  viewer: "תצוגת תמונה",
  zoomIn: "הגדלה",
  zoomOut: "הקטנה",
  zoomReset: "התאמה למסך",
  zoomLevel: (pct) => `זום ${pct}`,
  previous: "התמונה הקודמת",
  next: "התמונה הבאה",
  ofCount: (i, n) => `${i} מתוך ${n}`,
  viewerHint: "החצים עוברים בין תמונות, + ו־− מגדילים ומקטינים, גרירה מזיזה, Escape סוגר.",
  copyCode: "העתקת הקוד",
  codeCopied: "הקוד הועתק",
  codeIn: (lang) => `קוד, ${lang}`,
  plain: "טקסט",
  table: "טבלה, נגללת הצידה",
  external: "(נפתח באתר אחר)",
  kindNote: "רשימה",
  kindArea: "תחום",
  kindProject: "פרויקט",
  missingLink: "עדיין אין רשימה בשם הזה",
  back: "בלוג",
  note: "רשימה",
  work: "פרויקטים",
  loading: "הרשימה נטענת…",
  notHere: "הרשימה לא נמצאה",
  notHereBody: "הרשימה הזאת לא קיימת, או שעדיין לא פורסמה. ייתכן שהכתובת השתנתה כשהרשימות עברו מ־/notes ל־/blog.",
  unavailable: "הרשימה לא זמינה",
  noAnswer: "השרת לא ענה.",
  noAnswerBody: "העמוד נטען; הרשימה שמאחוריו לא. היא מוגשת משרת קטן שאני מפעיל בעצמי, ולרוב מדובר בהפעלה מחדש ולא בתקלה קבועה.",
  tryAgain: "ניסיון חוזר",
};

export const READER_WORDS: Record<Lang, ReaderWords> = { en: EN, he: HE };

export function useReaderWords(): [ReaderWords, Lang] {
  const lang = useLang();
  return [READER_WORDS[lang], lang];
}
