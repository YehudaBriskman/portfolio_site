import { defineWords } from "./words";

/*
 * The privacy page (#586): what happens to the data the mailing list and the
 * contact form handle.
 *
 * The wording is the owner's, approved sentence by sentence. Every sentence is
 * a claim about the code or about a provider the owner named, and the pull
 * request that added it cites the file and line behind each one. A sentence
 * the code does not make true does not belong here, and the page's date
 * (Privacy.tsx, UPDATED) moves with any edit to a claim.
 *
 * `{0}` is the contact address (a mail link), `{1}` Oracle Cloud, `{2}` Resend,
 * `{3}` Cloudflare, `{4}` Google. They are brand names kept in Latin letters in
 * both languages, so Privacy.tsx fills them in and the Hebrew table holds no
 * Latin.

 */

export type PrivacySection = { heading: string; body: string };

export const usePrivacyWords = defineWords(
  "privacy",
  {
    eyebrow: "Privacy",
    title: "How I handle your email address",
    intro: "I run this site myself: Yehuda Briskman, {0}. This is what it collects, why, and who handles it.",
    updated: (date: string) => `Last updated ${date}`,
    sections: [
      {
        heading: "What I store when you subscribe to my newsletter",
        body: "Your email address, your name if you gave one, your language and topics, when you agreed and which version of the form, and when you confirmed or unsubscribed. Giving these is voluntary; without an address I cannot send you anything.",
      },
      {
        heading: "Why",
        body: "Only to send you the newsletter you subscribed to (the notes and releases you chose) and the one confirmation email. I do not sell it or use it for anything else.",
      },
      {
        heading: "Who handles it",
        body: "The data sits in the database that runs this site, hosted with {1} in Israel. Email is sent through {2}, a US company that runs on Amazon’s email service in Ireland. Mail to my contact address passes through {3} and {4}. They act for me and only to run the service. Nothing else receives it.",
      },
      {
        heading: "No tracking",
        body: "No cookies, analytics or tracking pixels, and no open or click tracking in emails. Your theme and language choices stay in your browser and are never sent to me. Like any web server, mine keeps ordinary technical logs, in the server's automatically rotating logs. I use them only to fix errors and keep the site secure.",
      },
      {
        heading: "Confirmation",
        body: "You are on the list only after you open the link we email you. An address that is not confirmed is deleted after about a week.",
      },
      {
        heading: "Leaving",
        body: "Every email has an unsubscribe link, and you can change topics or language from the preferences link. After you unsubscribe I keep only a one-way fingerprint of your address, marked as unsubscribed, so I never email you again. Your address, name and language are deleted 30 days after you unsubscribe (sooner if you ask), and from backups within 14 more days.",
      },
      {
        heading: "Your rights",
        body: "Write to {0} to see what I hold, correct it, or have it deleted. I answer within 30 days. In Israel you can also complain to the Privacy Protection Authority; if you are in the EU, to your data protection authority.",
      },
      {
        heading: "The contact form",
        body: "A message you send through the contact form reaches my mailbox and is not stored on this site. I keep it as long as needed to answer you.",
      },
    ] as PrivacySection[],
    back: "Back to the sign-up form",
  },
  {
    eyebrow: "פרטיות",
    title: "איך אני מטפל בכתובת האימייל שלכם",
    intro: "את האתר אני מפעיל בעצמי: יהודה בריסקמן, {0}. כאן כתוב מה האתר אוסף, בשביל מה, ומי מטפל בזה.",
    updated: (date: string) => `עודכן לאחרונה ב־${date}`,
    sections: [
      {
        heading: "מה אני שומר כשנרשמים לעלון שלי",
        body: "כתובת אימייל, שם אם מסרתם, שפה ונושאים, מתי הסכמתם ואיזו גרסה של הטופס, ומתי אישרתם או הסרתם. מסירת הפרטים היא בבחירתכם; בלי כתובת אימייל אי אפשר לשלוח לכם דבר.",
      },
      {
        heading: "בשביל מה",
        body: "רק כדי לשלוח לכם את העלון שנרשמתם אליו (הרשימות והגרסאות שבחרתם) ואת אימייל האישור האחד. אני לא מוכר אותו ולא משתמש בו לשום דבר אחר.",
      },
      {
        heading: "מי מטפל בו",
        body: "המידע נשמר במסד הנתונים שמריץ את האתר, והוא מאוחסן אצל {1} בישראל. האימייל נשלח דרך {2}, חברה אמריקאית שפועלת על שירות הדואר של אמזון באירלנד. דואר שנשלח לכתובת הקשר שלי עובר דרך {3} ו־{4}. הם פועלים עבורי ורק כדי להפעיל את השירות. אף גורם אחר לא מקבל אותו.",
      },
      {
        heading: "בלי מעקב",
        body: "אין עוגיות, ניתוח נתונים או פיקסלים למעקב, ואין מעקב אחר פתיחות או לחיצות באימיילים. בחירת העיצוב והשפה נשארת בדפדפן שלכם ואינה נשלחת אליי. כמו בכל שרת אינטרנט, אצלי נשמרים יומני שרת טכניים רגילים, שמתחלפים אוטומטית. אני משתמש בהם רק כדי לתקן תקלות ולשמור על אבטחת האתר.",
      },
      {
        heading: "אישור",
        body: "אתם ברשימה רק אחרי שפתחתם את הקישור שנשלח אליכם באימייל. כתובת שלא אושרה נמחקת אחרי כשבוע.",
      },
      {
        heading: "הסרה",
        body: "בכל אימייל יש קישור להסרה, ומקישור ההעדפות אפשר לשנות נושאים או שפה. אחרי ההסרה אני שומר רק טביעת אצבע חד־כיוונית של הכתובת, מסומנת כמוסרת, כדי שלא אשלח לכם אימייל שוב. הכתובת, השם והשפה נמחקים 30 ימים אחרי ההסרה (מוקדם יותר אם תבקשו), ומהגיבויים בתוך 14 ימים נוספים.",
      },
      {
        heading: "הזכויות שלכם",
        body: "כתבו אל {0} כדי לעיין במידע שיש לי, לתקן אותו או למחוק אותו. אענה תוך 30 ימים. בישראל אפשר גם לפנות לרשות להגנת הפרטיות; מי שבאיחוד האירופי יכול לפנות לרשות להגנת המידע במדינתו.",
      },
      {
        heading: "טופס יצירת הקשר",
        body: "הודעה שנשלחת בטופס יצירת הקשר מגיעה לתיבת הדואר שלי ואינה נשמרת באתר. אני שומר אותה כל עוד צריך כדי לענות.",
      },
    ] as PrivacySection[],
    back: "חזרה לטופס ההרשמה",
  },
);
