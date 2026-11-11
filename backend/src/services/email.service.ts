import { getProvider } from "../providers/index.js";
import { renderBasicTemplate } from "../templates/basic.js";
import type { SendEmailInput } from "../types/index.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

type EmailJsPayload = Extract<SendEmailInput, { templateId: string }>;

const isEmailJsPayload = (input: SendEmailInput): input is EmailJsPayload => "templateId" in input;

function composeBody(input: SendEmailInput): { html?: string; text?: string } {
  if ("template" in input && input.template) return renderBasicTemplate(input.template.params);
  return { text: input.text };
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
      if (!r.ok) logger.warn({ err: r.error }, "auto-reply failed");
    })
    .catch((err) => logger.warn({ err }, "auto-reply failed"));
}

export async function sendContactEmail(input: SendEmailInput) {
  const provider = getProvider();
  const { html, text } = composeBody(input);
  const to = env.CONTACT_TO;
  const visitorReplyTo = input.replyTo;

  logger.debug({ to, subject: input.subject }, "sending contact email");

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
  if (result.ok && visitorReplyTo && !isEmailJsPayload(input)) sendAutoReply(provider, visitorReplyTo);

  return result;
}

/** Object form so tests can spy on `send`. */
export const emailService = { send: sendContactEmail };
