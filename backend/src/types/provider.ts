export type ProviderName = 'smtp' | 'emailjs';

export type ProviderResult = {
  ok: true; messageId: string; attempts?: number;
} | {
  ok: false; error: string;
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
