import { defineWords, type PluralForms } from "./words";

/*
 * The pages' words (#248): the home page's sections, the notes and the
 * project pages, the filters, the journey, the accessibility statement and
 * the MCP page. The chrome's own are in `chrome.ts`.
 *
 * Hebrew notes:
 * - The reader is addressed in the plural (כתבו, הקישו), which is how Hebrew
 *   addresses an unknown reader without picking a gender.
 * - "Notes" are רשימות and "Blogs" בלוגים, as in `chrome.ts`.
 * - Names of things that are names (Claude Code, GitHub, OAuth, PKCE, the
 *   tools' own identifiers) stay in Latin letters.
 */

export const useHomeWords = defineWords(
  "home",
  {
    getInTouch: "Get in touch",
    portraitAlt:
      "Yehuda Briskman: a cut-out photograph from the waist up, in round sunglasses and a pale T-shirt, a bag strap across one shoulder, looking off to the side.",
    role: "Full-stack · Technical team lead",
    work: "Work",
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    selectedWork: "Selected work",
    allProjects: "All projects",
    specs: "Specs",
    specsNote: "Counted from the work, not claimed",
    spec: { Projects: "Projects", Live: "Live", Tools: "Tools", Shipping: "Shipping" },
    years: "yrs",
    notes: "Notes",
    notesNote: "Decisions and what they cost",
    skipNotes: "Skip past the notes",
    latestNotes: "Latest notes",
    notesError: "The notes aren't loading just now. They're still there — the index has all of them.",
    notesNone: "Nothing published yet. The index is where they'll appear.",
    allNotes: "All notes",
    emptyTitle: "Nothing here yet.",
    emptyBody: "Notes go up as the work gets done. Anything filed here will appear on this page.",
    figure: "Fig.",
  },
  {
    getInTouch: "ליצירת קשר",
    portraitAlt:
      "Yehuda Briskman: תצלום גזור מהמותניים ומעלה, במשקפי שמש עגולים ובחולצת טי בהירה, רצועת תיק על כתף אחת, מביט הצידה.",
    role: "פול־סטאק · ראש צוות טכני",
    work: "עבודות",
    shownOf: (shown: number, total: number) => `${shown} מתוך ${total}`,
    selectedWork: "עבודות נבחרות",
    allProjects: "כל הפרויקטים",
    specs: "במספרים",
    specsNote: "נספר מתוך העבודה, לא נטען",
    spec: { Projects: "פרויקטים", Live: "באוויר", Tools: "כלים", Shipping: "שנות עשייה" },
    years: "שנים",
    notes: "רשימות",
    notesNote: "החלטות, ומה הן עלו",
    skipNotes: "דילוג אל אחרי הרשימות",
    latestNotes: "הרשימות האחרונות",
    notesError: "הרשימות לא נטענות כרגע. הן עדיין שם — באינדקס יש את כולן.",
    notesNone: "עדיין לא פורסם כלום. האינדקס הוא המקום שבו הן יופיעו.",
    allNotes: "כל הרשימות",
    emptyTitle: "עדיין אין כאן כלום.",
    emptyBody: "רשימות עולות תוך כדי העבודה. כל מה שיתויק כאן יופיע בעמוד הזה.",
    figure: "איור",
  },
);

