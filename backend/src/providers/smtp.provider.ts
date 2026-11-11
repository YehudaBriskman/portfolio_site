import nodemailer from 'nodemailer';
import { env } from '../env.js';
import type { EmailProvider, ProviderResult } from '../types/index.js';
import { formatError } from '../logger.js';

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? (env.SMTP_PORT === 465),
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! }
  });
  return cached;
}

export const smtpProvider: EmailProvider = {
  async send(data): Promise<ProviderResult> {
    try {
      const info = await getTransport().sendMail({
        from: data.from,
        to: data.to as string,
        subject: data.subject,
        text: data.text,
        html: data.html,
        headers: data.headers,
        attachments: data.attachments,
        replyTo: data.replyTo
      });
      return { ok: true, messageId: info.messageId };
    } catch (err: unknown) {
      return { ok: false, error: formatError(err) };
    }
  }
};
