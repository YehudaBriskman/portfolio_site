import { defineWords } from "./words";
import type { HelpGroup, HelpTopic } from "@/lib/help/topics";

/** One outcome on the page: its heading, what is seen, why, and what to do. */
export type HelpEntry = { title: string; see: string; why: string; todo: string };

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
    problems: "When something goes wrong",
    problemsIntro:
      "What you see after an action, why it happens, and what to do. Each entry has its own address, so a message on the site can link straight to it.",
    groupTitles: {
      contact: "The contact form",
      newsletter: "The newsletter",
      share: "Sharing and copying",
    } as Record<HelpGroup, string>,
    labelSee: "What you see:",
    labelWhy: "Why:",
    labelDo: "What to do:",
    persistsBefore: "If it keeps happening, write to ",
    privacyLink: "The privacy page says what is kept.",
    topics: {
      "contact-sent": {
        title: "Message sent",
        see: "“Sent. I’ll reply to the address you gave.” The fields are cleared.",
        why: "The site accepted your message for sending.",
        todo: "Nothing more is needed. To send another, press “Write another message”.",
      },
      "contact-fields-invalid": {
        title: "A field needs a change",
        see: "“Nothing was sent.” and, under each field that needs a change, a note.",
        why: "Before sending, the form checks that the name has at least two characters, that the email address looks like name@example.com, and that the message has at least ten characters.",
        todo: "Change the field the note names and press Send message again.",
      },
      "contact-send-failed": {
        title: "Nothing was sent: something went wrong",
        see: "“Nothing was sent” followed by a short reason, for example “Couldn’t send that (HTTP 502)”, and a line saying your message is still in the fields.",
        why: "The message could not be handed to the mail service right now, or the site’s server had a problem. Your text is not cleared.",
        todo: "Wait a little and press Send message again, or write to the address shown under the form.",
      },
      "contact-too-many": {
        title: "Too many requests",
        see: "“Nothing was sent” with a reason that ends in “HTTP 429”.",
        why: "The contact form limits how many messages it takes in a short time, from one connection and from everyone together, so it can be busy even if you have only tried once.",
        todo: "Wait up to fifteen minutes and try again, or write to the address shown under the form.",
      },
      "contact-too-long": {
        title: "The message is too long",
        see: "“Nothing was sent” with a reason that ends in “HTTP 400”.",
        why: "The form accepts a message of up to 9,000 characters. A longer one is not sent: a note under the message field says how many characters to remove, and the cursor moves there.",
        todo: "Shorten the message by the number the note gives, split it in two, or write by email.",
      },
      "contact-offline": {
        title: "The site could not be reached",
        see: "“Nothing was sent” with a short reason in your browser’s own words.",
        why: "Your browser could not reach the site: there is no connection, or the connection dropped.",
        todo: "Check your connection and press Send message again. Your text is still in the fields.",
      },
      "newsletter-check-email": {
        title: "“Check your inbox”",
        see: "“Check your inbox. If the address can receive mail, a confirmation link is on its way. Nothing is added until you open it.”",
        why: "The site accepted the request. For an address that needs one, it sends one confirmation email, and the address is added to the list only after you open the link in it and press the confirm button. A second request within two minutes of the first does not send a second email.",
        todo: "Open the email and use its link. If nothing arrives after a few minutes, look in your spam folder, then try the form again.",
      },
      "newsletter-already-subscribed": {
        title: "An address that is already on the list",
        see: "The same message as for a new address: “Check your inbox…”.",
        why: "The form gives the same answer whether or not the address is already on the list, so the page does not reveal who is subscribed. For an address that is already subscribed, no new email is sent.",
        todo: "If you are already subscribed, no email arriving is expected. To change what you get, use the preferences link in any email from the list.",
      },
      "newsletter-fields-invalid": {
        title: "The form needs a change",
        see: "“That email address doesn’t look right. It should look like name@example.com” or “Choose at least one: notes or releases.” under the field.",
        why: "The form checks, in your browser, that the address looks like name@example.com and that at least one of notes or releases is chosen.",
        todo: "Change the field and press Subscribe again.",
      },
      "newsletter-too-many": {
        title: "Too many attempts",
        see: "“Too many attempts from this connection. Try again in a few minutes.”",
        why: "The site allows a limited number of attempts from one connection in a quarter of an hour, and every attempt counts, including ones that failed. The pages that open from an email show the same message when their own, higher limit is reached.",
        todo: "Wait a few minutes and try again.",
      },
      "newsletter-try-again": {
        title: "The site could not be reached, or had a problem",
        see: "“Couldn’t reach the server. Your details are still here; try again.” or “Something went wrong at my end. Your details are still here; try again in a moment.” On the pages that open from an email: “Could not reach the server. Check your connection and try again.”",
        why: "Either your browser could not reach the site, or the site’s server had a problem. What you typed is kept on the page.",
        todo: "Check your connection and try again in a moment.",
      },
      "confirm-done": {
        title: "Subscription confirmed",
        see: "“Subscribed. Thank you. The next note will arrive by email.”",
        why: "The confirmation was accepted: the address is now on the list, for the topics chosen on the form.",
        todo: "Nothing more is needed. To change topics or language, or to stop, use the links in any email from the list.",
      },
      "confirm-expired": {
        title: "The confirmation link does not work",
        see: "“This confirmation link is invalid or has expired. Subscribe again from the form to get a new one.”",
        why: "The page shows this one message whenever the link cannot be used: the site does not recognise it, it is past its time limit (the email says how many days it works), or the address can no longer be added by it, for example because it was unsubscribed since.",
        todo: "Fill in the form on the Follow page again; it sends a new confirmation email.",
      },
      "confirm-already-used": {
        title: "Opening the confirmation link again",
        see: "The same “Subscribed” message as the first time.",
        why: "If the address is already confirmed, the link answers as it did the first time and changes nothing.",
        todo: "Nothing is needed. If you see the “invalid or has expired” message instead, see the entry above it.",
      },
      "unsubscribe-done": {
        title: "Unsubscribed",
        see: "“Done. You won’t get any more email from this list.”, followed by a note on what is kept and how to ask for it to be erased.",
        why: "Your request was recorded and the address is marked as unsubscribed. Pressing the link again gives the same answer.",
        todo: "Nothing more is needed. To get the newsletter again, use the form on the Follow page; it asks for a new confirmation.",
      },
      "unsubscribe-link-problem": {
        title: "The unsubscribe link does not work",
        see: "“This link is invalid or has expired.” with the advice to use the link in your latest email, or to write to the contact address.",
        why: "The site does not recognise the link, or it is past its time limit.",
        todo: "Use the link in your latest email from the list, or write to the address below and the removal can be done by hand.",
      },
      "manage-saved": {
        title: "Preferences saved",
        see: "“Saved.”",
        why: "Your language and topic choices were stored for this address.",
        todo: "Nothing more is needed.",
      },
      "manage-link-problem": {
        title: "The preferences link does not work",
        see: "“This link is invalid or has expired. Use the link in the latest email.”",
        why: "The site does not recognise the link, it is past its time limit, or the address can no longer be changed with it.",
        todo: "Use the preferences link in the latest email from the list.",
      },
      "manage-save-failed": {
        title: "Preferences were not saved",
        see: "“Could not save your preferences. Your changes are still here; try again.”",
        why: "Your browser could not reach the site, or the site’s server had a problem. Your changes stay on the page.",
        todo: "Check your connection and press Save preferences again.",
      },
      "share-link-copied": {
        title: "Link copied",
        see: "“Link copied”",
        why: "Your browser allowed the page to put the link on the clipboard.",
        todo: "Paste it where you want it.",
      },
      "share-copy-failed": {
        title: "The link was not copied",
        see: "“Couldn’t copy. The address is in the address bar.”",
        why: "Your browser did not let the page write to the clipboard.",
        todo: "Copy the address from the address bar yourself.",
      },
      "share-save-failed": {
        title: "The image was not saved",
        see: "“Couldn’t save the image.”",
        why: "Your browser or device did not let the page save the picture.",
        todo: "Try again, or use your browser’s own way of saving an image.",
      },
    } as Record<HelpTopic, HelpEntry>,
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
    problems: "כשמשהו משתבש",
    problemsIntro:
      "מה רואים אחרי פעולה, למה זה קורה, ומה עושים. לכל סעיף יש כתובת משלו, כך שהודעה באתר יכולה להפנות ישירות אליו.",
    groupTitles: {
      contact: "טופס יצירת הקשר",
      newsletter: "העלון",
      share: "שיתוף והעתקה",
    } as Record<HelpGroup, string>,
    labelSee: "מה רואים:",
    labelWhy: "למה זה קורה:",
    labelDo: "מה עושים:",
    persistsBefore: "אם זה ממשיך לקרות, כתבו אל ",
    privacyLink: "עמוד הפרטיות אומר מה נשמר.",
    topics: {
      "contact-sent": {
        title: "ההודעה נשלחה",
        see: "״נשלח. אענה לכתובת שמסרתם.״ השדות מתרוקנים.",
        why: "האתר קיבל את ההודעה לשליחה.",
        todo: "אין צורך בשום דבר נוסף. כדי לשלוח הודעה נוספת, לחצו על ״כתיבת הודעה נוספת״.",
      },
      "contact-fields-invalid": {
        title: "שדה דורש תיקון",
        see: "״ההודעה לא נשלחה.״ ומתחת לכל שדה שדורש תיקון מופיעה הערה.",
        why: "לפני השליחה הטופס בודק שבשם יש לפחות שני תווים, שכתובת האימייל נראית כמו name@example.com, ושבהודעה יש לפחות עשרה תווים.",
        todo: "תקנו את השדה שההערה מציינת ולחצו שוב על שליחת ההודעה.",
      },
      "contact-send-failed": {
        title: "ההודעה לא נשלחה: משהו השתבש",
        see: "״שום דבר לא נשלח״ ואחריו סיבה קצרה באנגלית (למשל עם מספר שגיאה), ושורה שאומרת שההודעה שלכם עדיין בשדות.",
        why: "אי אפשר היה למסור את ההודעה לשירות הדואר כרגע, או שהייתה תקלה בשרת של האתר. הטקסט שלכם לא נמחק.",
        todo: "חכו קצת ולחצו שוב על שליחת ההודעה, או כתבו לכתובת שמופיעה מתחת לטופס.",
      },
      "contact-too-many": {
        title: "יותר מדי בקשות",
        see: "״שום דבר לא נשלח״ עם סיבה שמסתיימת במספר 429.",
        why: "טופס יצירת הקשר מגביל כמה הודעות הוא מקבל בזמן קצר, מחיבור אחד וממכלול הגולשים יחד, ולכן הוא יכול להיות עמוס גם אם ניסיתם רק פעם אחת.",
        todo: "חכו עד רבע שעה ונסו שוב, או כתבו לכתובת שמופיעה מתחת לטופס.",
      },
      "contact-too-long": {
        title: "ההודעה ארוכה מדי",
        see: "״שום דבר לא נשלח״ עם סיבה שמסתיימת במספר 400.",
        why: "הטופס מקבל הודעה של עד 9,000 תווים. הודעה ארוכה מזה לא נשלחת: הערה מתחת לשדה ההודעה אומרת כמה תווים להסיר, והסמן עובר לשם.",
        todo: "קצרו את ההודעה במספר שההערה נותנת, פצלו אותה לשתיים, או כתבו באימייל.",
      },
      "contact-offline": {
        title: "אי אפשר להגיע לאתר",
        see: "״שום דבר לא נשלח״ עם סיבה קצרה בניסוח של הדפדפן שלכם.",
        why: "הדפדפן לא הצליח להגיע לאתר: אין חיבור, או שהחיבור נפל.",
        todo: "בדקו את החיבור ולחצו שוב על שליחת ההודעה. הטקסט שלכם עדיין בשדות.",
      },
      "newsletter-check-email": {
        title: "״בדקו את תיבת הדואר״",
        see: "״בדקו את תיבת הדואר. אם אפשר לקבל אימייל בכתובת הזו, קישור אישור בדרך אליה. שום דבר לא נרשם עד שתפתחו אותו.״",
        why: "האתר קיבל את הבקשה. לכתובת שזקוקה לכך הוא שולח אימייל אישור אחד, והכתובת מתווספת לרשימה רק אחרי שפותחים את הקישור שבו ולוחצים על כפתור האישור. בקשה שנייה בתוך שתי דקות מהראשונה לא שולחת אימייל שני.",
        todo: "פתחו את האימייל והשתמשו בקישור שבו. אם אחרי כמה דקות לא הגיע דבר, חפשו בתיקיית הספאם, ואז נסו שוב את הטופס.",
      },
      "newsletter-already-subscribed": {
        title: "כתובת שכבר ברשימה",
        see: "אותה הודעה כמו לכתובת חדשה: ״בדקו את תיבת הדואר…״.",
        why: "הטופס עונה אותו דבר בין אם הכתובת כבר ברשימה ובין אם לא, כדי שהעמוד לא יחשוף מי ברשימה. לכתובת שכבר ברשימה לא נשלח אימייל חדש.",
        todo: "אם אתם כבר רשומים, זה צפוי שלא יגיע אימייל. כדי לשנות מה מקבלים, השתמשו בקישור ההעדפות בכל אימייל מהרשימה.",
      },
      "newsletter-fields-invalid": {
        title: "הטופס דורש תיקון",
        see: "״כתובת האימייל לא נראית תקינה. לדוגמה: name@example.com״ או ״יש לבחור לפחות אחד: רשימות או גרסאות.״ מתחת לשדה.",
        why: "הטופס בודק בדפדפן שלכם שהכתובת נראית כמו name@example.com ושנבחר לפחות אחד מהשניים: רשימות או גרסאות.",
        todo: "תקנו את השדה ולחצו שוב על הרשמה.",
      },
      "newsletter-too-many": {
        title: "יותר מדי ניסיונות",
        see: "״יותר מדי ניסיונות מהחיבור הזה. נסו שוב בעוד כמה דקות.״",
        why: "האתר מאפשר מספר מוגבל של ניסיונות מחיבור אחד בתוך רבע שעה, וכל ניסיון נספר, גם כזה שנכשל. העמודים שנפתחים מאימייל מציגים את אותה הודעה כשמגיעים למגבלה שלהם, הגבוהה יותר.",
        todo: "חכו כמה דקות ונסו שוב.",
      },
      "newsletter-try-again": {
        title: "אי אפשר להגיע לאתר, או שהייתה תקלה",
        see: "״אי אפשר להגיע לשרת. הפרטים שלכם עדיין כאן, נסו שוב.״ או ״משהו השתבש אצלי. הפרטים שלכם עדיין כאן, נסו שוב בעוד רגע.״ בעמודים שנפתחים מאימייל: ״אי אפשר להגיע לשרת. בדקו את החיבור ונסו שוב.״",
        why: "או שהדפדפן לא הצליח להגיע לאתר, או שהייתה תקלה בשרת של האתר. מה שהקלדתם נשאר בעמוד.",
        todo: "בדקו את החיבור ונסו שוב בעוד רגע.",
      },
      "confirm-done": {
        title: "ההרשמה אושרה",
        see: "״נרשמתם. תודה. הרשימה הבאה תישלח אליכם באימייל.״",
        why: "האישור התקבל: הכתובת נמצאת עכשיו ברשימה, לנושאים שנבחרו בטופס.",
        todo: "אין צורך בשום דבר נוסף. כדי לשנות נושאים או שפה, או להפסיק, השתמשו בקישורים בכל אימייל מהרשימה.",
      },
      "confirm-expired": {
        title: "קישור האישור לא עובד",
        see: "״הקישור לא תקין או שפג תוקפו. אפשר להירשם שוב מהטופס ולקבל קישור חדש.״",
        why: "העמוד מציג את ההודעה הזו בכל מקרה שאי אפשר להשתמש בקישור: האתר לא מכיר אותו, תוקפו פג (האימייל אומר לכמה ימים הוא עובד), או שאי אפשר עוד להוסיף בו את הכתובת, למשל כי היא הוסרה בינתיים.",
        todo: "מלאו שוב את הטופס בעמוד המעקב; הוא שולח אימייל אישור חדש.",
      },
      "confirm-already-used": {
        title: "פתיחת קישור האישור פעם נוספת",
        see: "אותה הודעה ״נרשמתם״ כמו בפעם הראשונה.",
        why: "אם הכתובת כבר מאושרת, הקישור עונה כמו בפעם הראשונה ואינו משנה דבר.",
        todo: "אין צורך בשום דבר. אם מופיעה במקום זה ההודעה שהקישור לא תקין או שפג תוקפו, ראו את הסעיף שמעליו.",
      },
      "unsubscribe-done": {
        title: "הוסרתם מהרשימה",
        see: "״בוצע. לא תקבלו עוד אימיילים מרשימת התפוצה.״ ואחריה הערה על מה נשמר ואיך מבקשים למחוק.",
        why: "הבקשה נרשמה והכתובת מסומנת כמוסרת. לחיצה נוספת על הקישור נותנת את אותה תשובה.",
        todo: "אין צורך בשום דבר נוסף. כדי לקבל שוב את העלון, השתמשו בטופס בעמוד המעקב; הוא מבקש אישור חדש.",
      },
      "unsubscribe-link-problem": {
        title: "קישור ההסרה לא עובד",
        see: "״הקישור לא תקין או שפג תוקפו.״ עם הפניה להשתמש בקישור באימייל האחרון, או לכתוב לכתובת הקשר.",
        why: "האתר לא מכיר את הקישור, או שתוקפו פג.",
        todo: "השתמשו בקישור באימייל האחרון מהרשימה, או כתבו לכתובת שלמטה וההסרה תיעשה ידנית.",
      },
      "manage-saved": {
        title: "ההעדפות נשמרו",
        see: "״נשמר.״",
        why: "בחירות השפה והנושאים שלכם נשמרו עבור הכתובת הזו.",
        todo: "אין צורך בשום דבר נוסף.",
      },
      "manage-link-problem": {
        title: "קישור ההעדפות לא עובד",
        see: "״הקישור לא תקין או שפג תוקפו. השתמשו בקישור באימייל האחרון.״",
        why: "האתר לא מכיר את הקישור, תוקפו פג, או שאי אפשר עוד לשנות בו את הכתובת.",
        todo: "השתמשו בקישור ההעדפות באימייל האחרון מהרשימה.",
      },
      "manage-save-failed": {
        title: "ההעדפות לא נשמרו",
        see: "״אי אפשר לשמור את ההעדפות. השינויים שלכם עדיין כאן, נסו שוב.״",
        why: "הדפדפן לא הצליח להגיע לאתר, או שהייתה תקלה בשרת של האתר. השינויים שלכם נשארים בעמוד.",
        todo: "בדקו את החיבור ולחצו שוב על שמירת ההעדפות.",
      },
      "share-link-copied": {
        title: "הקישור הועתק",
        see: "״הקישור הועתק״",
        why: "הדפדפן אפשר לעמוד להניח את הקישור בלוח ההעתקה.",
        todo: "הדביקו אותו במקום שתרצו.",
      },
      "share-copy-failed": {
        title: "הקישור לא הועתק",
        see: "״ההעתקה נכשלה. הכתובת מופיעה בשורת הכתובת.״",
        why: "הדפדפן לא אפשר לעמוד לכתוב ללוח ההעתקה.",
        todo: "העתיקו את הכתובת משורת הכתובת בעצמכם.",
      },
      "share-save-failed": {
        title: "התמונה לא נשמרה",
        see: "״שמירת התמונה נכשלה.״",
        why: "הדפדפן או המכשיר לא אפשרו לעמוד לשמור את התמונה.",
        todo: "נסו שוב, או השתמשו בדרך של הדפדפן שלכם לשמירת תמונה.",
      },
    } as Record<HelpTopic, HelpEntry>,
  },
);
