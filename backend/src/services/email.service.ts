// src/services/email.service.ts
import { getProvider } from "../providers/index.js";
import { renderBasicTemplate } from "../templates/basic.js";
import type { SendEmailInput } from "../types/index.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

export class EmailService {
  async send(input: SendEmailInput) {
    let html: string | undefined;
    let text = input.text;

    if ("template" in input && input.template?.name === "basic") {
      const t = renderBasicTemplate(input.template.params);
      html = html ?? t.html;
      text = text ?? t.text;
    }

    const provider = getProvider();

    const to = env.CONTACT_TO;
    const replyTo = input.replyTo ?? env.MAIL_REPLY_TO;

    logger.debug({ to, subject: input.subject }, "sending contact email");

    const result = await provider.send({
      from: env.MAIL_FROM,
      to,
      subject: input.subject,
      text,
      html,
      replyTo,
      emailjsTemplate:
        "templateId" in input
          ? { templateId: input.templateId, variables: input.variables }
          : null,
    });

    if (result.ok && input.replyTo && !("templateId" in input)) {
      provider
        .send({
          from: env.MAIL_FROM,
          to: input.replyTo,
          subject: "We got your message",
          text: "Thanks, we’ll get back to you soon.",
          html: "<p>Thanks, we’ll get back to you soon.</p>",
        })
        .then((r) => {
          if (!r.ok) logger.warn({ err: r.error }, "auto-reply failed");
        })
        .catch((err) => logger.warn({ err }, "auto-reply failed"));
    }

    return result;
  }
}

export const emailService = new EmailService();
