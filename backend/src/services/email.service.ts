import { getProvider } from "../providers/index.js";
import { renderBasicTemplate } from "../templates/basic.js";
import type { SendEmailInput } from "../types/index.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import type { SmtpErrorKind } from "../providers/classifySmtpError.js";
import { allowAutoReply, releaseAutoReply, releaseNotice, reserveAutoReply, reserveNotice } from "./contactGuard.js";

type EmailJsPayload = Extract<SendEmailInput, { templateId: string }>;

const isEmailJsPayload = (input: SendEmailInput): input is EmailJsPayload => "templateId" in input;

function composeBody(input: SendEmailInput): { html?: string; text?: string } {
  if ("template" in input && input.template) return renderBasicTemplate(input.template.params);
  return { html: input.html, text: input.text };
}

function sendAutoReply(provider: ReturnType<typeof getProvider>, visitor: string) {
  provider
    .send({
      from: env.MAIL_FROM,
      to: visitor,
      subject: "We got your message",
      text: "Thanks, we’ll get back to you soon.",
      html: "<p>Thanks, we’ll get back to you soon.</p>",
    })
    .then((r) => {
      // A provider's error text can quote the recipient, which is a stranger's address: log the class only.
      if (!r.ok) logger.warn({ kind: r.kind }, "auto-reply failed");
    })
    .catch(() => logger.warn("auto-reply failed"));
}

/* The owner notice is already sent; only the auto-reply, which goes to whatever address was typed, is limited. */
function autoReplyAllowed(address: string, opts: ContactSendOptions): boolean {
  if (!opts.publicForm) return true;
  if (!reserveAutoReply()) return false;
  if (allowAutoReply(address)) return true;
  releaseAutoReply();
  return false;
}

/** Set by the public contact form only: its mail counts against the daily ceiling and the per-address window. */
export type ContactSendOptions = { publicForm?: boolean };
/** The public form was over its daily ceiling: nothing was sent, and the caller answers as for a send. */
export type ContactSkipped = { ok: true; skipped: true };

export async function sendContactEmail(input: SendEmailInput, opts: ContactSendOptions = {}) {
  const provider = getProvider();
  const { html, text } = composeBody(input);
  const to = env.CONTACT_TO;
  const visitorReplyTo = input.replyTo;

  if (opts.publicForm && !reserveNotice()) {
    logger.warn("contact form daily notice ceiling reached; message dropped");
    return { ok: true, skipped: true } as ContactSkipped;
  }

  logger.debug({ subject: input.subject }, "sending contact email");

  const result = await provider.send({
    from: env.MAIL_FROM,
    to,
    subject: input.subject,
    text,
    html,
    replyTo: visitorReplyTo ?? env.MAIL_REPLY_TO,
    emailjsTemplate: isEmailJsPayload(input) ? { templateId: input.templateId, variables: input.variables } : null,
  });

  // The auto-reply is plain mail, which the emailjs provider cannot send.
  if (opts.publicForm && !result.ok) releaseNotice();
  if (result.ok && visitorReplyTo && !isEmailJsPayload(input) && autoReplyAllowed(visitorReplyTo, opts)) {
    sendAutoReply(provider, visitorReplyTo);
  }

  return result;
}

/* Mail to a subscriber (double opt-in): same provider and sender as the contact mail, but to the given address. */
export async function sendToAddress(msg: { to: string; subject: string; text: string; html: string; headers?: Record<string, string>; from?: string; replyTo?: string }) {
  return getProvider().send({ ...msg, from: msg.from || env.MAIL_FROM, replyTo: msg.replyTo || env.MAIL_REPLY_TO });
}

export type BulkMessage = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
export type BulkResult = { ok: true } | { ok: false; error: string; kind?: SmtpErrorKind; code?: number };

/**
 * One message per recipient, each with its own single To (a recipient never
 * sees another's address) and its own headers (the personal one-click
 * unsubscribe). Sequential on purpose: the caller already limits the batch, and
 * a provider's own rate limit is kinder to a trickle. Never throws; a failure
 * is that recipient's result.
 */
export async function sendBulk(msgs: BulkMessage[], opts: { from: string; replyTo?: string }): Promise<BulkResult[]> {
  const provider = getProvider();
  const out: BulkResult[] = [];
  for (const m of msgs) {
    try {
      const r = await provider.send({ from: opts.from, replyTo: opts.replyTo, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
      out.push(r.ok ? { ok: true } : { ok: false, error: r.error, ...(r.kind ? { kind: r.kind } : {}), ...(r.code !== undefined ? { code: r.code } : {}) });
    } catch (err) {
      out.push({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

/** Object form so tests can spy on `send`. */
export const emailService = { send: sendContactEmail, sendTo: sendToAddress, sendBulk };
