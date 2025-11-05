import emailjs from "@emailjs/nodejs";
import { env } from "../env.js";
import type { EmailProvider, ProviderResult } from "../types/index.js";
import { formatError } from "../logger.js";

export const emailjsProvider: EmailProvider = {
  async send(data): Promise<ProviderResult> {
    if (!data.emailjsTemplate)
      return { ok: false, error: "EmailJS requires templateId + variables" };

    try {
      const res = await emailjs.send(
        env.EMAILJS_SERVICE_ID!,
        data.emailjsTemplate.templateId,
        {
          ...data.emailjsTemplate.variables,
          subject: data.subject,
          reply_to: data.replyTo ?? undefined,
          to_email: typeof data.to === "string" ? data.to : undefined,
          from_name: data.from,
        },
        {
          publicKey: env.EMAILJS_PUBLIC_KEY!,
          privateKey: env.EMAILJS_PRIVATE_KEY!,
        }
      );
      return { ok: true, messageId: `emailjs:${res.status}:${Date.now()}` };
    } catch (err: unknown) {
      return { ok: false, error: formatError(err) };
    }
  },
};
