export type BasicTemplateParams = {
  title?: string;
  body: string;
  ctaText?: string;
  ctaHref?: string;
};

/** What the public contact endpoint accepts. The recipient is CONTACT_TO, never the caller's. */
export type SendEmailBase = {
  subject: string;
  text?: string;
  /** Server-built HTML for internal mail only; never taken from a request. */
  html?: string;
  replyTo?: string;
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
