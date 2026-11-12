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
  testRecipients: [],
  throttlePerHour: 60,
  dailyCap: 200,
  autoDraftCampaign: false,
  commercialLabel: true,
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
  | "fromName" | "fromAddress" | "replyTo" | "footerIdentity" | "testRecipients" | "throttlePerHour" | "dailyCap" | "quietHours"
  | "confirmSubjectEn" | "confirmSubjectHe" | "confirmBodyEn" | "confirmBodyHe" | "unsubscribeNoteEn" | "unsubscribeNoteHe";
export type SenderProblem = "empty" | "address" | "number" | "list" | "zone";

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const zoneOk = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const whole = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max;

/** The same rules as the server's schema, so a bad value is named before Save rather than after. */
export function senderProblems(s: SenderSettings): Partial<Record<SenderField, SenderProblem>> {
  const p: Partial<Record<SenderField, SenderProblem>> = {};
  if (s.fromAddress && !EMAIL.test(s.fromAddress)) p.fromAddress = "address";
  if (s.replyTo && !EMAIL.test(s.replyTo)) p.replyTo = "address";
  if (s.testRecipients.length > 5 || s.testRecipients.some((a) => !EMAIL.test(a))) p.testRecipients = "list";
  if (!whole(s.throttlePerHour, 3600)) p.throttlePerHour = "number";
  if (!whole(s.dailyCap, 10000)) p.dailyCap = "number";
  if (s.quietHours && !zoneOk(s.quietHours.tz)) p.quietHours = "zone";
  for (const k of ["confirmSubjectEn", "confirmSubjectHe", "confirmBodyEn", "confirmBodyHe", "unsubscribeNoteEn", "unsubscribeNoteHe"] as const) if (!s[k].trim()) p[k] = "empty";
  return p;
}
