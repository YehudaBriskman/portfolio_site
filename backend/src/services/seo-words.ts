import type { Lang } from "./seo.js";

/*
 * The server render's words, in both languages (#248).
 *
 * These are the heads and the crawler fallbacks for the pages the API renders.
 * Each mirrors the page's own copy in web/src (titles match
 * web/src/lib/pageTitle.ts and web/src/i18n/chrome.ts), so a tab, a link
 * preview and a search result read the same whichever of them a client saw.
 *
 * The name is Latin in the English words and the owner's own Hebrew spelling
 * in the Hebrew ones (#308), with the Latin beside it where the site's name
 * is the subject (the home title); the page's display name stays Latin, as
 * the owner chose. The employer is never named, in either language.
 */
const EN = {
  siteTitle: "Yehuda Briskman · Full-stack engineer & team lead",
  siteDescription:
    "Full-stack engineer and team lead in Tel Aviv. I ship products end to end and build the checks that prove they still work.",
  /*
   * The share-card wording, copied from og:description in web/index.html.
   * The home page is served both ways (as the built shell when the API is
   * down and as the render when it is up), so the two heads must say the
   * same thing; seo.route.test.ts compares every og: and twitter: tag of the
   * real index.html against the English render.
   */
  siteSocial: "I ship products end to end, and build the checks that prove they work. Tel Aviv.",
  role: "full-stack engineer and team lead",
  elsewhere: "Elsewhere",
  homeProjects: "Projects: what I have built and run",
  homeNotes: "Notes: writing on frontend engineering and infrastructure",
  basedIn: (place: string) => `Based in ${place}.`,
  blogs: "Blogs",
  blogsDescription: "Writing on frontend engineering, infrastructure, and shipping products end to end.",
  blogsBody:
    "Writing on frontend engineering, infrastructure, and shipping products end to end, plus notes from each of my projects.",
  notesAlt: "Notes by Yehuda Briskman",
  work: "Work",
  workDescription: "Things I have built and run end to end, each with its own notes, documentation and source.",
  projectsAlt: "Projects by Yehuda Briskman",
  journey: "Journey",
  journeyTitle: "The long way round",
  journeyDescription:
    "The work along the years, as a timeline: when I started shipping, the projects I built and ran, and the roles in between.",
  accessibility: "Accessibility",
  statement: "Statement",
  accessibilityDescription:
    "Accessibility statement: this site aims to meet WCAG 2.2 at level AA, which includes the Israeli standard IS 5568, and how to report a barrier.",
  accessibilityBody: [
    "This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, which includes the Israeli standard IS 5568 (WCAG 2.0 at level AA). It was audited by the site's author, and that audit is not a certification by an accessibility professional.",
    "Every page works with a keyboard alone, is built from headings and landmarks a screen reader can move between, and is measured for contrast.",
  ],
  home: "Home",
  developers: "Developers",
  mcp: "MCP server",
  mcpDescription:
    "Connect Claude, or any MCP client, to this site: read the posts and project areas with no sign-in, or sign in with GitHub to manage them.",
  mcpCode: "Claude Code",
  mcpConnector: "claude.ai and Claude Desktop: add a custom connector with the URL",
  mcpPublic: "Anyone can connect and read, with no account and no sign-in:",
  mcpOwner: "Owner access, with a GitHub sign-in:",
  log: "Channel log",
  logDescription:
    "Everything that happens on the site, newest first: notes, releases, pushes, site releases and new areas.",
  logBody: "Everything that happens on the site, newest first.",
  notes: "Notes",
  notesOn: (title: string) => `Notes on ${title}.`,
  allProjects: "All projects",
  worthKnowing: "Worth knowing",
  decisions: "Decisions worth defending",
  builtWith: "Built with",
  notFound: "Not found",
  notFoundDescription: "That page does not exist.",
  writtenInEnglish: "",
};

type Words = { [K in keyof typeof EN]: (typeof EN)[K] extends (...a: infer A) => string ? (...a: A) => string : (typeof EN)[K] extends string[] ? string[] : string };

