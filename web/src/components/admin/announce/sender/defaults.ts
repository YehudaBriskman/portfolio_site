import type { SenderSettings } from "@/services/adminAnnounce";

/*
 * What the server resets a field to (backend/src/announce/schemas.ts
 * DEFAULT_SENDER), for the per-field "Reset to default". The server remains
 * the authority: this only decides what a reset button puts in the box.
 */
export const DEFAULT_SENDER: SenderSettings = {
  fromName: "",
  fromAddress: "",
  replyTo: "",
  footerIdentity: "",
  identityEmail: "",
  identityPostal: "",
  identityWebsite: "",
  identityLinkedin: "",
  identityPhone: "",
  testRecipients: [],
  throttlePerHour: 60,
  dailyCap: 200,
  maxPerContact30d: 4,
  dailyLimit: 90,
  monthlyLimit: 2700,
  safety: 0.9,
  reserveShare: 0.2,
  autoDraftCampaign: false,
  labelMode: "off",
  pendingTtlDays: 7,
  confirmSubjectEn: "Confirm your subscription",
  confirmSubjectHe: "אישור הרשמה",
  confirmBodyEn:
    "Hi {name},\n\nSomeone asked to get my newsletter (notes and releases) from {site} at this address, hopefully you. To confirm, open this link:\n\n{link}\n\nIf it was not you, ignore this message: nothing is added and the request is deleted. The link works for {days} days. How your data is handled: {site}/privacy",
  confirmBodyHe:
    "שלום {name},\n\nהתקבלה בקשה לקבל מהאתר {site} את העלון שלי (רשימות וגרסאות חדשות) באימייל לכתובת הזו. כדי לאשר, פתחו את הקישור:\n\n{link}\n\nאם לא ביקשתם, אפשר להתעלם מהודעה זו: לא תתווסף שום כתובת והבקשה תימחק. הקישור תקף {days} ימים. איך המידע מטופל: {site}/privacy",
  unsubscribeNoteEn: "You get this because you subscribed on {site}. Unsubscribe in one click: {link}",
  unsubscribeNoteHe: "קיבלתם הודעה זו כי נרשמתם באתר {site}. להסרה בלחיצה אחת: {link}",
};

export type SenderField =
  | "fromName" | "fromAddress" | "replyTo" | "footerIdentity" | "identityEmail" | "identityWebsite" | "identityLinkedin" | "identityPhone" | "testRecipients" | "throttlePerHour" | "dailyCap" | "maxPerContact30d" | "pendingTtlDays" | "quietHours" | "dailyLimit" | "monthlyLimit" | "safety" | "reserveShare"
  | "confirmSubjectEn" | "confirmSubjectHe" | "confirmBodyEn" | "confirmBodyHe" | "unsubscribeNoteEn" | "unsubscribeNoteHe";
/** The optional contact lines, in footer order, with the words each one uses. */
export const CONTACT_FIELDS = [
  { f: "identityWebsite", label: "idWebsite", hint: "idWebsiteHint", bad: "badWebsite", type: "url" },
  { f: "identityLinkedin", label: "idLinkedin", hint: "idLinkedinHint", bad: "badLinkedin", type: "url" },
  { f: "identityPhone", label: "idPhone", hint: "idPhoneHint", bad: "badPhone", type: "tel" },
] as const;
export type SenderProblem = "empty" | "address" | "number" | "list" | "zone" | "noLink" | "unknown" | "long" | "unsubVars" | "monthBelowDay";

