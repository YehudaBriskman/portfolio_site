/*
 * The Hebrew of the content seed: projects, the story's hand-written beats,
 * and the site copy that `heroHebrew` (data/site.ts) does not already carry.
 *
 * Kept beside the English rather than inside it, because the English files
 * are the seed's English and are read by tests field by field; this file is
 * read in exactly one place, `content/convert.ts` `seedBundle()`, which puts
 * each line under its English as `{ en, he }`. Arrays are by position: the
 * third highlight here is the third highlight there, and
 * `content/__tests__/hebrew.test.ts` fails on a count that does not match.
 *
 * The same lines reach the running store through
 * `backend/scripts/load-projects-story.mjs`, which fills a missing Hebrew
 * only where the store's English is still the English this was written
 * against, so an edit the owner made in the admin is never given a stale
 * translation.
 *
 * Style (glossary.json): the reader is addressed in the plural; names and
 * the terms Israeli developers say in English stay in Latin (CI, deploy,
 * release, PR, Kubernetes, Terraform, Chrome Web Store), joined to a Hebrew
 * prefix with a maqaf (ה־CI); פול־סטאק, פרונטאנד and בקאנד as the site
 * already writes them. A code identifier is wrapped in a left-to-right
 * isolate (`ltr` below) so its slashes and colons keep their order.
 *
 * THE EMPLOYER IS NEVER NAMED, in this language either. The role is
 * "ראש צוות טכני" and the sentence stops there.
 */

/** A code identifier inside Hebrew prose, isolated left to right (LRI…PDI). */
const ltr = (s: string) => `⁦${s}⁩`;

export type ProjectHebrew = {
  fact: string;
  description: string;
  status: string;
  highlights: string[];
  problem?: string;
  role?: string;
  outcome?: string;
  decisions?: { title: string; body: string }[];
  /** By position, for each of `links`. */
  links?: string[];
  storyLine: string;
};

