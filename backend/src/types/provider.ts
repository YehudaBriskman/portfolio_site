import type { SmtpErrorKind } from '../providers/classifySmtpError.js';

export type ProviderName = 'smtp' | 'emailjs';

export type ProviderResult = {
  ok: true; messageId: string; attempts?: number;
} | {
  /** `kind` and `code` come from providers that can classify a failure (SMTP); absent means unknown. `code` is the numeric reply only. */
  ok: false; error: string; kind?: SmtpErrorKind; code?: number;
};

export interface EmailProvider {
  send(data: {
    from: string;
    to: string | string[] | { name?: string; address: string } | Array<{ name?: string; address: string }>;
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string,string>;
    attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
    replyTo?: string;
    // ייחודי ל-EmailJS
    emailjsTemplate?: { templateId: string; variables: Record<string,string> } | null;
  }): Promise<ProviderResult>;
}