/* Mirrors validateSenderTexts in backend/src/announce/schemas.ts; the server decides, this only names it before Save. */
export const UNSUB_NOTE_MAX = 500;
const TOKEN = /\{+[^{}]*\}+|[{}]/g;
const KNOWN = ["{name}", "{site}", "{days}", "{link}"];
/** The first `{...}` that is not a known placeholder, or null. Case-sensitive, so {Link} and {{link}} are named. */
export const unknownPlaceholder = (text: string) => (text.match(TOKEN) ?? []).find((t) => !KNOWN.includes(t)) ?? null;
export const TEXT_FIELDS = ["confirmBodyEn", "confirmBodyHe", "unsubscribeNoteEn", "unsubscribeNoteHe"] as const;
/** True when a text field has a problem that is about the unsubscribe or confirm link, for the campaign checklist. */
export const hasTextProblem = (s: SenderSettings) => {
  const p = senderProblems(s);
  return TEXT_FIELDS.some((f) => p[f] && p[f] !== "empty");
};

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const PHONE = /^\+?[0-9][0-9 ().-]{4,30}[0-9]$/;
/** Mirrors httpsUrl in backend/src/announce/schemas.ts. */
const httpsHost = (raw: string): string | null => {
  // eslint-disable-next-line no-control-regex -- same refusal list as the server
  if (/[\s\u0000-\u001f\u007f<>"']/.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && u.hostname.includes(".") ? u.hostname : null;
  } catch {
    return null;
  }
};
export const websiteOk = (v: string) => !v.trim() || httpsHost(v.trim()) !== null;
export const linkedinOk = (v: string) => !v.trim() || /(^|\.)linkedin\.com$/i.test(httpsHost(v.trim()) ?? "");
export const phoneOk = (v: string) => !v.trim() || PHONE.test(v.trim());
/** The footer's contact lines; mirrors contactLines on the server. */
export const contactLines = (s: SenderSettings): string[] =>
  [s.footerIdentity, s.identityPostal, s.identityEmail, s.identityPhone, s.identityWebsite, s.identityLinkedin].map((l) => l.trim()).filter(Boolean);

/** What the footer still lacks; mirrors missingIdentity on the server, which is the real gate. The postal line is never required. */
export const identityMissing = (s: Pick<SenderSettings, "footerIdentity" | "identityEmail">): ("name" | "email")[] => [
  ...(s.footerIdentity.trim() ? [] : (["name"] as const)),
  ...(EMAIL.test(s.identityEmail.trim()) ? [] : (["email"] as const)),
];
const zoneOk = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const whole = (n: number, max: number, min = 1) => Number.isInteger(n) && n >= min && n <= max;

/** The same rules as the server's schema, so a bad value is named before Save rather than after. */
export function senderProblems(s: SenderSettings): Partial<Record<SenderField, SenderProblem>> {
  const p: Partial<Record<SenderField, SenderProblem>> = {};
  if (s.fromAddress && !EMAIL.test(s.fromAddress)) p.fromAddress = "address";
  if (s.replyTo && !EMAIL.test(s.replyTo)) p.replyTo = "address";
  if (s.identityEmail.trim() && !EMAIL.test(s.identityEmail.trim())) p.identityEmail = "address";
  if (!websiteOk(s.identityWebsite)) p.identityWebsite = "address";
  if (!linkedinOk(s.identityLinkedin)) p.identityLinkedin = "address";
  if (!phoneOk(s.identityPhone)) p.identityPhone = "address";
  if (s.testRecipients.length > 5 || s.testRecipients.some((a) => !EMAIL.test(a))) p.testRecipients = "list";
  if (!whole(s.throttlePerHour, 3600)) p.throttlePerHour = "number";
  if (!whole(s.dailyCap, 10000)) p.dailyCap = "number";
  if (!whole(s.maxPerContact30d, 31, 0)) p.maxPerContact30d = "number";
  if (!whole(s.pendingTtlDays, 30, 2)) p.pendingTtlDays = "number";
  if (s.quietHours && !zoneOk(s.quietHours.tz)) p.quietHours = "zone";
  /* Mirrors validateSenderBudget on the server. */
  if (!whole(s.dailyLimit, 100000)) p.dailyLimit = "number";
  if (!whole(s.monthlyLimit, 1000000)) p.monthlyLimit = "number";
  else if (whole(s.dailyLimit, 100000) && s.monthlyLimit < s.dailyLimit) p.monthlyLimit = "monthBelowDay";
  if (!(Number.isFinite(s.safety) && s.safety >= 0.5 && s.safety <= 1)) p.safety = "number";
  if (!(Number.isFinite(s.reserveShare) && s.reserveShare >= 0 && s.reserveShare <= 0.5)) p.reserveShare = "number";
  for (const k of ["confirmSubjectEn", "confirmSubjectHe", "confirmBodyEn", "confirmBodyHe", "unsubscribeNoteEn", "unsubscribeNoteHe"] as const) {
    const v = s[k];
    const note = k.startsWith("unsubscribeNote");
    if (!v.trim()) p[k] = "empty";
    else if (k.startsWith("confirmSubject")) continue;
    else if (!v.includes("{link}")) p[k] = "noLink";
    else if (unknownPlaceholder(v)) p[k] = "unknown";
    else if (note && v.length > UNSUB_NOTE_MAX) p[k] = "long";
    else if (note && /\{(name|days)\}/.test(v)) p[k] = "unsubVars";
  }
  return p;
}