export const useContactWords = defineWords(
  "contact",
  {
    fact: "Mail reaches me faster than anything else",
    note: "I’m employed full-time and not looking for freelance work. I do read everything — if you’re hiring, building something you think I’d find interesting, or want to talk about anything on this page, write to me.",
    sent: "Sent. I’ll reply to the address you gave.",
    write: "Write a message",
    writeAnother: "Write another message",
    directBefore: "Or write to",
    directAfter: "from wherever you keep your mail.",
    allThree: "All three fields are needed.",
    close: "Close",
    formLabel: "Send a message",
    name: "Name",
    email: "Email",
    message: "Message",
    sending: "Sending",
    send: "Send message",
    invalid: "Nothing was sent. There's a note under each field that needs a change.",
    failed: (reason: string, email: string) =>
      `Nothing was sent — ${reason}. Your message is still in the fields, and ${email} works too.`,
    unknownFailure: "something went wrong at my end",
    errors: {
      name: "Add your name",
      email: "That email address doesn't look right. It should look like name@example.com",
      message: "Tell me a little more, at least a sentence",
    },
  },
  {
    fact: "מייל מגיע אליי מהר יותר מכל דבר אחר",
    note: "אני מועסק במשרה מלאה ולא מחפש עבודות פרילנס. אבל אני קורא הכול — אם אתם מגייסים, בונים משהו שלדעתכם יעניין אותי, או רוצים לדבר על משהו מהעמוד הזה, כתבו לי.",
    sent: "נשלח. אענה לכתובת שמסרתם.",
    write: "כתיבת הודעה",
    writeAnother: "כתיבת הודעה נוספת",
    directBefore: "אפשר גם לכתוב ישירות אל",
    directAfter: "מכל תיבת דואר.",
    allThree: "צריך למלא את שלושת השדות.",
    close: "סגירה",
    formLabel: "שליחת הודעה",
    name: "שם",
    email: "אימייל",
    message: "הודעה",
    sending: "בשליחה",
    send: "שליחת ההודעה",
    invalid: "שום דבר לא נשלח. מתחת לכל שדה שצריך תיקון יש הערה.",
    failed: (reason: string, email: string) =>
      `שום דבר לא נשלח — ${reason}. ההודעה שלכם עדיין בשדות, ואפשר גם לכתוב אל ${email}.`,
    unknownFailure: "משהו השתבש אצלי",
    errors: {
      name: "צריך לכתוב שם",
      email: "כתובת האימייל לא נראית תקינה. היא צריכה להיראות כמו name@example.com",
      message: "כתבו קצת יותר, לפחות משפט אחד",
    },
  },
);

export const useCityWords = defineWords(
  "city",
  {
    title: "The year",
    trailing: "Trailing twelve months",
    frame: "The year, day by day. Arrow keys move between days, Home and End go to the first and last.",
    drag: "Drag to turn the city · point at a day",
    swipe: "Swipe sideways to turn · tap a day",
    reading: "Reading the year…",
    contributionsOver: (total: string, days: string) => `${total} contributions over ${days} days`,
    between: (from: string, to: string) => `, ${from} to ${to}`,
    active: (active: string) => `. ${active} of those days have something in them`,
    busiest: (date: string, count: string) => `; the busiest is ${date}, at ${count}`,
    table: "The year as a table",
    tableCaption: "Contributions by month over the trailing year, with the number of days of each month that fall inside the window.",
    month: "Month",
    days: "Days",
    contributions: "Contributions",
  },
  {
    title: "השנה",
    trailing: "שנים־עשר החודשים האחרונים",
    frame: "השנה, יום אחר יום. מקשי החיצים עוברים בין הימים, ו־Home ו־End מגיעים לראשון ולאחרון.",
    drag: "גררו כדי לסובב את העיר · הצביעו על יום",
    swipe: "החליקו הצידה כדי לסובב · הקישו על יום",
    reading: "קורא את השנה…",
    contributionsOver: (total: string, days: string) => `${total} תרומות ב־${days} ימים`,
    between: (from: string, to: string) => `, מ־${from} עד ${to}`,
    active: (active: string) => `. ב־${active} מהימים האלה יש משהו`,
    busiest: (date: string, count: string) => `; העמוס ביותר הוא ${date}, עם ${count}`,
    table: "השנה כטבלה",
    tableCaption: "תרומות לפי חודש בשנה האחרונה, עם מספר הימים מכל חודש שנכללים בחלון.",
    month: "חודש",
    days: "ימים",
    contributions: "תרומות",
  },
);