const HE: Words = {
  siteTitle: "יהודה בריסקמן (Yehuda Briskman) · מהנדס פול־סטאק וראש צוות טכני",
  siteDescription:
    "יהודה בריסקמן, מהנדס פול־סטאק וראש צוות טכני בתל אביב, עם דגש על פרונטאנד. בונה ומשיק מוצרים מקצה לקצה, יחד עם הבדיקות שמוכיחות שהם עובדים.",
  siteSocial: "אני בונה ומשיק מוצרים מקצה לקצה, יחד עם הבדיקות שמוכיחות שהם עובדים. תל אביב.",
  role: "מהנדס פול־סטאק וראש צוות טכני",
  elsewhere: "ברשת",
  homeProjects: "פרויקטים: מערכות שבניתי ותפעלתי",
  homeNotes: "רשימות: כתיבה על הנדסת פרונטאנד ותשתיות",
  basedIn: (place: string) => `מקום: ${place}.`,
  blogs: "בלוג",
  blogsDescription: "כתיבה על הנדסת פרונטאנד, תשתיות, והשקת מוצרים מקצה לקצה.",
  blogsBody: "כתיבה על הנדסת פרונטאנד, תשתיות, והשקת מוצרים מקצה לקצה, ורשימות מכל אחד מהפרויקטים שלי.",
  notesAlt: "רשימות מאת יהודה בריסקמן",
  work: "פרויקטים",
  workDescription: "מערכות שבניתי ותפעלתי מקצה לקצה, ולכל אחד הרשימות, התיעוד והקוד שלו.",
  projectsAlt: "פרויקטים מאת יהודה בריסקמן",
  journey: "מסלול מקצועי",
  journeyTitle: "שלב אחר שלב",
  journeyDescription:
    "העבודה לאורך השנים, כציר זמן: מתי התחלתי להשיק, הפרויקטים שבניתי והפעלתי, והתפקידים שביניהם.",
  accessibility: "נגישות",
  statement: "הצהרה",
  accessibilityDescription:
    "הצהרת נגישות: האתר שואף לעמוד ב־WCAG 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568, ואיך לדווח על מחסום.",
  accessibilityBody: [
    "האתר שואף לעמוד בהנחיות הנגישות לתוכן אינטרנט (WCAG) 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568 (WCAG 2.0 ברמה AA). הבדיקה נעשתה בידי כותב האתר, והיא אינה אישור של מורשה נגישות.",
    "כל עמוד עובד עם מקלדת בלבד, בנוי מכותרות ומאזורי ניווט שקורא מסך יכול לנוע ביניהם, והניגודיות בו נמדדת.",
  ],
  home: "בית",
  developers: "למפתחים",
  mcp: "שרת MCP",
  mcpDescription:
    "חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם.",
  mcpCode: "Claude Code",
  mcpConnector: "‏claude.ai ו־Claude Desktop: הוספת מחבר מותאם אישית עם הכתובת",
  mcpPublic: "כל אחד יכול להתחבר ולקרוא, בלי חשבון ובלי התחברות:",
  mcpOwner: "גישת בעל האתר, עם התחברות באמצעות GitHub:",
  log: "יומן פעילות",
  logDescription: "כל מה שקורה באתר, מהחדשה לישנה: רשימות, גרסאות, עדכוני קוד, גרסאות אתר ותחומים חדשים.",
  logBody: "כל מה שקורה באתר, מהחדשה לישנה.",
  notes: "רשימות",
  notesOn: (title: string) => `רשימות על ${title}.`,
  allProjects: "כל הפרויקטים",
  worthKnowing: "כדאי לדעת",
  decisions: "החלטות שאני עומד מאחוריהן",
  builtWith: "נבנה עם",
  notFound: "לא נמצא",
  notFoundDescription: "הדף הזה לא קיים.",
  writtenInEnglish: "הרשימה הזאת כתובה באנגלית.",
};

export const SEO_WORDS: Record<Lang, Words> = { en: EN, he: HE };
