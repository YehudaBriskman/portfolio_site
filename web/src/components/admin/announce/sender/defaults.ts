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
  testRecipients: [],
  throttlePerHour: 60,
  dailyCap: 200,
  maxPerContact30d: 4,
  dailyLimit: 90,
  monthlyLimit: 2700,
  safety: 0.9,
  reserveShare: 0.2,
  autoDraftCampaign: false,
  labelMode: "hebrew",
  pendingTtlDays: 7,
  confirmSubjectEn: "Confirm your subscription",
  confirmSubjectHe: "אישור הרשמה",
  confirmBodyEn:
    "Hi {name},\n\nSomeone (hopefully you) asked to get updates from {site}. To confirm your subscription, open this link:\n\n{link}\n\nIf this was not you, ignore this message and nothing will happen. The link works for {days} days.",
  confirmBodyHe:
    "שלום {name},\n\nמישהו (כנראה אתם) ביקש לקבל עדכונים מהאתר {site}. כדי לאשר את ההרשמה, פתחו את הקישור:\n\n{link}\n\nאם זה לא אתם, התעלמו מהודעה זו ולא יקרה דבר. הקישור תקף {days} ימים.",
  unsubscribeNoteEn: "You get this because you subscribed on {site}. To stop receiving these emails, unsubscribe here: {link}",
  unsubscribeNoteHe: "קיבלתם הודעה זו כי נרשמתם לעדכונים באתר {site}. כדי להפסיק לקבל אותה, בטלו את ההרשמה כאן: {link}",
};

export type SenderField =
  | "fromName" | "fromAddress" | "replyTo" | "footerIdentity" | "identityEmail" | "testRecipients" | "throttlePerHour" | "dailyCap" | "maxPerContact30d" | "quietHours" | "dailyLimit" | "monthlyLimit" | "safety" | "reserveShare"
  | "confirmSubjectEn" | "confirmSubjectHe" | "confirmBodyEn" | "confirmBodyHe" | "unsubscribeNoteEn" | "unsubscribeNoteHe";
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
  if (s.testRecipients.length > 5 || s.testRecipients.some((a) => !EMAIL.test(a))) p.testRecipients = "list";
  if (!whole(s.throttlePerHour, 3600)) p.throttlePerHour = "number";
  if (!whole(s.dailyCap, 10000)) p.dailyCap = "number";
  if (!whole(s.maxPerContact30d, 31, 0)) p.maxPerContact30d = "number";
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