export const useNotesWords = defineWords(
  "notes",
  {
    minutes: { one: "{n} min", other: "{n} min" } as PluralForms,
    minutesRead: { one: "{n} min read", other: "{n} min read" } as PluralForms,
    more: "More notes",
    newer: "Newer",
    older: "Older",
    blogs: "Blogs",
    share: "Share",
    linkCopied: "Link copied",
    clearTag: (tag: string) => `Clear the ${tag} filter`,
    tagged: (tag: string) => `Notes tagged ${tag}`,
    note: "Note",
    tableScrolls: "Table, scrolls sideways",
    loading: "Loading the post",
    notHere: "Not here",
    missingBefore: "That post doesn’t exist, or isn’t published yet. The address may have changed when the notes moved from",
    missingMiddle: "to",
    unavailable: "Post unavailable",
    noAnswer: "The server didn’t answer.",
    noAnswerBody:
      "The page loaded; the post behind it didn’t. It is served by a small machine I run myself, so this is usually a restart rather than anything permanent.",
    retry: "Try again",
    work: "Work",
    notFound: "Not found",
    writtenInEnglish: "Written in English",
    authorRole: "Full-stack engineer & team lead",
  },
  {
    minutes: { one: "דקה", two: "2 דק׳", other: "{n} דק׳" },
    minutesRead: { one: "דקת קריאה אחת", two: "שתי דקות קריאה", other: "{n} דקות קריאה" },
    more: "רשימות נוספות",
    newer: "חדשה יותר",
    older: "ישנה יותר",
    blogs: "בלוגים",
    share: "שיתוף",
    linkCopied: "הקישור הועתק",
    clearTag: (tag: string) => `ביטול הסינון לפי ${tag}`,
    tagged: (tag: string) => `רשימות עם התגית ${tag}`,
    note: "רשימה",
    tableScrolls: "טבלה, נגללת הצידה",
    loading: "טוען את הרשימה",
    notHere: "לא כאן",
    missingBefore: "הרשימה הזאת לא קיימת, או שעדיין לא פורסמה. ייתכן שהכתובת השתנתה כשהרשימות עברו מהכתובת",
    missingMiddle: "לכתובת",
    unavailable: "הרשימה לא זמינה",
    noAnswer: "השרת לא ענה.",
    noAnswerBody:
      "העמוד נטען; הרשימה שמאחוריו לא. היא מוגשת ממחשב קטן שאני מפעיל בעצמי, כך שבדרך כלל מדובר באתחול ולא בשום דבר קבוע.",
    retry: "ניסיון חוזר",
    work: "עבודות",
    notFound: "לא נמצא",
    writtenInEnglish: "כתוב באנגלית",
    authorRole: "מהנדס פול־סטאק וראש צוות טכני",
  },
);

export const useProjectWords = defineWords(
  "projects",
  {
    source: "Source",
    decisions: "Decisions worth defending",
    skipWork: "Skip past the work",
    builtWith: "Built with",
    noYear: "Year not recorded",
    stack: "Stack",
    opensFor: (title: string) => `for ${title} (opens in a new tab)`,
    worthKnowing: "Worth knowing",
    elsewhere: "Elsewhere",
    notFound: "Not found",
  },
  {
    source: "קוד מקור",
    decisions: "החלטות שאני עומד מאחוריהן",
    skipWork: "דילוג אל אחרי העבודות",
    builtWith: "נבנה עם",
    noYear: "השנה לא נרשמה",
    stack: "טכנולוגיות",
    opensFor: (title: string) => `של ${title} (נפתח בלשונית חדשה)`,
    worthKnowing: "כדאי לדעת",
    elsewhere: "במקומות אחרים",
    notFound: "לא נמצא",
  },
);

export const useFilterWords = defineWords(
  "filters",
  {
    any: "Any",
    chosen: (n: number) => `${n} chosen`,
    active: "Active filters",
    remove: ", remove this filter",
    clearAll: "Clear all",
    filter: "Filter",
    filterOn: (n: number) => `Filter, ${n} on`,
    close: "Close",
    of: "of",
  },
  {
    any: "הכול",
    chosen: (n: number) => `${n} נבחרו`,
    active: "מסננים פעילים",
    remove: ", הסרת המסנן",
    clearAll: "ניקוי הכול",
    filter: "סינון",
    filterOn: (n: number) => `סינון, ${n} פעילים`,
    close: "סגירה",
    of: "מתוך",
  },
);

export const useStoryWords = defineWords(
  "story",
  {
    eyebrow: "Journey",
    title: "The long way round",
    timeline: "Timeline",
    soFar: "So far",
    allWork: "All the work, without the years",
    figures: { "Anyone can open": "Anyone can open", "In a store": "In a store", Years: "Years" } as Record<string, string>,
  },
  {
    eyebrow: "המסע",
    title: "הדרך הארוכה",
    timeline: "ציר זמן",
    soFar: "עד כה",
    allWork: "כל העבודות, בלי השנים",
    figures: { "Anyone can open": "פתוחים לכל אחד", "In a store": "בחנות אפליקציות", Years: "שנים" },
  },
);

export const useAdminShellWords = defineWords(
  "admin-shell",
  {
    skip: "Skip to content",
    admin: "admin",
    sections: "Admin sections",
    publicSite: "View public site",
    signOut: "Sign out",
    back: "Back",
    site: "Site",
  },
  {
    skip: "דילוג לתוכן",
    admin: "ניהול",
    sections: "אזורי הניהול",
    publicSite: "לאתר הציבורי",
    signOut: "התנתקות",
    back: "חזרה",
    site: "אתר",
  },
);
