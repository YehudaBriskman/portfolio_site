import type { LabelMode, SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { fillTemplate, hasLink, unsubscribeUrls } from "../audience/mail.js";
import type { Lang } from "../audience/schemas.js";
import { esc } from "../announce/emailHtml.js";
import { renderBody } from "./body.js";
import type { Campaign } from "./schemas.js";

/*
 * The spam-law label: the Hebrew word opens the subject AND is the first
 * visible line of the body. English mail (mode "all") carries the Hebrew word
 * first, then an English one. DRAFT wording, owner to approve; nothing legal
 * is final.
 */
export const COMMERCIAL_LABEL_HE = "פרסומת";
export const LABEL_SUBJECT_EN = "פרסומת | Ad";
export const LABEL_BODY_EN = "פרסומת | Advertisement";

/** The label for one recipient, or null when the policy does not call for it. */
export function labelFor(mode: LabelMode, lang: Lang): { subject: string; line: string } | null {
  if (mode === "off" || (mode === "hebrew" && lang !== "he")) return null;
  return lang === "he" ? { subject: COMMERCIAL_LABEL_HE, line: COMMERCIAL_LABEL_HE } : { subject: LABEL_SUBJECT_EN, line: LABEL_BODY_EN };
}

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
  const label = labelFor(sender.labelMode, lang);
  const urls = await unsubscribeUrls(hash);
  const site = new URL(env.SITE_URL).host;
  const vars = { name: "", site, days: "", link: urls.page };
  const note = he ? sender.unsubscribeNoteHe : sender.unsubscribeNoteEn;
  const missingLink = !hasLink(note);
  const fallback = he ? UNSUB_FALLBACK_HE : UNSUB_FALLBACK_EN;
  const identityLines = [sender.footerIdentity.trim(), sender.identityPostal.trim(), sender.identityEmail.trim()].filter(Boolean);

  const subject = `${opts.subjectPrefix ?? ""}${label ? `${label.subject}: ` : ""}${oneLine(c.subject)}`;

  const footerHtml =
    `<hr style="border:0;border-top:1px solid #d9d9d9;margin:28px 0 14px">` +
    `<div style="font-size:12px;line-height:1.5;color:#6b6b6b">` +
    (identityLines.length ? `<p style="margin:0 0 8px">${identityLines.map((l) => esc(l).replace(/\r?\n/g, "<br>")).join("<br>")}</p>` : "") +
    `<p style="margin:0">${fillTemplate(note, vars, true)}</p>` +
    (missingLink ? `<p style="margin:8px 0 0">${fillTemplate(fallback, vars, true)}</p>` : "") +
    `</div>`;
  const pre = c.preheader?.trim();
  const html =
    `<div lang="${he ? "he" : "en"}" dir="${he ? "rtl" : "ltr"}" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55">` +
    (pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>` : "") +
    (label ? `<p style="margin:0 0 16px;font-weight:700">${esc(label.line)}</p>` : "") +
    renderBody(c) +
    footerHtml +
    `</div>`;
  const text =
    (label ? `${label.line}\n\n` : "") +
    `${c.bodyText.trim()}\n\n--\n` +
    identityLines.map((l) => `${l}\n`).join("") +
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