export const PROJECTS_HE: Record<string, ProjectHebrew> = {
  windom: {
    fact: "כל לשונית חדשה הופכת ללוח בקרה",
    description:
      "תוסף ל־Chrome שמחליף את דף הלשונית החדשה בלוח בקרה אישי: יומן, דואר, משימות, מזג אוויר, מוזיקה ושווקים בתצוגה אחת. מפורסם ב־Chrome Web Store ומשמש משתמשים אמיתיים, עם בקאנד של Fastify ו־PostgreSQL מאחוריו.",
    status: "פעיל ב־Chrome Web Store",
    highlights: [
      "מפורסם ב־Chrome Web Store, גרסה 1.5.1",
      "תג גרסה חדש בונה, אורז ושולח ל־Google בלי שום צעד ידני",
      "פול־סטאק לבד: פרונטאנד ב־React, בקאנד ב־Fastify ו־PostgreSQL, ו־OAuth של Google ו־Spotify",
    ],
    problem:
      "הדברים שבודקים ראשונים בבוקר — השעה, מזג האוויר, המשימות של היום, מה מתנגן, ה־PR שמחכים לכם, המחיר של משהו שאתם מחזיקים — כל אחד מהם יושב בלשונית משלו, ורוב לוחות הבקרה שמרכזים אותם דורשים חשבון או מפתח API לפני שהם מראים משהו. WindoM שם אותם בדף שהדפדפן כבר פותח, וכל הרשימה הראשונה עובדת בלי חשבון ובלי מפתחות בכלל.",
    role: `לבד, בכל ארבעת החלקים של המאגר: התוסף עצמו, ה־API ב־Fastify שמאחוריו, ${ltr("windom.app")}, וה־CI שמוציא את הגרסאות.`,
    outcome:
      "מפורסם ב־Chrome Web Store וממשיך להתעדכן — גרסה 1.5.1 יצאה ב־26 באוקטובר 2026. כל release קורא עכשיו בחזרה את התשובה של החנות לפני שהוא מכריז שסיים, וכך התגלה ש־1.5.0 ישבה בחנות כטיוטה שלא הוגשה, בזמן שה־CI הראה ירוק.",
    decisions: [
      {
        title: "הווידג׳ט של Gmail הוסר מסיבה של רישוי, לא של מוצר.",
        body: `קריאת דואר דורשת את ההרשאה ${ltr("gmail.readonly")}, ש־Google מסווגת כמוגבלת: פרסום איתה מחייב הערכת אבטחה חיצונית מסוג CASA, שמתומחרת לפי דרגה ומתחדשת כל שנה, כי הדואר עובר דרך השרת במקום להישאר בדפדפן. מסך ההסכמה מבקש עכשיו רק את Calendar ואת ההתחברות, שמאומתים בחינם. שום דבר לא נמחק — היכולת יושבת מאחורי ${ltr("GMAIL_ENABLED")}, כבויה כברירת מחדל — כך שהיא יכולה לחזור אם הקריאה תעבור פעם לתוך התוסף.`,
      },
      {
        title: "הזכוכית היא אופטיקה מחושבת, לא ערימה של טריקים ב־CSS.",
        body: "השוליים של כל לוח מכופפים את הטפט שמאחוריהם לפי חוק סנל, לאורך פרופיל של סקווירקל ממעלה רביעית, כשהכיוון נלקח משדה מרחק של מלבן מעוגל וזווית הפגיעה מוגבלת ל־65 מעלות — מעבר לזה, לפי משוואות פרנל, משטח אמיתי מחזיר את האור במקום להעביר אותו. כל צורת לוח מקבלת שדה הסטה משלה, שנוצר פעם אחת ונשמר במטמון.",
      },
      {
        title: "ההתחברות הוציאה אתכם מיד מהחשבון — תקלה אחת, כמה תסמינים.",
        body: "‏Calendar,‏ Spotify ו־Gmail מחזירים כל אחד 401 כשההרשאה אצל הספק שלהם כבר לא בתוקף. כל תשובה כזאת נקראה כסשן שפג תוקפו והפעילה רענון של האסימון, וחמש כאלה כילו תוך שניות את המכסה של נקודת הקצה לרענון — חמש בכל רבע שעה. ה־429 שחזר נקרא אז כסשן מת והוציא את המשתמש מהחשבון, כך שככל שמישהו חיבר יותר שירותים, זה קרה מהר יותר. ‏401 מנתיב של ספק הוא עכשיו עניין של אותו ספק לדווח עליו.",
      },
    ],
    storyLine: "מפורסם ב־Chrome Web Store: בדיקה של החנות, מדיניות פרטיות, ערוץ עדכונים.",
  },

  bothy: {
    fact: "קונסולה למכונה אחת ששואלת את Docker מה רץ",
    description:
      "קונסולה באירוח עצמי למכונה אחת. היא מדווחת על קונטיינרים, פורטים, נתיבים, מדדים וקבצים בכך שהיא שואלת את Docker ישירות, במקום לקרוא רשימה שמישהו צריך לזכור לעדכן — כך שמה שהיא מראה הוא מה שבאמת רץ.",
    status: "קוד פתוח, באירוח עצמי",
    highlights: [
      "כל כרטיס מתגלה מעצמו, אף אחד לא מוגדר ביד",
      "כל PR מקים את כל המערכת מאפס ומריץ את כל חבילות הבדיקות",
      "סודות נוצרים בהתקנה; השמות נרשמים ללוג, הערכים אף פעם לא",
      "125 PR שמוזגו",
    ],
    problem:
      "קונסולה למכונה אחת היא בדרך כלל רשימה שנכתבה ביד, ולכן היא שגויה מהקונטיינר הראשון שזז, ואף אחד לא שם לב עד שזה משנה. וכל פרויקט על אותה מכונה פותר מחדש את החלקים שהוא לא מביא איתו: נקודת כניסה, זהות, ניטור, מסד נתונים משותף, גיבויים.",
    role: "סביבת פיתוח של אדם אחד, שאפשר לשחזר, ב־git: הקונסולה, קובצי ה־Docker Compose שמתחתיה, וה־CI שמשכפל את המאגר לתיקייה ריקה בכל PR ומריץ כל חבילת בדיקות בעץ מול מה שעלה.",
    outcome:
      "מפעילים קונטיינר כלשהו והוא מופיע בקונסולה תוך עשר שניות, בלי לגעת ב־Bothy; עוצרים אותו והנקודה שלו מאדימה באותה מהירות. חמישים נתבים דורשים תפקיד, בחמישה קבצים, והטבלאות שמתעדות את זה נבדקות מול ה־YAML שורה אחר שורה במקום להיכתב ביד — פעם ה־README מנה ארבעה־עשר נתבים כשבעץ היו ארבעים ושמונה.",
    decisions: [
      {
        title: `גבול האבטחה הוא הכלל ב־Traefik, לא ההגדרות של ה־${ltr("socket proxy")}.`,
        body: `${ltr("docker-socket-proxy")} מסנן לפי משפחה של נקודות קצה, ולכן ${ltr("CONTAINERS=1")} מתיר גם את ${ltr("/containers/{id}/json")} — שהתשובה שלה מכילה את משתני הסביבה של כל קונטיינר, כלומר סיסמאות אמיתיות. מה שבאמת מונע את זה הוא הנתב, שבו כל כלל הוא ${ltr("Path()")} מדויק ורק שתי נקודות קצה של Docker מנותבות. הרחבה לקידומת הייתה פותחת את כל השאר בשקט.`,
      },
      {
        title: `אין ${ltr("exec")}, וזו נסיגה מכוונת.`,
        body: `אין מעטפת בדפדפן, אין ${ltr("kill")}, אין ${ltr("create")}, אין ניהול של אימג׳ים או של אחסון. ${ltr("docker exec")} הוא ${ltr("root")} על המכונה, ולכן ${ltr("EXEC: 0")} כתוב במפורש בכל שלושת ה־${ltr("socket proxies")} במקום להישאר לברירת המחדל, רשימת הפעולות היא רשימה קבועה של שלושה איברים, שאף פעם לא נגזרת מהקוד שמטפל בבקשות, ובדיקה מוודאת את שניהם. Portainer כן הציע את זה, והוא נמחק; התחליף הוא ${ltr("docker exec")} מעל Tailscale SSH.`,
      },
      {
        title: "פונקציה אחת אחראית על המעבר על הקבצים, כך שבדיקת האבטחה היא לא משהו שהקורא צריך לזכור.",
        body: `${ltr("safepath.collect()")} של ה־API לקבצים היא הדרך היחידה שבה האפליקציה יכולה לקבל קבוצה של נתיבים, כך שנקודת קצה חדשה יורשת את כללי החסימה בכך שהיא קוראת לה, ולא בזכות זה שמי שכתב אותה זכר אותם. זה נלמד פעמיים: רשימת קבצים שעברה על התיקיות בעצמה שילמה על 30,093 קבצים חסומים כדי להגיש 3,474, וכשהגיע חיפוש בטקסט מלא, אותו קיצור דרך היה מחזיר שורה תואמת מתוך ${ltr(".env")} בזמן שרשימת החסימה עדיין נכונה, טכנית.`,
      },
    ],
    storyLine: "קוד פתוח. ההתקנה צריכה לעבוד על מכונה שמי שכתב אותה מעולם לא ראה.",
  },

  "portfolio-site": {
    fact: "האתר הזה: פרויקטים ורשימות באנגלית ובעברית, עם ממשק ניהול משלו",
    description:
      "האתר שאתם קוראים: אפליקציית עמוד יחיד ב־React מול API ב־Express, עם התוכן ב־CouchDB וממשק ניהול לכתיבה שלו. כל עמוד קיים באנגלית ובעברית, וכל release הוא תג שמקדם אימג׳ים שה־CI כבר בנה, בדק וסרק.",
    status: "פעיל, גרסה חדשה רק מתג",
    highlights: [
      "כל עמוד באנגלית ובעברית, והעברית מימין לשמאל",
      "תג מקדם את האימג׳ים ש־main כבר בנה, בדק וסרק; הוא לא בונה כלום",
      "תוכן, תמונות ורשימות נערכים בממשק הניהול של האתר, כטיוטות שמתפרסמות אחר כך",
      "170 PR שמוזגו",
    ],
    problem:
      "כל מילה בעמוד הבית, בסיפור ובפרויקטים הייתה פעם קבוע בקוד, כך שכל שינוי של משפט היה deploy. ואפליקציית עמוד יחיד מחזירה את אותה מעטפת ריקה לכל כתובת, וזה מה שרואים סורק של מנוע חיפוש או תצוגה מקדימה של קישור.",
    role: "לבד: הפרונטאנד ב־React, ה־API ב־Express ומסד התוכן שלו, ממשק הניהול ושרת ה־MCP שכותבים דרכם, וה־CI שבונה, בודק ומוציא גרסאות.",
    outcome: `פעיל ב־${ltr("yehudabriskman.com")}, עם ${ltr("v1.0.0")}, ${ltr("v1.1.0")} ו־${ltr("v1.2.0")} שתויגו בין 2 ל־4 בנובמבר 2026. כל push ל־main רץ קודם על עותק preprod, ושום דבר לא מגיע לאתר הזה עד שמישהו מתייג אותו.`,
    decisions: [
      {
        title: "מיזוג לא עושה deploy. תג כן.",
        body: `‏push ל־main נבנה, נבדק, נסרק ומתפרסם, וה־CI רושם release manifest לאותו קומיט: קומיט המקור, שני האימג׳ים לפי digest, הקלטים של הבנייה ותוצאת הסריקה. אחר כך הוא עולה ל־preprod. שום דבר לא מגיע לאתר עד שמישהו מתייג קומיט, כך שלשחזור יש שם — ${ltr("v1.2.0")} הוא משהו שאפשר לעשות לו deploy מחדש.`,
      },
      {
        title: "תג לא בונה כלום.",
        body: "הוא מקדם את ה־digests שה־CI של main כבר בנה, בדק, סרק ורשם לאותו קומיט. תג על קומיט ש־main אף פעם לא רשם נכשל, ואומר למה, ו־release ישן יותר מזה שבסביבת הייצור נדחה, אלא אם ההרצה מצהירה שזה שחזור. ‏digest לא יכול לזוז, והוא בדיוק האימג׳ שנסרק.",
      },
      {
        title: "העמוד אף פעם לא מחכה ל־API כדי להופיע.",
        body: "האתר מצטייר מקובצי הנתונים שבמאגר כבר מהפריים הראשון, ומחליף אותם במה שמסד התוכן מגיש ברגע שהוא עונה. ‏API שלא עונה, תשובה שלא עוברת את הסכמה, או מסד שמעולם לא אוכלס — בכל המקרים האלה הקבצים נשארים, כך שהעמוד אף פעם לא ריק.",
      },
    ],
    storyLine: "גרסאות לפי תג: push ל־main מגיע ל־preprod, ורק תג מגיע לאתר הזה.",
  },

  "oci-free": {
    fact: "שרת ה־ARM החינמי היחיד שהאתר הזה רץ עליו, כתוב כקוד",
    description:
      "התשתית שמאחורי האתר: Terraform (שמורץ עם OpenTofu) לרשת ב־Oracle Cloud Always Free ולמכונת ה־Ampere ARM היחידה שבה, וה־manifests של k3s, גרסאות Helm נעוצות והסקריפטים שמריצים עליה את האתר, את עותק ה־preprod ואת הניטור שלהם.",
    status: "קוד פתוח, מריץ את האתר הזה",
    highlights: [
      "נכנס במגבלות Always Free של Oracle: מכונת ARM אחת, 2 OCPU ו־12 GB",
      `כל התקנת Helm בגרסה שכתובה במאגר, וה־CI מרנדר מולה כל קובץ ${ltr("values")}`,
      "הרשאת ה־deploy של כל סביבה יכולה לעדכן רק את ה־namespace שלה",
      `שני עותקים ותקציב שיבושים (${ltr("PodDisruptionBudget")}) ל־${ltr("web")} ול־API של האתר, לעדכונים בלי השבתה`,
    ],
    problem:
      "שרת שהוקם ביד אי אפשר לבנות שוב באותה צורה. עד שגרסאות ה־charts נכתבו, בנייה מחדש הייתה מתקינה את מה שכל chart היה באותו יום, והאימג׳ים של האתר נבנו על השרת עצמו מעותק של תיקיית עבודה, ולא ממה שנכנס ל־git.",
    role: `לבד: ה־Terraform לרשת ולמכונה, ה־manifests וקובצי ה־${ltr("values")} של Helm בקלאסטר, הסקריפטים סביבם, וה־CI שבודק כל אחד מהם.`,
    outcome:
      "האתר הזה ועותק ה־preprod שלו רצים כאן כשני namespaces, מתעדכנים מה־CI של האתר לפי digest ואף פעם לא נבנים על השרת. בנייה מחדש כתובה: להחיל את ה־Terraform, להחיל את ה־manifests, ואז כל התקנת Helm בגרסה שנרשמה לה.",
    decisions: [
      {
        title: "‏Traefik על השרת, לא מאזן העומסים של Oracle.",
        body: `‏k3s כבר מגיע עם Traefik, אז השרת מקבל את התעבורה שלו בעצמו, ומאזן העומסים היחיד של השכבה החינמית, ‏10 Mbps, נשאר בלי שימוש. כל רשימת היתרים לפי כתובת מקור צריכה עליו ${ltr("externalTrafficPolicy: Local")}, כי ברירת המחדל משכתבת את הכתובת של כל לקוח לכתובת פנימית, ואז הרשימה דוחה את כולם.`,
      },
      {
        title: "ה־manifests לא נוקבים באימג׳ של האתר.",
        body: `השדה הזה שייך ל־CI. בשני ה־${ltr("Deployments")} של האתר אין שדה ${ltr("image")}, כך שהחלה של ה־manifests מעדכנת את כל השאר ולא נוגעת ב־digest שרץ. manifest שהיה כתוב בו ${ltr(":latest")} היה מחזיר את ה־release האחרון מעל מה שה־CI העלה ל־preprod.`,
      },
      {
        title: "הרשאת deploy נפרדת לכל סביבה.",
        body: `‏RBAC נותן פעולות על אובייקטים, לא על שדות, כך שהרשאה לעשות ${ltr("patch")} ל־${ltr("Deployment")} היא הרשאה לשכתב את כל תבנית ה־pod שלו: אסימון deploy שווה את כל מה שיש ב־namespace שלו. לכן ל־preprod ולסביבת הייצור יש חשבון נפרד לכל אחת, שיכול לעדכן רק את ה־namespace שלו, ואת זה של סביבת הייצור אפשר לקרוא רק מתג של release.`,
      },
    ],
    storyLine: "המכונה שמתחת לאתר הזה, כתובה כך שאפשר לבנות אותה שוב.",
  },

  "programming-with-yehuda": {
    fact: "דפי שיעורים שנבנו תוך כדי לימוד React ו־Node.js",
    description: "פרויקט לימודי: אתר קטן של דפי שיעורים בתכנות, שנבנה תוך כדי לימוד React ו־Node.js.",
    status: "פרויקט לימודי",
    highlights: [],
    storyLine: "פרויקט לימודי, שנכתב כדי לתרגל React ו־Node.js.",
  },

  icaros: {
    fact: "אפליקציית ווב למודעות רכב, שנבנתה תוך כדי לימוד React ו־Node.js",
    description:
      "פרויקט לימודי: אפליקציית ווב למודעות רכב, עם פרונטאנד ב־React ובקאנד ב־Node.js ו־MongoDB, שנבנתה תוך כדי לימוד הטכנולוגיות.",
    status: "פרויקט לימודי",
    highlights: [],
    storyLine: "פרויקט לימודי: פרונטאנד ב־React על גבי בקאנד ב־Node.js ו־MongoDB.",
  },
};

