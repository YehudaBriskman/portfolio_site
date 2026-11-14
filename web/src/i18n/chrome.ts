import { defineWords } from "./words";

/*
 * The chrome's words: the bar, the menus, the skip link, the footer and the
 * pages every route can land on (404). Hebrew notes:
 *
 * - Buttons and menu items are nouns of action (סגירה, החלפת שפה), the
 *   register Hebrew interfaces use, rather than imperatives.
 * - בית, מסלול מקצועי, פרויקטים, בלוג follow `nav/navRoutes.ts`, which explains each.
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
    displaySettings: "Display settings",
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
    elsewhere: "ברשת",
    controls: "תצוגה",
    displaySettings: "הגדרות תצוגה",
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
    pauseMotion: "השהיית תנועה",
    motionPaused: "התנועה מושהית. לחיצה להפעלה",
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
    privacy: "privacy",
    help: "help",
    admin: "admin",
    adminName: "Admin",
  },
  {
    pages: "עמודים",
    home: "בית",
    journey: "מסלול מקצועי",
    work: "פרויקטים",
    blogs: "בלוג",
    mcp: "שרת MCP",
    elsewhere: "ברשת",
    email: "אימייל",
    colophon: "על האתר",
    accessibility: "הצהרת נגישות",
    privacy: "פרטיות",
    help: "עזרה",
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
    title: "הדף לא נמצא",
    body: "מה שהיה בכתובת הזאת עבר למקום אחר, או שמעולם לא היה.",
    home: "בית",
    projects: "פרויקטים",
    notes: "רשימות",
  },
);

/*
 * The names a route is announced and titled by (`lib/pageTitle.ts`). The
 * document title ends with the name in the page's language, Latin in English
 * and the owner's own Hebrew spelling in Hebrew (#308), as the server render
 * does (backend/src/services/seo-words.ts), so a tab and a search result
 * read the same.
 */
export const usePageNames = defineWords(
  "page-names",
  {
    home: "Home",
    homeTitle: "Yehuda Briskman · Full-stack engineer & team lead",
    siteName: "Yehuda Briskman",
    work: "Work",
    journey: "Journey",
    mcp: "MCP server",
    blogs: "Blogs",
    log: "Channel log",
    /* An area's title: "WindoM · Notes" (seo.route.ts areaTitleName). */
    notes: "Notes",
    accessibility: "Accessibility",
    notFound: "Not found",
    admin: "Admin",
    posts: "Posts",
    newPost: "New post",
    editing: (name: string) => `Editing ${name}`,
    connections: "Connected apps",
    areas: "Areas",
    newArea: "New area",
    /* The rest of the admin's pages (#288), named as its nav names them. */
    overview: "Overview",
    adminProjects: "Projects",
    adminStory: "Story",
    siteCopy: "Site copy",
    media: "Media",
    settings: "Settings",
  },
  {
    home: "בית",
    homeTitle: "יהודה בריסקמן (Yehuda Briskman) · מהנדס פול־סטאק וראש צוות טכני",
    siteName: "יהודה בריסקמן",
    work: "פרויקטים",
    journey: "מסלול מקצועי",
    mcp: "שרת MCP",
    blogs: "בלוג",
    log: "יומן פעילות",
    notes: "רשימות",
    accessibility: "נגישות",
    notFound: "לא נמצא",
    admin: "ניהול",
    posts: "רשימות",
    newPost: "רשימה חדשה",
    editing: (name: string) => `עריכה: ${name}`,
    connections: "אפליקציות מחוברות",
    areas: "תחומים",
    newArea: "תחום חדש",
    overview: "סקירה",
    adminProjects: "פרויקטים",
    adminStory: "הסיפור",
    siteCopy: "טקסטים באתר",
    media: "מדיה",
    settings: "הגדרות",
  },
);
