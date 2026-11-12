import { defineWords } from "./words";

/*
 * The two long pages: the accessibility statement and the MCP page (#248).
 *
 * A paragraph that holds a link or a strong word is split around it
 * (`before`, `after`), so the markup stays in the page and the words here.
 * The statement's Hebrew follows the wording Israeli statements use under
 * Regulation 35 (הצהרת נגישות, תקן ישראלי 5568) without claiming more than
 * the English does.
 */

export const useStatementWords = defineWords(
  "accessibility-statement",
  {
    eyebrow: "Statement",
    title: "Accessibility",
    intro: (reviewed: string) =>
      `This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, which includes the Israeli standard IS 5568 (WCAG 2.0 at level AA). It was last audited on ${reviewed}, by me, the site’s author. That audit is not a certification by an accessibility professional.`,
    inPlace: "What is in place",
    inPlaceItems: [
      "Every page works with a keyboard alone. The first key press reaches a link that skips straight to the content, and focus is always visible.",
      "Pages are built from headings and landmarks a screen reader can move between, and every image that carries meaning has a text description.",
      "Text and controls are measured for contrast against the ground they sit on, including the one dark section.",
      "The layout holds at 320 pixels wide and at 400% zoom without scrolling sideways, and survives a reader’s own line, letter and word spacing.",
      "The contact form names every field, says which one needs a change and what the change is, and announces whether the message was sent.",
      "The site is in English and Hebrew. The Hebrew pages are laid out right to left, and anything not yet translated is marked as English, so a screen reader reads it in the right voice.",
    ],
    motion: "Motion, and the Pause button",
    motionBody:
      "Parts of the site move, and they move with your scrolling: as a section comes up it settles a few pixels into place and a small circle draws itself by its heading, and both undo on the way back up. Nothing is ever drawn over the text as it arrives. Apart from a short curtain over the window while a page first loads, and replies to what you click, tap or point at, nothing moves on its own. There are two ways to stop all of it.",
    reduceMotion: "If your device is set to reduce motion, the site already honours it and nothing animates.",
    pauseBefore: "Otherwise, the",
    pauseName: "Pause motion",
    pauseAfter:
      "button in the top bar (inside the menu on a phone) stops every animation on every page, and the site remembers the choice on this device. Press it again to let things move.",
    noFlash: "Nothing on the site flashes, and no content is only available while it moves.",
    looks: "Changing how the site looks",
    looksBody:
      "The theme button in the top bar (inside the menu on a phone) opens one menu with three settings. The site remembers each one on this device, and each can be reached and changed with the keyboard: Enter or Space opens the menu, the arrow keys move, and Escape closes it.",
    looksItems: [
      ["Theme:", "Light, Dark, or System to follow your device."],
      ["Text size:", "Default, Large (about 12% bigger) or Larger (25% bigger). This is on top of your browser’s own zoom, which works as well."],
      ["Contrast:", "Standard, More, or System to follow your device’s \"increase contrast\" setting. More darkens the secondary text, the outlines and the dividers, and thickens the focus ring."],
    ] as [string, string][],
    sharing: "Sharing a page",
    sharingBody:
      "Posts, projects and a few other pages have a Share button. It is a menu you can open and move through with the keyboard (Enter or Space opens it, the arrow keys move, Escape closes it), and each item has a name a screen reader reads.",
    sharingItems: [
      "Nothing leaves this site until you choose an item. Choosing LinkedIn, Gmail, X or WhatsApp opens that service in a new tab, and the menu says so. Email opens your own mail app. Copy link and Save image stay on your device. On a phone the menu may instead open your device’s own share sheet.",
      "The site adds no scripts, pixels or cookies of those services, and does not know whether you shared.",
      "A link you share can end with two small tags, utm_source and utm_medium, which tell the page you open it from where the link came from. The site owner can turn them off.",
      "LinkedIn cannot be given text in advance, so the caption is copied for you to paste. Instagram has no way to be opened from a web page, so the picture is saved and the caption copied, and you attach the picture in the app.",
    ],
    /* DRAFT wording for the owner to approve: what the mailing list collects. */
    privacy: "Privacy: the mailing list",
    privacyIntro: "Apart from a message you send through the contact form, the only personal data this site collects on purpose is what you type into the sign-up form. It does not use cookies, analytics or tracking pixels, and no email carries one.",
    privacyItems: [
      "What is stored: your email address, your name if you gave one, the language and topics you chose, and the time and form version you agreed to.",
      "Why: only to send you the new notes and releases you chose. Nothing is sold, shared or used for anything else.",
      "Confirmation: you are added only after you open the link in the confirmation email. An unconfirmed address is deleted after a few days.",
      "Leaving: every email has an unsubscribe link, and you can change topics or language from the preferences link. After you unsubscribe, the address is kept only as a blocked entry so it is never mailed again.",
      "Deletion: write to the address below and your record is erased.",
    ],

    limits: "Known limitations",
    limitItems: [
      "Some content, notes and project write-ups among it, is not yet translated into Hebrew. On a Hebrew page it is shown in English and marked as such.",
      "Wide tables inside notes scroll sideways on a narrow screen. They can be reached and scrolled with the keyboard.",
      "The audit was checked with automated tools, a keyboard and the browser’s accessibility tree. It has not yet been checked with a screen reader on every platform.",
    ],
    report: "Reporting a problem",
    reportBefore: "If something here does not work for you, or you need it in another form, write to",
    reportOr: "or use the",
    reportForm: "contact form",
    reportAfter: ". Say which page and what happened; I will answer, and fix what can be fixed, as soon as I can.",
    updated: (reviewed: string) => `Statement last updated ${reviewed}.`,
  },
  {
    eyebrow: "הצהרה",
    title: "נגישות",
    intro: (reviewed: string) =>
      `האתר שואף לעמוד בהנחיות הנגישות לתוכן אינטרנט (WCAG) 2.2 ברמה AA, הכוללות את התקן הישראלי ת״י 5568 (WCAG 2.0 ברמה AA). הבדיקה האחרונה נערכה ב־${reviewed}, על ידיי, כותב האתר. הבדיקה הזאת אינה אישור של מורשה נגישות.`,
    inPlace: "מה כבר קיים",
    inPlaceItems: [
      "כל עמוד עובד עם מקלדת בלבד. הלחיצה הראשונה מגיעה לקישור שמדלג ישירות לתוכן, והמיקוד תמיד גלוי.",
      "העמודים בנויים מכותרות ומאזורים שקורא מסך יכול לעבור ביניהם, ולכל תמונה שנושאת משמעות יש תיאור טקסטואלי.",
      "הניגודיות של טקסט ושל פקדים נמדדת מול הרקע שעליו הם מונחים, כולל האזור הכהה היחיד.",
      "הפריסה נשמרת ברוחב 320 פיקסלים ובהגדלה של 400% בלי גלילה הצידה, ועומדת בריווח שורות, אותיות ומילים שהקורא מגדיר בעצמו.",
      "טופס יצירת הקשר נותן שם לכל שדה, אומר איזה שדה צריך תיקון ומה התיקון, ומודיע אם ההודעה נשלחה.",
      "האתר זמין באנגלית ובעברית. העמודים בעברית פרוסים מימין לשמאל, וכל מה שעדיין לא תורגם מסומן כאנגלית, כדי שקורא מסך יקרא אותו בקול הנכון.",
    ],
    motion: "תנועה, וכפתור ההשהיה",
    motionBody:
      "חלקים מהאתר זזים, והם זזים עם הגלילה: כשאזור עולה הוא מתיישב כמה פיקסלים למקומו ועיגול קטן מצייר את עצמו ליד הכותרת שלו, ושניהם מתבטלים בדרך חזרה למעלה. שום דבר לא מצויר מעל הטקסט כשהוא מגיע. מלבד מסך קצר שמכסה את החלון בזמן שעמוד נטען לראשונה, ותגובות למה שלוחצים, מקישים או מצביעים עליו, שום דבר לא זז מעצמו. יש שתי דרכים לעצור את כל זה.",
    reduceMotion: "אם המכשיר מוגדר להפחתת תנועה, האתר כבר מכבד את ההגדרה ושום דבר לא מונפש.",
    pauseBefore: "אחרת, כפתור",
    pauseName: "השהיית תנועה",
    pauseAfter:
      "בסרגל העליון (בתוך התפריט בטלפון) משהה כל הנפשה בכל עמוד, והאתר זוכר את הבחירה במכשיר הזה. לחיצה נוספת מחזירה את התנועה.",
    noFlash: "שום דבר באתר לא מהבהב, ואין תוכן שזמין רק בזמן שהוא זז.",
    looks: "שינוי המראה של האתר",
    looksBody:
      "כפתור ערכת הצבעים בסרגל העליון (בתוך התפריט בטלפון) פותח תפריט אחד עם שלוש הגדרות. האתר זוכר כל אחת מהן במכשיר הזה, ואפשר להגיע לכל אחת ולשנות אותה במקלדת: Enter או רווח פותחים את התפריט, מקשי החיצים עוברים בין האפשרויות, ו־Escape סוגר אותו.",
    looksItems: [
      ["ערכת צבעים:", "בהירה, כהה, או לפי המערכת כדי לעקוב אחרי המכשיר שלכם."],
      ["גודל טקסט:", "רגיל, גדול (גדול בכ־12%) או גדול יותר (גדול ב־25%). זה בנוסף להגדלת התצוגה בדפדפן, שעובדת גם היא."],
      ["ניגודיות:", "רגילה, מוגברת, או לפי המערכת כדי לעקוב אחרי הגדרת \"הגברת ניגודיות\" של המכשיר. מוגברת מכהה את הטקסט המשני, את קווי המתאר ואת קווי ההפרדה, ומעבה את טבעת המיקוד."],
    ] as [string, string][],
    sharing: "שיתוף עמוד",
    sharingBody:
      "לרשימות, לפרויקטים ולכמה עמודים נוספים יש כפתור שיתוף. זה תפריט שאפשר לפתוח ולנוע בו במקלדת (Enter או רווח פותחים אותו, מקשי החיצים עוברים בין האפשרויות, ו־Escape סוגר אותו), ולכל פריט בו יש שם שקורא מסך מקריא.",
    sharingItems: [
      "שום דבר לא יוצא מהאתר עד שבוחרים פריט. בחירה ב־LinkedIn, ב־Gmail, ב־X או ב־WhatsApp פותחת את השירות בלשונית חדשה, והתפריט אומר זאת. אימייל פותח את אפליקציית הדואר שלכם. העתקת קישור ושמירת תמונה נשארות במכשיר שלכם. בטלפון התפריט עשוי לפתוח במקומו את חלון השיתוף של המכשיר.",
      "האתר לא מוסיף סקריפטים, פיקסלים או עוגיות של השירותים האלה, ולא יודע אם שיתפתם.",
      "קישור ששיתפתם יכול להסתיים בשתי תגיות קטנות, utm_source ו־utm_medium, שאומרות לעמוד שנפתח מהקישור מאיפה הוא הגיע. בעל האתר יכול לכבות אותן.",
      "אי אפשר למסור ל־LinkedIn טקסט מראש, ולכן הטקסט מועתק כדי שתדביקו אותו. אי אפשר לפתוח את Instagram מעמוד אינטרנט, ולכן התמונה נשמרת והטקסט מועתק, ואת התמונה מצרפים באפליקציה.",
    ],
    privacy: "פרטיות: רשימת התפוצה",
    privacyIntro: "מלבד הודעה שאתם שולחים בטופס יצירת הקשר, המידע האישי היחיד שהאתר אוסף במכוון הוא מה שאתם מקלידים בטופס ההרשמה. האתר לא משתמש בעוגיות, בניתוח נתונים או בפיקסלים למעקב, ובאף אימייל אין כאלה.",
    privacyItems: [
      "מה נשמר: כתובת האימייל, השם אם מסרתם, השפה והנושאים שבחרתם, והמועד וגרסת הטופס שאישרתם.",
      "בשביל מה: רק כדי לשלוח לכם את הרשימות והגרסאות החדשות שבחרתם. שום דבר לא נמכר, לא מועבר ולא משמש למטרה אחרת.",
      "אישור: אתם נוספים לרשימה רק אחרי שפתחתם את הקישור באימייל האישור. כתובת שלא אושרה נמחקת אחרי כמה ימים.",
      "עזיבה: בכל אימייל יש קישור להסרה, ואפשר לשנות נושאים או שפה מקישור ההעדפות. אחרי ההסרה הכתובת נשמרת רק כחסימה, כדי שלא תקבלו יותר אימיילים.",
      "מחיקה: כתבו לכתובת שלמטה והפרטים שלכם יימחקו.",
    ],

    limits: "מגבלות ידועות",
    limitItems: [
      "חלק מהתוכן, ובכלל זה רשימות ותיאורי פרויקטים, עדיין לא תורגם לעברית. בעמוד בעברית הוא מוצג באנגלית ומסומן ככזה.",
      "טבלאות רחבות בתוך רשימות נגללות הצידה במסך צר. אפשר להגיע אליהן ולגלול אותן במקלדת.",
      "הבדיקה נעשתה בכלים אוטומטיים, במקלדת ובעץ הנגישות של הדפדפן. האתר עדיין לא נבדק עם קורא מסך בכל הפלטפורמות.",
    ],
    report: "דיווח על בעיה",
    reportBefore: "אם משהו כאן לא עובד בשבילכם, או שאתם צריכים אותו בצורה אחרת, כתבו אל",
    reportOr: "או השתמשו ב",
    reportForm: "טופס יצירת הקשר",
    reportAfter: ". ציינו באיזה עמוד ומה קרה; אענה, ואתקן את מה שאפשר לתקן, מהר ככל שאוכל.",
    updated: (reviewed: string) => `ההצהרה עודכנה לאחרונה ב־${reviewed}.`,
  },
);