/** The story's hand-written beats. Roles by id; lines by position. */
export const STORY_HE: {
  start: { title: string; lines: string[] };
  roles: Record<string, { when: string; title: string; lines: string[] }>;
} = {
  start: { title: "ההתחלה", lines: ["התוכנה הראשונה יצאה לשימוש."] },
  roles: {
    "full-stack": { when: "אחר כך", title: "מהנדס פול־סטאק", lines: ["בונה תוכנה בכל השכבות."] },
    now: {
      when: "עכשיו",
      title: "ראש צוות טכני",
      lines: ["מוביל צוות קטן שבונה ומתפעל תוכנה פנימית.", "ועדיין כותב קוד ועושה code review כל יום."],
    },
  },
};

/*
 * The site copy `heroHebrew` leaves out. "Portfolio" stays Latin: it is the
 * brand word, the first word of the hero's fact line in both languages
 * (data/site.ts).
 * The footer's work labels are names (WindoM, Bothy) and stay names.
 */
export const SITE_HE = {
  phrases: { "Build boldly": "לבנות באומץ", "Keep improving": "להשתפר כל הזמן" } as Record<string, string>,
  intro: [
    {
      label: "עכשיו",
      lines: [
        "אני מהנדס פול־סטאק וראש צוות טכני בתל אביב.",
        "אני מוביל צוות קטן שבונה ומתפעל תוכנה פנימית, ועדיין כותב קוד ועושה code review כל יום. אף פעם לא רציתי את הגרסה של התפקיד שבה מפסיקים.",
      ],
    },
    { label: "לפני כן", lines: ["לפני כן הייתי מהנדס פול־סטאק ב־Momentum Tailored Solutions."] },
    {
      label: "מחוץ לעבודה",
      lines: [
        "מחוץ לעבודה אני בונה מוצרים משלי מקצה לקצה: WindoM, תוסף ל־Chrome שמפורסם ב־Chrome Web Store, ו־Bothy, קונסולה שמדווחת מה רץ בכך שהיא שואלת את Docker, במקום לקרוא רשימה שמישהו צריך לזכור לעדכן.",
      ],
    },
  ],
  principles: [
    {
      claim: "התקנה מאפס, בכל פעם",
      lines: [
        "כל PR ב־Bothy משכפל את המאגר לתיקייה ריקה, מריץ את ההתקנה בת שלוש השורות ותו לא, ואז מריץ כל בדיקה בעץ מול מה שעלה.",
        "משימה לילית חוזרת על זה בנתיב שיש בו רווח ובנתיב בעומק שש רמות, כי כל באג ניידות שהיה במאגר הזה נראה תקין בדיוק בנתיב אחד.",
      ],
    },
    {
      claim: "בדיקה שלא יכולה להיכשל היא לא בדיקה",
      lines: [
        "משימת CI אחת קיימת רק כדי לשתול מוטציה ולדרוש ממשימה אחרת לתפוס אותה.",
        "חבילת בדיקות ירוקה וחבילה שלא מסוגלת להאדים נראות זהות מבחוץ, אז אני הופך את ההבדל למפורש.",
      ],
    },
    {
      claim: "נוצרים בהתקנה, לא נשמרים ב־git",
      lines: [
        "פרטי הגישה נוצרים בזמן ההתקנה, במקום להגיע כערכים זמניים שצריך למלא.",
        "סקריפט ההקמה מדפיס אילו מפתחות הוא כתב ואף פעם לא את הערכים שלהם, כך שאין סיסמת ברירת מחדל שאפשר לשכוח ממנה.",
      ],
    },
  ],
  location: "תל אביב, ישראל",
  availability: "פתוח לשיחות מעניינות",
  /** The footer's work notes, by position. */
  workNotes: ["ב־Chrome Web Store", "באירוח עצמי"],
  colophon: "נבנה עם React ו־TypeScript. רץ על מכונת Arm אחת שאני מנהל בעצמי, מאחורי Traefik ו־cert-manager, עם התוכן ב־CouchDB.",
  colophonNote: "בלי כלי מעקב. בלי הודעת עוגיות, כי אין עוגיות.",
  place: "תל אביב, ישראל",
};
