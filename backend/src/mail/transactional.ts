import { renderMail, type MailBlock, type MailLang } from "./render.js";

/*
 * The one-off mails that are not a campaign: the notice the owner gets from
 * the contact form and the auto-reply the visitor gets. Both are blocks for
 * the one renderer; the contact block (name, address, links) is the footer.
 * The confirmation mail lives beside its token code (audience/mail.ts).
 */

export type NoticeInput = {
  subject: string;
  title?: string;
  body: string;
  ctaText?: string;
  ctaHref?: string;
  /** The visitor's address, shown so the owner knows who "reply" goes to. */
  replyTo?: string;
};

/** What the owner reads. Each blank-line-separated part is its own paragraph; line breaks inside it are kept. */
export function renderContactNotice(n: NoticeInput, footerLines: string[] = []) {
  const blocks: MailBlock[] = [
    { type: "paragraph", tone: "kicker", text: "Contact form" },
    { type: "heading", text: n.title?.trim() || n.subject },
    ...n.body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text): MailBlock => ({ type: "paragraph", text })),
    ...(n.ctaHref ? [{ type: "button" as const, label: n.ctaText?.trim() || "Open", href: n.ctaHref }] : []),
    ...(n.replyTo ? [{ type: "paragraph" as const, tone: "muted" as const, text: "Reply to this email to answer the sender." }] : []),
    ...(footerLines.length ? [{ type: "footer" as const, lines: footerLines }] : []),
  ];
  const first = n.body.trim().split(/\r?\n/).find(Boolean) ?? n.subject;
  return renderMail(blocks, { lang: "en", title: n.subject, preheader: first.slice(0, 140) });
}

/* Owner-approved wording. */
export const AUTO_REPLY = {
  en: { subject: "Got your message", heading: "Got your message", body: "Thanks for writing. I read every message myself and will get back to you soon." },
  he: { subject: "קיבלתי את ההודעה שלכם", heading: "קיבלתי את ההודעה שלכם", body: "תודה שכתבתם. אני קורא כל הודעה בעצמי ואחזור אליכם בהקדם." },
} as const;

/** The form carries no language; a message written in Hebrew gets the Hebrew reply. */
export const guessLang = (...samples: (string | undefined)[]): MailLang => (/[֐-׿]/.test(samples.join(" ")) ? "he" : "en");

/** Thanks and what happens next, never the visitor's own message. */
export function renderAutoReply(lang: MailLang, footerLines: string[] = []) {
  const t = AUTO_REPLY[lang];
  const blocks: MailBlock[] = [
    { type: "heading", text: t.heading },
    { type: "paragraph", text: t.body },
    ...(footerLines.length ? [{ type: "footer" as const, lines: footerLines }] : []),
  ];
  const { html, text } = renderMail(blocks, { lang, title: t.subject, preheader: t.body });
  return { subject: t.subject, html, text };
}
