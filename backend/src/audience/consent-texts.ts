import { createHash } from "node:crypto";

/*
 * Every wording of the signup consent sentence that has ever been shown, with
 * the hash of what it said. APPEND ONLY: a wording change is a new entry with
 * a new id, never an edit, because a contact's record points at an id and must
 * keep meaning exactly what that person saw. consent-texts.test.ts fails when
 * the sentence in web/src/i18n/subscribe.ts stops matching the newest entry.
 *
 * The sentence is the web's `consentBefore` + " " + `consentLink` (the link
 * text is read before the button, so it is part of what was agreed to).
 */
export type ConsentText = {
  id: string;
  he: string;
  en: string;
  /** sha256 hex of `he + "\n" + en`; see consentTextHash. */
  sha256: string;
  /** The commit that first shipped this wording. */
  firstShippedIn: string;
};

export const consentTextHash = (he: string, en: string) => createHash("sha256").update(`${he}\n${en}`, "utf8").digest("hex");

export const CONSENT_TEXTS: readonly ConsentText[] = [
  {
    id: "site-form-v1",
    he: "אשתמש בכתובת שלכם רק כדי לשלוח את מה שבחרתם למעלה. קודם נשלח אימייל אחד לאישור הכתובת, ובכל אימייל יש קישור להסרה. ראו איך המידע שלכם מטופל",
    en: "I’ll use your address only to send what you chose above. We’ll first send one email to confirm it, and every email has an unsubscribe link. See how your data is handled",
    sha256: "9071bf6e6c55960b3c335d0ad6406046463dde78b9c6dc34a5a32eb1863613c4",
    firstShippedIn: "09a4588",
  },
  {
    id: "site-form-v2",
    he: "בהרשמה אתם מסכימים לקבל את העלון שלי באימייל: הרשימות והגרסאות שבחרתם. קודם אשלח אימייל אחד לאישור הכתובת, ובכל אימייל יש קישור להסרה. איך אני מטפל במידע",
    en: "By subscribing you agree to receive my newsletter by email: the notes and releases you chose. I’ll first send one email to confirm your address, and every email has an unsubscribe link. How I handle your data",
    sha256: "fb089b7aa9e45b421101f96d6b89642756c7fc635335a22eca2095080837ffb5",
    /* The base commit of the change that introduced it; the merge commit is not known until it is merged. */
    firstShippedIn: "be589bd",
  },
];

/** The wording the signup form shows today: always the last entry. */
export const CURRENT_CONSENT_TEXT_ID = CONSENT_TEXTS[CONSENT_TEXTS.length - 1].id;

export const getConsentText = (id: unknown): ConsentText | undefined =>
  typeof id === "string" ? CONSENT_TEXTS.find((t) => t.id === id) : undefined;
