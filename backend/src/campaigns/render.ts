import type { SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { fillTemplate, hasLink, unsubscribeUrls } from "../audience/mail.js";
import type { Lang } from "../audience/schemas.js";
import { esc } from "../announce/emailHtml.js";
import { renderBody } from "./body.js";
import type { Campaign } from "./schemas.js";

/* The Hebrew spam-law label that opens a commercial mail's subject and its footer. Owner to approve. */
export const COMMERCIAL_LABEL_HE = "פרסומת";

/*
 * Appended when the saved note has no {link}: a footer without a visible
 * unsubscribe link must never go out, whatever was saved. DRAFT wording,
 * owner to approve.
 */
export const UNSUB_FALLBACK_EN = "To stop receiving these emails, unsubscribe here: {link}";
export const UNSUB_FALLBACK_HE = "כדי להפסיק לקבל הודעות אלה, בטלו את ההרשמה כאן: {link}";

const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, " ").trim();

export type RenderedMail = { subject: string; text: string; html: string; headers: Record<string, string> };

/**
 * One recipient's copy. Every interpolated field is escaped; the only markup
 * is the sanitised body the owner wrote and the footer built here. The
 * unsubscribe link is personal (a signed `unsub` token with a long expiry).
 */
export async function renderCampaignMail(
  c: Pick<Campaign, "subject" | "preheader" | "bodyText" | "blocks">,
  contact: { lang: Lang },
  hash: string,
  sender: SenderSettings,
  opts: { subjectPrefix?: string } = {},
): Promise<RenderedMail> {
  const lang = contact.lang;
  const he = lang === "he";
  const label = he && sender.commercialLabel;
  const urls = await unsubscribeUrls(hash);
  const site = new URL(env.SITE_URL).host;
  const vars = { name: "", site, days: "", link: urls.page };
  const note = he ? sender.unsubscribeNoteHe : sender.unsubscribeNoteEn;
  const missingLink = !hasLink(note);
  const fallback = he ? UNSUB_FALLBACK_HE : UNSUB_FALLBACK_EN;
  const identity = sender.footerIdentity.trim();

  const subject = `${opts.subjectPrefix ?? ""}${label ? `${COMMERCIAL_LABEL_HE}: ` : ""}${oneLine(c.subject)}`;

  const footerHtml =
    `<hr style="border:0;border-top:1px solid #d9d9d9;margin:28px 0 14px">` +
    `<div style="font-size:12px;line-height:1.5;color:#6b6b6b">` +
    (label ? `<p style="margin:0 0 8px">${COMMERCIAL_LABEL_HE}</p>` : "") +
    (identity ? `<p style="margin:0 0 8px">${esc(identity).replace(/\r?\n/g, "<br>")}</p>` : "") +
    `<p style="margin:0">${fillTemplate(note, vars, true)}</p>` +
    (missingLink ? `<p style="margin:8px 0 0">${fillTemplate(fallback, vars, true)}</p>` : "") +
    `</div>`;
  const pre = c.preheader?.trim();
  const html =
    `<div lang="${he ? "he" : "en"}" dir="${he ? "rtl" : "ltr"}" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55">` +
    (pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>` : "") +
    renderBody(c) +
    footerHtml +
    `</div>`;
  const text =
    `${c.bodyText.trim()}\n\n--\n` +
    (label ? `${COMMERCIAL_LABEL_HE}\n` : "") +
    (identity ? `${identity}\n` : "") +
    fillTemplate(note, vars, false) +
    (missingLink ? `\n\n${fillTemplate(fallback, vars, false)}` : "");

  return {
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${urls.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      Precedence: "bulk",
    },
  };
}
