import { defineWords } from "./words";

/*
 * The chrome's words: the bar, the menus, the skip link, the footer and the
 * pages every route can land on (404). Hebrew notes:
 *
 * - Buttons and menu items are nouns of action (סגירה, החלפת שפה), the
 *   register Hebrew interfaces use, rather than imperatives.
 * - בלוגים, עבודות, המסע follow `nav/navRoutes.ts`, which explains each.
 * - The name stays in Latin letters everywhere it is a name — the hero sets
 *   it in display type, and a Hebrew spelling is the owner's to choose.
 */
export const useChromeWords = defineWords(
  "chrome",
  {
    skip: "Skip to content",
    pages: "Pages",
    elsewhere: "Elsewhere",
    controls: "Controls",
    siteControls: "Site controls",
    menu: "Menu",
    language: "Language",
    changeLanguage: (short: string) => `${short} — change language`,
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    /* The viewer controls (#99), in the same menu as the theme. */
    systemNow: (now: string) => `System, now ${now}`,
    textSize: "Text size",
    textDefault: "Default",
    textLarge: "Large",
    textLarger: "Larger",
    contrast: "Contrast",
    contrastStandard: "Standard",
    contrastMore: "More",
    displayName: (theme: string, size: string, contrast: string) =>
      `Theme: ${theme}; text size: ${size}; contrast: ${contrast} — change display`,
    pauseMotion: "Pause motion",
    motionPaused: "Motion paused. Press to play",
    email: "Email",
    close: "Close",
  },
  {
    skip: "דילוג לתוכן",
    pages: "עמודים",
    elsewhere: "במקומות אחרים",
    controls: "הגדרות",
    siteControls: "הגדרות האתר",
    menu: "תפריט",
    language: "שפה",
    changeLanguage: (short: string) => `${short} — החלפת שפה`,
    theme: "ערכת צבעים",
    themeLight: "בהירה",
    themeDark: "כהה",
    themeSystem: "לפי המערכת",
    systemNow: (now: string) => `לפי המערכת, כרגע ${now}`,
    textSize: "גודל טקסט",
    textDefault: "רגיל",
    textLarge: "גדול",
    textLarger: "גדול יותר",
    contrast: "ניגודיות",
    contrastStandard: "רגילה",
    contrastMore: "מוגברת",
    displayName: (theme: string, size: string, contrast: string) =>
      `ערכת צבעים: ${theme}; גודל טקסט: ${size}; ניגודיות: ${contrast} — החלפה`,
    pauseMotion: "עצירת תנועה",
    motionPaused: "התנועה עצורה. לחיצה להפעלה",
    email: "אימייל",
    close: "סגירה",
  },
);

export const useFooterWords = defineWords(
  "footer",
  {
    pages: "Pages",
    home: "Home",
    journey: "Journey",
    work: "Work",
    blogs: "Blogs",
    mcp: "MCP server",
    elsewhere: "Elsewhere",
    email: "Email",
    colophon: "Colophon",
    accessibility: "accessibility",
    admin: "admin",
    adminName: "Admin",
  },
  {
    pages: "עמודים",
    home: "בית",
    journey: "המסע",
    work: "עבודות",
    blogs: "בלוגים",
    mcp: "שרת MCP",
    elsewhere: "במקומות אחרים",
    email: "אימייל",
    colophon: "על האתר",
    accessibility: "הצהרת נגישות",
    admin: "ניהול",
    adminName: "ניהול",
  },
);

export const useNotFoundWords = defineWords(
  "not-found",
  {
    eyebrow: "Error 404",
    title: "Not here",
    body: "Whatever was at this address has moved, or never existed.",
    home: "Home",
    projects: "Projects",
    notes: "Notes",
  },
  {
    eyebrow: "שגיאה 404",
    title: "לא כאן",
    body: "מה שהיה בכתובת הזאת עבר למקום אחר, או שמעולם לא היה.",
    home: "בית",
    projects: "פרויקטים",
    notes: "רשימות",
  },
);

/*
 * The names a route is announced and titled by (`lib/pageTitle.ts`). The
 * document title keeps the name in Latin letters after the separator, as the
 * server render does, so a tab and a search result read the same.
 */
export const usePageNames = defineWords(
  "page-names",
  {
    home: "Home",
    homeTitle: "Yehuda Briskman · Full-stack engineer & team lead",
    work: "Work",
    journey: "Journey",
    mcp: "MCP server",
    blogs: "Blogs",
    log: "Channel log",
    accessibility: "Accessibility",
    notFound: "Not found",
    admin: "Admin",
    posts: "Posts",
    newPost: "New post",
    editing: (name: string) => `Editing ${name}`,
    connections: "Connected apps",
    areas: "Areas",
    newArea: "New area",
  },
  {
    home: "בית",
    homeTitle: "Yehuda Briskman · מהנדס פול־סטאק וראש צוות",
    work: "עבודות",
    journey: "המסע",
    mcp: "שרת MCP",
    blogs: "בלוגים",
    log: "יומן הערוץ",
    accessibility: "נגישות",
    notFound: "לא נמצא",
    admin: "ניהול",
    posts: "רשימות",
    newPost: "רשימה חדשה",
    editing: (name: string) => `עריכה: ${name}`,
    connections: "אפליקציות מחוברות",
    areas: "תחומים",
    newArea: "תחום חדש",
  },
);
