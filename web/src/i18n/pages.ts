import { defineWords, type PluralForms } from "./words";

/*
 * The pages' words (#248): the home page's sections, the notes and the
 * project pages, the filters, the journey, the accessibility statement and
 * the MCP page. The chrome's own are in `chrome.ts`.
 *
 * Hebrew notes:
 * - The reader is addressed in the plural (כתבו, הקישו), which is how Hebrew
 *   addresses an unknown reader without picking a gender.
 * - "Notes" are רשימות and "Blogs" בלוג, as in `chrome.ts`.
 * - Names of things that are names (Claude Code, GitHub, OAuth, PKCE, the
 *   tools' own identifiers) stay in Latin letters.
 */

export const useHomeWords = defineWords(
  "home",
  {
    getInTouch: "Get in touch",
    /** The plate's second field. */
    shippingSince: (year: number) => `Shipping since ${year}`,
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
    getInTouch: "יצירת קשר",
    shippingSince: (year: number) => `בתעשייה מאז ${year}`,
    portraitAlt:
      "Yehuda Briskman: תצלום גזור מהמותניים ומעלה, במשקפי שמש עגולים ובחולצת טי בהירה, רצועת תיק על כתף אחת, מביט הצידה.",
    role: "פול־סטאק · ראש צוות טכני",
    work: "פרויקטים",
    shownOf: (shown: number, total: number) => `${shown} מתוך ${total}`,
    selectedWork: "פרויקטים נבחרים",
    allProjects: "כל הפרויקטים",
    specs: "במספרים",
    specsNote: "נגזר מהעבודה עצמה, לא מהצהרות",
    spec: { Projects: "פרויקטים", Live: "פעילים", Tools: "כלים", Shipping: "שנות ניסיון" },
    years: "שנים",
    notes: "רשימות",
    notesNote: "החלטות והמחיר שלהן",
    skipNotes: "דילוג על הרשימות",
    latestNotes: "הרשימות האחרונות",
    notesError: "הרשימות לא נטענות כרגע. הן עדיין שם — כולן זמינות בעמוד הבלוג.",
    notesNone: "עדיין לא פורסם כלום. הן יופיעו בעמוד הבלוג.",
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
    /* One full sentence per cause the reader can act on; never a status code
       or the browser's own text. */
    failed: {
      /* `details` carries `{email}`, which the form turns into a left-to-right mailto link. */
      rate: {
        title: "Message not sent, too many tries",
        short: "Too many messages were sent just now. Please wait a few minutes, then try again.",
        details: "The site is getting a lot of messages right now, so it paused new ones for a while. Wait a few minutes and press Send again. Your message is still in the fields. You can also write to {email}.",
      },
      large: {
        title: "Message not sent, too long",
        short: "Shorten the message a little and try again.",
        details: "The message is larger than the site accepts. Cut it down, or send the rest in a second message, then press Send again. Your message is still in the fields. You can also write to {email}.",
      },
      server: {
        title: "Message not sent, something went wrong",
        short: "The problem is on my side. Try again shortly.",
        details: "The site could not pass your message on. Try again in a few minutes. Your message is still in the fields. If it keeps failing, write to me directly at {email}.",
      },
      offline: {
        title: "Message not sent, check your connection",
        short: "You seem to be offline. Try again once you are back.",
        details: "Your browser could not reach the server, so nothing left your device. Check your connection and press Send again. Your message is still in the fields. You can also write to {email}.",
      },
    },
    errors: {
      name: "Add your name",
      emailEmpty: "Add your email address, so I can reply",
      email: "That email address doesn't look right. It should look like name@example.com",
      message: "Tell me a little more, at least a sentence",
      /* {over} characters past the limit, {max} the limit. */
      messageLong: "{over} characters too long. Please keep the message to {max} characters.",
    },
  },
  {
    fact: "הדרך המהירה ביותר להשיג אותי היא במייל",
    note: "אני מועסק במשרה מלאה ולא מחפש עבודות פרילנס. אבל אני קורא הכול — אם אתם מגייסים, בונים משהו שלדעתכם יעניין אותי, או רוצים לדבר על משהו מהעמוד הזה, כתבו לי.",
    sent: "נשלח. אענה לכתובת שמסרתם.",
    write: "כתיבת הודעה",
    writeAnother: "כתיבת הודעה נוספת",
    directBefore: "אפשר גם לכתוב ישירות אל",
    directAfter: "מכל תיבת דואר.",
    allThree: "יש למלא את שלושת השדות.",
    close: "סגירה",
    formLabel: "שליחת הודעה",
    name: "שם",
    email: "אימייל",
    message: "הודעה",
    sending: "בשליחה",
    send: "שליחת ההודעה",
    invalid: "ההודעה לא נשלחה. ליד כל שדה שדורש תיקון מופיעה הערה.",
    failed: {
      rate: {
        title: "ההודעה לא נשלחה, יותר מדי ניסיונות",
        short: "נשלחו יותר מדי הודעות ברגע זה. המתינו כמה דקות ונסו שוב.",
        details: "האתר מקבל כרגע הרבה הודעות, ולכן עצר הודעות חדשות לזמן מה. המתינו כמה דקות ולחצו שוב על השליחה. ההודעה עדיין בשדות. אפשר גם לכתוב אל {email}.",
      },
      large: {
        title: "ההודעה לא נשלחה, היא ארוכה מדי",
        short: "קצרו מעט את ההודעה ונסו שוב.",
        details: "ההודעה גדולה ממה שהאתר מקבל. קצרו אותה, או שלחו את המשך הדברים בהודעה נוספת, ולחצו שוב על השליחה. ההודעה עדיין בשדות. אפשר גם לכתוב אל {email}.",
      },
      server: {
        title: "ההודעה לא נשלחה, משהו השתבש",
        short: "התקלה אצלי. נסו שוב בעוד רגע.",
        details: "האתר לא הצליח להעביר את ההודעה. נסו שוב בעוד כמה דקות. ההודעה עדיין בשדות. אם זה ממשיך להיכשל, כתבו לי ישירות אל {email}.",
      },
      offline: {
        title: "ההודעה לא נשלחה, בדקו את החיבור",
        short: "נראה שאין חיבור לאינטרנט. נסו שוב כשיחזור.",
        details: "הדפדפן לא הצליח להגיע לשרת, ולכן שום דבר לא יצא מהמכשיר. בדקו את החיבור ולחצו שוב על השליחה. ההודעה עדיין בשדות. אפשר גם לכתוב אל {email}.",
      },
    },
    errors: {
      name: "יש להזין שם",
      emailEmpty: "יש להזין כתובת אימייל, כדי שאוכל לענות",
      email: "כתובת האימייל לא נראית תקינה. לדוגמה: name@example.com",
      message: "כתבו קצת יותר, לפחות משפט אחד",
      messageLong: "ההודעה ארוכה מדי ב-{over} תווים. אפשר עד {max} תווים.",
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
    title: "השנה האחרונה",
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
    blogs: "בלוג",
    share: "שיתוף",
    linkCopied: "הקישור הועתק",
    clearTag: (tag: string) => `ביטול הסינון לפי ${tag}`,
    tagged: (tag: string) => `רשימות עם התגית ${tag}`,
    note: "רשימה",
    tableScrolls: "טבלה, נגללת הצידה",
    loading: "הרשימה נטענת…",
    notHere: "הרשימה לא נמצאה",
    missingBefore: "הרשימה הזאת לא קיימת, או שעדיין לא פורסמה. ייתכן שהכתובת השתנתה כשהרשימות עברו מהכתובת",
    missingMiddle: "לכתובת",
    unavailable: "הרשימה לא זמינה",
    noAnswer: "השרת לא ענה.",
    noAnswerBody:
      "העמוד נטען; הרשימה שמאחוריו לא. היא מוגשת משרת קטן שאני מפעיל בעצמי, ולרוב מדובר בהפעלה מחדש ולא בתקלה קבועה.",
    retry: "ניסיון חוזר",
    work: "פרויקטים",
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
    skipWork: "דילוג על הפרויקטים",
    builtWith: "נבנה עם",
    noYear: "השנה לא נרשמה",
    stack: "טכנולוגיות",
    opensFor: (title: string) => `של ${title} (נפתח בלשונית חדשה)`,
    worthKnowing: "כדאי לדעת",
    elsewhere: "ברשת",
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
    search: "Search",
    filter: "Filter",
    filterOn: (n: number) => `Filter, ${n} on`,
    close: "Close",
    of: "of",
    matches: (n: number) => (n === 1 ? " match" : " matches"),
  },
  {
    any: "הכול",
    chosen: (n: number) => `${n} נבחרו`,
    active: "מסננים פעילים",
    remove: ", הסרת המסנן",
    clearAll: "ניקוי הכול",
    search: "חיפוש",
    filter: "סינון",
    filterOn: (n: number) => `סינון, ${n} פעילים`,
    close: "סגירה",
    of: "מתוך",
    matches: (n: number) => (n === 1 ? " התאמה" : " התאמות"),
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
    eyebrow: "מסלול מקצועי",
    title: "שלב אחר שלב",
    timeline: "ציר זמן",
    soFar: "עד כה",
    allWork: "כל הפרויקטים, בלי ציר הזמן",
    figures: { "Anyone can open": "פתוחים לכל אחד", "In a store": "בחנויות האפליקציות", Years: "שנים" },
  },
);
