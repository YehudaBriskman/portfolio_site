import type { BasicTemplateParams } from '../types/index.js';
import { renderContactNotice } from '../mail/transactional.js';

/** The contact-form notice on the one mail renderer (it escapes every value). */
export function renderBasicTemplate(p: BasicTemplateParams, o: { subject?: string; footerLines?: string[]; replyTo?: string } = {}) {
  const { html, text } = renderContactNotice({ ...p, subject: o.subject || p.title || 'Message', replyTo: o.replyTo }, o.footerLines);
  return { html, text };
}
