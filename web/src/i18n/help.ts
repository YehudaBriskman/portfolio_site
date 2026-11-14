import { defineWords } from "./words";

/*
 * The help page: short answers about using the site.
 *
 * Only what the site itself does is described here, and each line is a fact a
 * visitor can check by trying it. Nothing is promised about timing or about
 * what happens to data; that belongs on the privacy page, which this one does
 * not restate. A paragraph that holds a link or an address is split around it
 * (`before`, `after`) so the markup stays in the page and the words here.
 *
 * Each section has an `id` that is its address (`/help#language`): the ids
 * are part of the page's contract, so links from elsewhere keep working.
 */

export const useHelpWords = defineWords(
  "help",
  {
    eyebrow: "Using this site",
    title: "Help",
    intro: "Short answers about the language, the display, the keyboard, sharing, the feed and the contact form.",
    contents: "On this page",
    language: "Language",
    languageBody: [
      "The site is in English and in Hebrew. Open the display settings button in the top bar (inside the menu on a phone) and choose a language under Language.",
      "The address changes with the language, so a link you copy opens in the language you were reading. Anything not yet translated is shown in English and marked as such.",
    ],
    look: "Theme, text size and contrast",
    lookBody: "The same display settings menu holds these. The site remembers each choice on this device.",
    lookItems: [
      ["Theme:", "Light, Dark, or System to follow your device."],
      ["Text size:", "Default, Large or Larger. This is on top of your browser’s own zoom."],
      ["Contrast:", "Standard, More, or System to follow your device’s setting."],
      ["Pause motion:", "a switch at the bottom of the menu that stops every animation."],
    ] as [string, string][],
    lookMore: "The accessibility statement has the details.",
    keyboard: "Keyboard",
    keyboardItems: [
      ["Tab and Shift+Tab", "move to the next and the previous link or button. The first Tab reaches a link that skips straight to the content."],
      ["Menus", "(display settings, Share, filters): Enter or Space opens one, the arrow keys move, Escape closes it."],
      ["The year chart:", "the arrow keys move between days, and Home and End go to the first and the last."],
      ["The image viewer:", "plus and minus zoom, 0 resets, and the left and right arrow keys move between pictures."],
    ] as [string, string][],
    sharing: "Sharing a page",
    sharingBody:
      "Posts, projects and a few other pages have a Share button. It opens a menu you can use with the keyboard.",
    sharingItems: [
      "Nothing leaves this site until you choose an item. LinkedIn, Gmail, X and WhatsApp open in a new tab, and the menu says so.",
      "Email opens your own mail app. Copy link and Save image stay on your device.",
      "On a phone the menu may open your device’s own share sheet instead.",
    ],
    rss: "RSS",
    rssBody: "The notes have an RSS feed, for a feed reader. Add this address to your reader, or open it to see the feed.",
    rssOpen: "Open the feed",
    contact: "The contact form",
    contactBefore: "The form is in the Contact section on the ",
    contactLink: "home page",
    contactAfter: ". This is what happens when you press Send message.",
    contactItems: [
      "The form checks the three fields first: name, email and message. If one needs a change, nothing is sent, and a note under that field says what to change.",
      "If everything is in order, the message is sent to me by email, and the form says it was sent.",
      "If sending fails, the form says that nothing was sent. Your text stays in the fields, so you can try again or write to the address below.",
    ],
    contactAddress: "You can also write directly to",
    back: "Back to the site",
  },
  {
    eyebrow: "איך משתמשים באתר",
    title: "עזרה",
    intro: "תשובות קצרות על השפה, התצוגה, המקלדת, השיתוף, הפיד וטופס יצירת הקשר.",
    contents: "בעמוד הזה",
    language: "שפה",
    languageBody: [
      "האתר זמין באנגלית ובעברית. פתחו את כפתור הגדרות התצוגה בסרגל העליון (בתוך התפריט בטלפון) ובחרו שפה תחת ״שפה״.",
      "הכתובת משתנה יחד עם השפה, ולכן קישור שהעתקתם נפתח בשפה שקראתם בה. מה שעדיין לא תורגם מוצג באנגלית ומסומן ככזה.",
    ],
    look: "ערכת צבעים, גודל טקסט וניגודיות",
    lookBody: "אותו תפריט של הגדרות תצוגה מחזיק אותן. האתר זוכר כל בחירה במכשיר הזה.",
    lookItems: [
      ["ערכת צבעים:", "בהירה, כהה, או לפי המערכת כדי לעקוב אחרי המכשיר שלכם."],
      ["גודל טקסט:", "רגיל, גדול או גדול יותר. זה בנוסף להגדלת התצוגה בדפדפן."],
      ["ניגודיות:", "רגילה, מוגברת, או לפי המערכת כדי לעקוב אחרי הגדרת המכשיר."],
      ["השהיית תנועה:", "מתג בתחתית התפריט שעוצר כל הנפשה."],
    ] as [string, string][],
    lookMore: "הצהרת הנגישות מפרטת עוד.",
    keyboard: "מקלדת",
    keyboardItems: [
      ["Tab ו־Shift+Tab", "עוברים לקישור או לכפתור הבא ולקודם. הלחיצה הראשונה על Tab מגיעה לקישור שמדלג ישירות לתוכן."],
      ["תפריטים", "(הגדרות תצוגה, שיתוף, מסננים): Enter או רווח פותחים תפריט, מקשי החיצים עוברים בין האפשרויות, ו־Escape סוגר אותו."],
      ["תרשים השנה:", "מקשי החיצים עוברים בין הימים, ו־Home ו־End מגיעים לראשון ולאחרון."],
      ["מציג התמונות:", "פלוס ומינוס מגדילים ומקטינים, 0 מאפס, ומקשי החיצים ימינה ושמאלה עוברים בין תמונות."],
    ] as [string, string][],
    sharing: "שיתוף עמוד",
    sharingBody:
      "לרשימות, לפרויקטים ולכמה עמודים נוספים יש כפתור שיתוף. הוא פותח תפריט שאפשר להשתמש בו במקלדת.",
    sharingItems: [
      "שום דבר לא יוצא מהאתר עד שבוחרים פריט. LinkedIn, Gmail, X ו־WhatsApp נפתחים בלשונית חדשה, והתפריט אומר זאת.",
      "אימייל פותח את אפליקציית הדואר שלכם. העתקת קישור ושמירת תמונה נשארות במכשיר שלכם.",
      "בטלפון התפריט עשוי לפתוח במקומו את חלון השיתוף של המכשיר.",
    ],
    rss: "פיד RSS",
    rssBody: "לרשימות יש פיד RSS, לקורא פידים. הוסיפו את הכתובת הזאת לקורא שלכם, או פתחו אותה כדי לראות את הפיד.",
    rssOpen: "פתיחת הפיד",
    contact: "טופס יצירת הקשר",
    contactBefore: "הטופס נמצא באזור יצירת הקשר ב",
    contactLink: "עמוד הבית",
    contactAfter: ". כך זה עובד כשלוחצים על שליחת ההודעה.",
    contactItems: [
      "הטופס בודק קודם את שלושת השדות: שם, אימייל והודעה. אם שדה דורש תיקון, שום דבר לא נשלח, והערה מתחתיו אומרת מה לתקן.",
      "אם הכול תקין, ההודעה נשלחת אליי באימייל, והטופס אומר שהיא נשלחה.",
      "אם השליחה נכשלת, הטופס אומר ששום דבר לא נשלח. הטקסט שלכם נשאר בשדות, ואפשר לנסות שוב או לכתוב לכתובת שלמטה.",
    ],
    contactAddress: "אפשר גם לכתוב ישירות אל",
    back: "חזרה לאתר",
  },
);
