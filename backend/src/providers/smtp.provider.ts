import nodemailer from 'nodemailer';
import { env } from '../env.js';
import type { EmailProvider, ProviderResult } from '../types/index.js';
import { formatError } from '../logger.js';
import { classifySmtpError } from './classifySmtpError.js';

/**
 * TLS is required on a submission port (STARTTLS must succeed, never a silent
 * downgrade to plain text), and a stuck relay cannot hold a send for minutes:
 * every wait has a bound. Google: "use TLS for transmitting email".
 * SMTP_PORT=25 to a local test sink is the one place without TLS, so a port-25
 * relay on loopback keeps working; nothing else does.
 */
export function transportOptions() {
  const secure = env.SMTP_SECURE ?? (env.SMTP_PORT === 465);
  const local = /^(127\.|localhost$|\[?::1\]?$)/.test(env.SMTP_HOST ?? '');
  return {
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure,
    ...(secure || local ? {} : { requireTLS: true }),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! }
  };
}

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cached) return cached;
  cached = nodemailer.createTransport(transportOptions());
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
      return { ok: false, error: formatError(err), ...classifySmtpError(err) };
    }
  }
};