export const useMcpWords = defineWords(
  "mcp",
  {
    eyebrow: "Developers",
    title: "MCP server",
    intro:
      "This site speaks the Model Context Protocol. Point Claude, or any MCP client, at it and it can read the posts, the project areas and the channel log. There is nothing to download and no key to copy, and reading needs no account.",
    checking: "Checking the server…",
    status: "Status:",
    live: "live",
    off: "Status: not switched on yet. The commands below will work once it is.",
    connect: "Connect and read",
    connectIntro:
      "Anyone can connect. This address needs no account, no sign-in and no key, and it carries only what the public site already shows: published posts, areas, tags and the channel log. Nothing here can write.",
    desktop: "claude.ai and Claude Desktop: Settings → Connectors → Add custom connector",
    ownerHead: "Owner access",
    ownerIntro:
      "The site’s owner has a second address. It asks for a GitHub sign-in, which opens a browser window; only the owner’s account is accepted, and any other account is told so and given nothing. In return it unlocks drafts, the audit log, media and translations, and, if the owner allows it, writes.",
    tools: "Tools",
    publicHead: "Public, no sign-in",
    readHead: "Owner, read access (mcp:read)",
    writeHead: "Owner, write access (mcp:write)",
    publicCaption: "Public tools",
    readCaption: "Owner read tools",
    writeCaption: "Owner write tools",
    tool: "Tool",
    does: "What it does",
    copy: "Copy",
    copied: "Copied",
    copiedSay: "Copied to the clipboard",
    copyLabel: (label: string) => `Copy: ${label}`,
    how: "How the owner’s sign-in works",
    howBefore: "Standard OAuth 2.1 with PKCE. The client discovers everything from",
    howAfter: "and registers itself.",
    howItems: [
      "Identity comes from GitHub. The site never sees a password and keeps no GitHub token.",
      "The owner chooses the access on a consent screen: read, or read and write. Writes are dry runs unless the tool is told otherwise, deletes need explicit confirmation, and every change is in the audit log under the client’s name.",
      "Access tokens last an hour and renew for up to 30 days of use. Any connection can be revoked from the site’s admin at once.",
    ],
    toolsDo: {
      list_posts: "Published posts, newest first; filter by tag or area.",
      get_post: "One published post, in full.",
      list_tags: "Tags on published posts, with counts.",
      list_areas: "The site's areas: its own notes and each project.",
      get_area: "One area, with its links and repository.",
      list_activity: "The channel log: posts, releases and pushes.",
      admin_list_posts: "Every post, drafts and archived included.",
      admin_get_post: "Any post, in full.",
      read_audit_log: "Who changed what, and through which client.",
      list_media: "The media library: pictures, icons and videos, with what uses each.",
      list_translations: "What is missing, stale or done in Hebrew, across the site.",
      get_translation: "One item in English and Hebrew, side by side.",
      put_translation: "Write Hebrew: a draft for posts and content, LIVE at once for areas and media (no draft). Dry run unless told otherwise.",
      save_post_draft: "Create or edit a post. Dry run unless told otherwise.",
      publish_post: "Publish a post. Dry run unless told otherwise.",
      unpublish_post: "Return a post to draft. Dry run unless told otherwise.",
      delete_post: "Archive a post. Needs confirm: true.",
      save_area: "Create or edit an area. Dry run unless told otherwise.",
      delete_area: "Hide an area. Needs confirm: true.",
    } as Record<string, string>,
  },
  {
    eyebrow: "למפתחים",
    title: "שרת MCP",
    intro:
      "האתר תומך ב־Model Context Protocol‏ (MCP). חברו אליו את Claude, או כל לקוח MCP אחר, והוא יוכל לקרוא את הרשימות, את תחומי הפרויקטים ואת יומן הפעילות. אין מה להוריד ואין מפתח להעתיק, והקריאה לא דורשת חשבון.",
    checking: "בודק את השרת…",
    status: "מצב:",
    live: "פעיל",
    off: "מצב: עדיין לא הופעל. הפקודות שלמטה יעבדו ברגע שיופעל.",
    connect: "חיבור וקריאה",
    connectIntro:
      "כל אחד יכול להתחבר. הכתובת הזאת לא דורשת חשבון, התחברות או מפתח, והיא מציעה רק את מה שהאתר הציבורי כבר מציג: רשימות שפורסמו, תחומים, תגיות ויומן הפעילות. אי אפשר לכתוב דרכה דבר.",
    /* Latin runs isolated (LRI…PDI) so the menu path keeps Claude's own
       left-to-right order inside the Hebrew line. */
    desktop: "ב־\u2066claude.ai\u2069 וב־\u2066Claude Desktop\u2069: \u2066Settings → Connectors → Add custom connector\u2069",
    ownerHead: "גישת בעל האתר",
    ownerIntro:
      "לבעל האתר יש כתובת שנייה. היא מבקשת התחברות עם GitHub, שפותחת חלון דפדפן; רק החשבון של בעל האתר מתקבל, וכל חשבון אחר מקבל הודעה על כך ולא מקבל דבר. בתמורה היא פותחת טיוטות, יומן ביקורת, מדיה ותרגומים, ואם בעל האתר מאשר, גם כתיבה.",
    tools: "כלים",
    publicHead: "ציבוריים, בלי התחברות",
    readHead: "בעל האתר, גישת קריאה (mcp:read)",
    writeHead: "בעל האתר, גישת כתיבה (mcp:write)",
    publicCaption: "כלים ציבוריים",
    readCaption: "כלי קריאה של בעל האתר",
    writeCaption: "כלי כתיבה של בעל האתר",
    tool: "כלי",
    does: "מה הוא עושה",
    copy: "העתקה",
    copied: "הועתק",
    copiedSay: "הועתק ללוח",
    copyLabel: (label: string) => `העתקה: ${label}`,
    how: "איך עובדת ההתחברות של בעל האתר",
    howBefore: "OAuth 2.1 סטנדרטי עם PKCE. הלקוח מגלה את כל מה שהוא צריך מ־",
    howAfter: "ונרשם בעצמו.",
    howItems: [
      "הזהות מגיעה מ־GitHub. האתר אף פעם לא רואה סיסמה ולא שומר אסימון של GitHub.",
      "בעל האתר בוחר את הגישה במסך הסכמה: קריאה, או קריאה וכתיבה. פעולות כתיבה מתבצעות כהרצה יבשה אלא אם הכלי מתבקש אחרת, מחיקות דורשות אישור מפורש, וכל שינוי נרשם ביומן הביקורת בשם הלקוח.",
      "אסימוני גישה תקפים לשעה ומתחדשים עד 30 ימי שימוש. אפשר לבטל כל חיבור מממשק הניהול של האתר באופן מיידי.",
    ],
    toolsDo: {
      list_posts: "רשימות שפורסמו, מהחדשה לישנה; סינון לפי תגית או תחום.",
      get_post: "רשימה אחת שפורסמה, במלואה.",
      list_tags: "התגיות של רשימות שפורסמו, עם הספירה שלהן.",
      list_areas: "התחומים של האתר: הרשימות שלו עצמו וכל פרויקט.",
      get_area: "תחום אחד, עם הקישורים והמאגר שלו.",
      list_activity: "יומן הפעילות: רשימות, גרסאות ועדכוני קוד.",
      admin_list_posts: "כל הרשימות, כולל טיוטות וארכיון.",
      admin_get_post: "כל רשימה, במלואה.",
      read_audit_log: "מי שינה מה, ודרך איזה לקוח.",
      list_media: "ספריית המדיה: תמונות, סמלים וסרטונים, ומה משתמש בכל אחד.",
      list_translations: "מה חסר, מה התיישן ומה כבר תורגם לעברית, בכל האתר.",
      get_translation: "פריט אחד באנגלית ובעברית, זה לצד זה.",
      put_translation: "כתיבת עברית: לטיוטה בפוסטים ובתוכן, ישר לאתר באזורים ובמדיה (אין להם טיוטה). הרצה יבשה אלא אם מתבקש אחרת.",
      save_post_draft: "יצירה או עריכה של רשימה. הרצה יבשה אלא אם מתבקש אחרת.",
      publish_post: "פרסום רשימה. הרצה יבשה אלא אם מתבקש אחרת.",
      unpublish_post: "החזרת רשימה לטיוטה. הרצה יבשה אלא אם מתבקש אחרת.",
      delete_post: "העברת רשימה לארכיון. דורש confirm: true.",
      save_area: "יצירה או עריכה של תחום. הרצה יבשה אלא אם מתבקש אחרת.",
      delete_area: "הסתרת תחום. דורש confirm: true.",
    },
  },
);
