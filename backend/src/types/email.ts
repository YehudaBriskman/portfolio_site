export type Address = string | { name?: string; address: string };

export type BasicTemplateParams = {
  title?: string;
  body: string;
  ctaText?: string;
  ctaHref?: string;
};

export type Attachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export type SendEmailBase = {
  to: Address | Address[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string,string>;
  attachments?: Attachment[];
  replyTo?: string;
  idempotencyKey?: string;
};

export type EmailJSTemplate = {
  provider: 'emailjs';
  templateId: string;
  variables: Record<string, string>;
};

export type InternalTemplate = {
  provider?: 'smtp' | 'emailjs';
  template?: {
    name: 'basic';
    params: BasicTemplateParams;
  };
};

export type SendEmailInput = SendEmailBase & (EmailJSTemplate | InternalTemplate);
