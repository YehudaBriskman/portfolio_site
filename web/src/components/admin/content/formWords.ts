import { defineWords } from "@/i18n/words";
import { useLang } from "@/components/dashboard/i18n";

/*
 * The content editors' form text in both languages: field labels, hints,
 * group titles, "Add a ..." buttons and the page intros.
 *
 * The pages write these as English literals next to the schema path they
 * belong to, which is how a form stays readable; the fields look them up here
 * (`useFormText`) and show the Hebrew when the page is Hebrew. The English
 * table is the keys themselves, so a label is written once. A literal with no
 * entry shows as written (a name the owner typed), and the Hebrew coverage
 * test (`pages/__tests__/AdminHebrew.coverage.test.tsx`) fails on a label that
 * has none, so a new one cannot ship untranslated by accident.
 *
 * A label that ends in a number ("Phrase 2") is looked up without it.
 * The Hebrew is a first draft for the owner's review.
 */
const HE: Record<string, string> = {
  "A key: live, in-use, open-source, in-progress, released or archive. Or a release tag (v1.2.0). The site shows a word for it in each language.":
    "מפתח: live, in-use, open-source, in-progress, released או archive, או תג גרסה (v1.2.0). האתר מציג לו מילה בכל שפה.",
  "A picture from the library, /img/… or https://…": "תמונה מהספרייה, /img/… או https://…",
  "A picture from the library, /projects/… or https://…; empty for none.": "תמונה מהספרייה, /projects/… או https://…; ריק אם אין.",
  "A principle's figure is drawn for its English claim; a new claim gets no figure until one is drawn.":
    "האיור של עיקרון מצויר לפי הטענה באנגלית; לטענה חדשה אין איור עד שמציירים אחד.",
  "A short phrase between two beats, written in both languages.": "משפט קצר בין שני שלבים, כתוב בשתי השפות.",
  "Accessible name": "שם נגיש",
  "Add a decision": "הוספת החלטה",
  "Add a field": "הוספת שדה",
  "Add a highlight": "הוספת הדגשה",
  "Add a layout": "הוספת פריסה",
  "Add a line": "הוספת שורה",
  "Add a link": "הוספת קישור",
  "Add a photograph": "הוספת תצלום",
  "Add a phrase": "הוספת משפט",
  "Add a principle": "הוספת עיקרון",
  "Add a profile": "הוספת פרופיל",
  "Add a project": "הוספת פרויקט",
  "Add a role": "הוספת תפקיד",
  "Add a section": "הוספת אזור",
  "Add an interlude": "הוספת אינטרלוד",
  "After beat": "אחרי השלב",
  "Alt text": "טקסט חלופי",
  Availability: "זמינות",
  Beat: "שלב",
  Blue: "כחול",
  Body: "תוכן",
  Card: "כרטיס",
  Claim: "טענה",
  Colophon: "קולופון",
  "Colophon note": "הערת קולופון",
  "Comma-separated, in the order shown.": "מופרדים בפסיקים, לפי סדר ההצגה.",
  Contact: "יצירת קשר",
  Decisions: "החלטות",
  Description: "תיאור",
  Email: "אימייל",
  Fact: "עובדה",
  Footer: "תחתית",
  Green: "ירוק",
  Heading: "כותרת",
  Hero: "פתיח",
  Highlight: "הדגשה",
  Highlights: "הדגשות",
  "How I work": "איך אני עובד",
  "How a beat's photograph sits beside its text. A beat with none uses the default.":
    "איך התצלום של שלב מונח לצד הטקסט שלו. שלב בלי פריסה משתמש בברירת המחדל.",
  Id: "מזהה",
  Image: "תמונה",
  "In the nav and the footer": "בניווט ובתחתית",
  "In the order they come after the projects": "לפי הסדר שבו הם באים אחרי הפרויקטים",
  Interludes: "אינטרלודים",
  Kind: "סוג",
  Label: "תווית",
  "Label fields (one to three)": "שדות תווית (אחד עד שלושה)",
  Layout: "פריסה",
  Layouts: "פריסות",
  Line: "שורה",
  "Line on the story page": "שורה בעמוד הסיפור",
  Lines: "שורות",
  Links: "קישורים",
  Location: "מיקום",
  "Main link": "קישור ראשי",
  "Main link label": "תווית הקישור הראשי",
  Mark: "סמל",
  "More links": "עוד קישורים",
  "My role": "התפקיד שלי",
  Name: "שם",
  "New decision": "החלטה חדשה",
  "New highlight": "הדגשה חדשה",
  "New line": "שורה חדשה",
  "New link": "קישור חדש",
  "New phrase": "משפט חדש",
  "New principle": "עיקרון חדש",
  "New profile": "פרופיל חדש",
  "New section": "אזור חדש",
  Note: "הערה",
  "One-line fact": "עובדה בשורה אחת",
  "Order on the site": "הסדר באתר",
  Photographs: "תצלומים",
  Phrase: "משפט",
  "Phrases beside the light": "משפטים לצד האור",
  "Pinned to beats": "מוצמד לשלבים",
  Place: "מקום",
  Principles: "עקרונות",
  Profiles: "פרופילים",
  "Preview this project": "תצוגה מקדימה של הפרויקט",
  Red: "אדום",
  "Reply within": "זמן מענה",
  Repository: "מאגר",
  Roles: "תפקידים",
  Sections: "אזורים",
  "Shipping since": "משיק מאז",
  "Site copy": "טקסטים באתר",
  Slug: "כתובת",
  State: "מצב",
  "Status line": "שורת מצב",
  Tech: "טכנולוגיות",
  "The address: /projects/<slug>": "הכתובת: /projects/<slug>",
  "The case": "המקרה",
  "The hero, How I work, the contact plate, the profiles and the footer. English is required; Hebrew is optional and falls back to English.":
    "הפתיח, איך אני עובד, לוחית יצירת הקשר, הפרופילים והתחתית. אנגלית חובה; עברית אופציונלית וחוזרת לאנגלית כשהיא ריקה.",
  "The opening": "הפתיחה",
  "The outcome": "התוצאה",
  "The page at /story. English is required; Hebrew is optional and falls back to English, except in an interlude, which is written in both.":
    "העמוד ב־/story. אנגלית חובה; עברית אופציונלית וחוזרת לאנגלית, חוץ מאינטרלוד, שנכתב בשתיהן.",
  "The problem": "הבעיה",
  "The projects on the home page, the work page and each project page. English is required; Hebrew is optional and falls back to English. Images are paths or https URLs.":
    "הפרויקטים בעמוד הבית, בעמוד העבודות ובעמוד של כל פרויקט. אנגלית חובה; עברית אופציונלית וחוזרת לאנגלית. תמונות הן נתיבים או כתובות https.",
  "The sentence /story tells about this project.": "המשפט ש־/story מספר על הפרויקט.",
  Title: "כותרת",
  "Tint (red, green, blue: 0 to 255)": "גוון (אדום, ירוק, כחול: 0 עד 255)",
  Untitled: "ללא כותרת",
  Value: "ערך",
  When: "מתי",
  Where: "איפה",
  Words: "מילים",
  "Work links": "קישורי עבודה",
  Year: "שנה",
};
const EN: Record<string, string> = Object.fromEntries(Object.keys(HE).map((k) => [k, k]));

export const useFormWords = defineWords(
  "contentForm",
  { text: EN, english: "English", hebrewOptional: "Hebrew (optional)" },
  { text: HE, english: "אנגלית", hebrewOptional: "עברית (לא חובה)" },
);

/**
 * The text a form shows for an English literal: itself in English, its
 * Hebrew in Hebrew, and itself when it has no entry.
 */
export function useFormText(): (s: string) => string {
  const lang = useLang();
  const { text } = useFormWords();
  if (lang === "en") return (s) => s;
  return (s) => {
    if (s in text) return text[s];
    const m = /^(.*\S) (\d+)$/.exec(s);
    return m && m[1] in text ? `${text[m[1]]} ${m[2]}` : s;
  };
}
