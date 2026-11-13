import { contactLines, type LabelMode, type SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { fillParts, hasLink, unsubscribeUrls } from "../audience/mail.js";
import type { Lang } from "../audience/schemas.js";
import { oneLine } from "../mail/escape.js";
import { renderMail, type Inline, type MailBlock } from "../mail/render.js";
import { bodyBlocks } from "./body.js";
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
  const identityLines = contactLines(sender);

  const subject = `${opts.subjectPrefix ?? ""}${label ? `${label.subject}: ` : ""}${oneLine(c.subject)}`;

  const blocks: MailBlock[] = [
    ...(label ? [{ type: "paragraph" as const, tone: "strong" as const, text: label.line }] : []),
    ...bodyBlocks(c),
    { type: "footer", lines: identityLines, note: fillParts(note, vars), ...(missingLink ? { extra: [fillParts(fallback, vars)] } : {}) },
  ];
  const { html, text } = renderMail(blocks, { lang, title: c.subject, ...(c.preheader?.trim() ? { preheader: c.preheader } : {}) });

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
