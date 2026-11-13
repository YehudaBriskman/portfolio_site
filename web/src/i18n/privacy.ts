import { defineWords } from "./words";

/*
 * The privacy page (#586): what happens to the data the mailing list and the
 * contact form handle.
 *
 * Every sentence here is a claim about the code or about a provider the owner
 * named, and the pull request that added it cites the file and line behind
 * each one. A sentence the code does not make true does not belong here: the
 * owner approves the wording, and that approval does not widen what may be
 * said. The page's date (Privacy.tsx, UPDATED) moves with any edit to a claim.
 *
 * Hebrew is written for Hebrew readers, not translated word for word: plural
 * "you" (gender-neutral), first person singular for the owner, "רשימת התפוצה"
 * for the mailing list because "רשימה" is a note on this site. The three
 * provider names are not in these tables: they are brand names the page sets
 * in Latin letters, and each item below is the sentence that follows its name.
 */

type Section = { heading: string; intro?: string; items: string[] };

export const usePrivacyWords = defineWords(
  "privacy",
  {
    eyebrow: "Privacy",
    title: "How I handle your email address",
    intro:
      "I run this site alone. If you subscribe to the mailing list, or write to me through the contact form, this page says what I keep, why, for how long, who handles it for me, and how you can ask me to show it to you, correct it or delete it.",
    updated: (date: string) => `Last updated ${date}`,
    sections: [
      {
        heading: "What I store when you subscribe",
        items: [
          "Your email address, your name if you gave one, and the language and topics you chose.",
          "That you signed up on this site, when you agreed, and which version of the sign-up text you agreed to.",
          "When you confirmed your address, and when you unsubscribed, if you did.",
          "If emails to you bounce, a note of it.",
          "For each email I send you, a short record of whether it was delivered. It is filed under a code made from your address, not under the address itself.",
          "Not stored: your IP address, your browser or your device, with your entry.",
        ],
      },
      {
        heading: "Why",
        items: [
          "Only to send you what you chose, and the one email that asks you to confirm your address. I do not sell it and I do not use it for anything else.",
          "Giving me your address is your choice. Without it I cannot email you.",
        ],
      },
    ] as Section[],
    howLongHeading: "How long I keep it",
    howLong: [
      "Before you confirm: the confirmation link works for 7 days. An entry that was never confirmed is deleted after that, the next time the site tidies its list, which happens when someone signs up or I open the list.",
      "While you are subscribed: until you unsubscribe or ask me to delete it.",
      "After you unsubscribe: I keep your entry, marked as unsubscribed, so that I never email you again. I delete it when you ask.",
      "A second, separate list exists for the same purpose: it keeps only a one-way code made from your address, the kind of entry and its date. No address, no name. It is there so that restoring a backup cannot put you back on the mailing list. I keep it for as long as you are unsubscribed.",
      "When I delete you: I delete your entry and your delivery records. The one-way code stays for 30 days and is then removed. A backup of the database may still hold your entry until that backup is replaced; I keep nightly backups for 14 days.",
    ],
    whoHeading: "Who handles it for me",
    whoIntro: "These services handle your address so that the site and its email work. I use them for nothing else.",
    providers: [
      "sends the emails I send you. It is a US company, and it sends them through Amazon SES in Ireland.",
      "forwards what is sent to my contact address (Cloudflare Email Routing).",
      "receives what is forwarded, so your messages to me arrive in a Google mailbox.",
    ],
    whoOutro: "The database with your entry runs on the server that hosts this site.",
    contactHeading: "The contact form",
    contact: [
      "A message you send through the contact form is emailed to me, through the same mail service. The site does not store it. I keep it in my mailbox for as long as I need to answer you.",
      "If you gave an email address in the form, the site sends that address one automatic reply.",
    ],
    trackingHeading: "No tracking",
    tracking: [
      "No open tracking: my emails contain no tracking pixel.",
      "No click tracking: the links in my emails lead straight to their addresses. They are not rewritten to count clicks.",
      "No cookies: the pages of this site set none.",
      "Your theme, language and reading choices are kept in your browser, on your device. They are never sent to me.",
      "Like any web server, the one behind this site writes an ordinary access log: your IP address, the time and the page. For the links in emails it logs the page only, never the secret part of the address.",
    ],
    rightsHeading: "Your rights, and how to use them",
    rightsIntro: "You can ask me to:",
    rights: [
      "show you what I hold about you (access),",
      "correct it (correction),",
      "delete it (erasure).",
    ],
    rightsBefore: "Write to",
    rightsAfter: "and I will do it by hand. You can also stop the emails yourself, at any time, with the unsubscribe link in each one, and change your topics or language from the preferences link.",
    changes: "If this page changes, the date above changes with it.",
    back: "Back to the sign-up form",
  },
  {
    eyebrow: "פרטיות",
    title: "איך אני מטפל בכתובת האימייל שלכם",
    intro:
      "את האתר הזה אני מפעיל לבד. אם נרשמתם לרשימת התפוצה, או כתבתם לי דרך טופס יצירת הקשר, בעמוד הזה כתוב מה אני שומר, בשביל מה, לכמה זמן, מי מטפל בו בשבילי, ואיך אפשר לבקש ממני להראות אותו, לתקן אותו או למחוק אותו.",
    updated: (date: string) => `עודכן לאחרונה ב־${date}`,
    sections: [
      {
        heading: "מה אני שומר כשנרשמים",
        items: [
          "את כתובת האימייל שלכם, את השם אם מסרתם, ואת השפה והנושאים שבחרתם.",
          "שנרשמתם דרך האתר הזה, מתי הסכמתם, ולאיזו גרסה של נוסח ההרשמה הסכמתם.",
          "מתי אישרתם את הכתובת, ומתי הסרתם אותה, אם הסרתם.",
          "אם אימייל אליכם חוזר, אני רושם זאת.",
          "על כל אימייל שאני שולח אליכם, רישום קצר אם הוא נמסר. הוא נשמר תחת קוד שנוצר מהכתובת, לא תחת הכתובת עצמה.",
          "לא נשמרים, יחד עם הרישום שלכם: כתובת הרשת של המכשיר שלכם, הדפדפן והמכשיר עצמו.",
        ],
      },
      {
        heading: "בשביל מה",
        items: [
          "רק כדי לשלוח לכם את מה שבחרתם, ואת האימייל האחד שמבקש מכם לאשר את הכתובת. אני לא מוכר אותה ולא משתמש בה לשום דבר אחר.",
          "מסירת הכתובת היא בחירה שלכם. בלעדיה אי אפשר לשלוח לכם אימייל.",
        ],
      },
    ] as Section[],
    howLongHeading: "כמה זמן אני שומר",
    howLong: [
      "לפני האישור: קישור האישור תקף 7 ימים. רישום שלא אושר נמחק אחרי כן, בפעם הבאה שהאתר מנקה את הרשימה שלו, וזה קורה כשמישהו נרשם או כשאני פותח את הרשימה.",
      "כל עוד אתם רשומים: עד שתסירו את עצמכם או תבקשו ממני למחוק.",
      "אחרי ההסרה: אני שומר את הרישום שלכם, מסומן כמוסר, כדי שלא אשלח לכם אימייל שוב. אני מוחק אותו כשתבקשו.",
      "יש רשימה שנייה, נפרדת, לאותה מטרה: היא שומרת רק קוד חד־כיווני שנוצר מהכתובת שלכם, את סוג הרישום ואת התאריך. בלי כתובת ובלי שם. היא קיימת כדי ששחזור מגיבוי לא יחזיר אתכם לרשימת התפוצה. אני שומר אותה כל עוד אתם מוסרים.",
      "כשאני מוחק אתכם: אני מוחק את הרישום שלכם ואת רישומי המסירה. הקוד החד־כיווני נשאר 30 ימים ואז נמחק. גיבוי של מסד הנתונים עשוי להחזיק את הרישום שלכם עד שהגיבוי מוחלף; אני שומר גיבוי מדי לילה, 14 ימים אחורה.",
    ],
    whoHeading: "מי מטפל בו בשבילי",
    whoIntro: "השירותים האלה מטפלים בכתובת שלכם כדי שהאתר והאימייל שלו יעבדו. אני לא משתמש בהם לשום דבר אחר.",
    providers: [
      "שולחת את האימיילים שאני שולח אליכם. זו חברה אמריקאית, והיא שולחת אותם דרך שירות הדואר של אמזון באירלנד.",
      "מעבירה הלאה את מה שנשלח לכתובת הקשר שלי (ניתוב אימייל של החברה).",
      "מקבלת את מה שהועבר, כך שהודעות שלכם אליי מגיעות לתיבת דואר של גוגל.",
    ],
    whoOutro: "מסד הנתונים שבו הרישום שלכם רץ על השרת שמארח את האתר.",
    contactHeading: "טופס יצירת הקשר",
    contact: [
      "הודעה שאתם שולחים בטופס יצירת הקשר נשלחת אליי באימייל, דרך שירות הדואר הזה. האתר לא שומר אותה. אני שומר אותה בתיבת הדואר שלי כל עוד אני צריך כדי לענות לכם.",
      "אם מסרתם בטופס כתובת אימייל, האתר שולח לכתובת הזו תשובה אוטומטית אחת.",
    ],
    trackingHeading: "בלי מעקב",
    tracking: [
      "בלי מעקב אחרי פתיחות: באימיילים שלי אין פיקסל מעקב.",
      "בלי מעקב אחרי לחיצות: הקישורים באימיילים שלי מובילים ישר לכתובת שלהם. הם לא משונים כדי לספור לחיצות.",
      "בלי עוגיות: דפי האתר לא יוצרים אותן.",
      "בחירת העיצוב, השפה והקריאה נשמרת בדפדפן שלכם, במכשיר שלכם. היא לא נשלחת אליי.",
      "כמו כל שרת אינטרנט, גם השרת של האתר כותב יומן גישה רגיל: כתובת הרשת שלכם, השעה והעמוד. על קישורים באימיילים הוא רושם את העמוד בלבד, בלי החלק הסודי של הכתובת.",
    ],
    rightsHeading: "הזכויות שלכם, ואיך לממש אותן",
    rightsIntro: "אפשר לבקש ממני:",
    rights: [
      "להראות לכם מה יש לי עליכם (עיון),",
      "לתקן אותו (תיקון),",
      "למחוק אותו (מחיקה).",
    ],
    rightsBefore: "כתבו אל",
    rightsAfter: "ואעשה זאת ידנית. אפשר גם להפסיק את האימיילים בעצמכם, בכל רגע, בקישור להסרה שבכל אחד מהם, ולשנות נושאים או שפה מקישור ההעדפות.",
    changes: "אם העמוד הזה ישתנה, התאריך שלמעלה ישתנה איתו.",
    back: "חזרה לטופס ההרשמה",
  },
);
