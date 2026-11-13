import { renderMail, type MailBlock, type MailLang } from "../mail/render.js";
import type { OwnerEvent } from "./hooks.js";

/*
 * Plain wording for the owner's own notices. Nothing here is a legal claim and
 * nothing is addressed to a subscriber. A campaign name is the owner's own text
 * and is shown with anything address-shaped removed.
 */
type Kind = OwnerEvent["kind"];

const SUBJECT: Record<MailLang, Record<Kind | "digest", string>> = {
  en: {
    budget70: "Mail budget: 70% used", budget90: "Mail budget: 90% used", budgetOut: "Mail budget used up",
    bounce: "A bounce or complaint was recorded", campaign: "A campaign finished", subscriber: "A new confirmed subscriber",
    sweep: "The list cleanup failed", digest: "Daily summary",
  },
  he: {
    budget70: "תקציב האימיילים: 70% נוצלו", budget90: "תקציב האימיילים: 90% נוצלו", budgetOut: "תקציב האימיילים נוצל",
    bounce: "נרשם החזר או דיווח ספאם", campaign: "קמפיין הסתיים", subscriber: "נרשם מנוי חדש שאישר",
    sweep: "ניקוי הרשימה נכשל", digest: "סיכום יומי",
  },
};

export const safeName = (s: string): string => s.replace(/\S+@\S+/g, "…").replace(/\s+/g, " ").trim().slice(0, 80);

export function lineOf(e: OwnerEvent, lang: MailLang): string {
  const he = lang === "he";
  switch (e.kind) {
    case "budget70":
    case "budget90":
      return he ? `נוצלו ${e.used} מתוך ${e.usable} אימיילים החודש.` : `${e.used} of ${e.usable} emails used this month.`;
    case "budgetOut":
      return e.scope === "month"
        ? he ? "תקציב החודש נוצל. קמפיינים ימתינו לחודש הבא; אישורי הרשמה ממשיכים מהחלק השמור." : "This month's budget is used. Campaigns wait for next month; confirmations carry on from the reserved share."
        : he ? "תקציב היום נוצל. קמפיינים ימשיכו כשיתפנה מקום; אישורי הרשמה ממשיכים מהחלק השמור." : "Today's budget is used. Campaigns carry on when there is room; confirmations carry on from the reserved share.";
    case "bounce":
      return he
        ? `${e.reason === "complaint" ? "דיווח ספאם" : "החזר קבוע"}. הכתובת הוסרה מהרשימה (מזהה ${e.ref}).`
        : `${e.reason === "complaint" ? "Spam complaint" : "Hard bounce"}. The address was removed from the list (ref ${e.ref}).`;
    case "campaign": {
      const n = safeName(e.name);
      return he
        ? `${e.status === "failed" ? "נכשל" : "הסתיים"}: ${n}. נשלחו ${e.sent}, נכשלו ${e.failed}, דולגו ${e.suppressed}.`
        : `${e.status === "failed" ? "Failed" : "Finished"}: ${n}. Sent ${e.sent}, failed ${e.failed}, skipped ${e.suppressed}.`;
    }
    case "subscriber":
      return he ? `מנוי חדש אישר את ההרשמה (מזהה ${e.ref}).` : `A new subscriber confirmed (ref ${e.ref}).`;
    case "sweep":
      return he ? "המחיקה המתוזמנת של הרשמות שלא אושרו נכשלה. אפשר לבדוק ביומן השרת." : "The scheduled cleanup of unconfirmed signups failed. Check the server log.";
  }
}

/** One notice for one event, or the daily summary for many. */
export function composeOwnerMail(entries: OwnerEvent[], lang: MailLang, o: { held?: number; link: string; digest?: boolean }) {
  const he = lang === "he";
  const subject = SUBJECT[lang][o.digest ? "digest" : entries[0].kind];
  const blocks: MailBlock[] = [{ type: "paragraph", tone: "kicker", text: he ? "הודעה לבעל האתר" : "Owner notice" }, { type: "heading", text: subject }];
  if (o.digest) {
    const subs = entries.filter((e) => e.kind === "subscriber").length;
    const bounces = entries.filter((e) => e.kind === "bounce").length;
    blocks.push({
      type: "list",
      items: [
        ...(subs ? [he ? `${subs} מנויים חדשים אישרו.` : `${subs} new confirmed subscribers.`] : []),
        ...(bounces ? [he ? `${bounces} החזרים או דיווחי ספאם.` : `${bounces} bounces or complaints.`] : []),
        ...entries.filter((e) => e.kind === "campaign").map((e) => lineOf(e, lang)),
      ],
    });
  } else {
    blocks.push({ type: "paragraph", text: lineOf(entries[0], lang) });
    if (o.held) blocks.push({ type: "paragraph", tone: "muted", text: he ? `עוד ${o.held} אירועים דומים מאז ההודעה הקודמת.` : `${o.held} more similar events since the last notice.` });
  }
  blocks.push({ type: "button", label: he ? "פתיחת השיווק" : "Open Marketing", href: o.link });
  blocks.push({ type: "paragraph", tone: "muted", text: he ? "ההודעה מכילה מספרים בלבד, בלי כתובות של מנויים. אפשר לשנות אילו הודעות מגיעות בהגדרות." : "This notice holds counts only, never a subscriber's address. Change which notices arrive in Settings." });
  const { html, text } = renderMail(blocks, { lang, title: subject, preheader: subject });
  return { subject, html, text };
}
