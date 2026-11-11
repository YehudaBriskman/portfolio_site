import { z } from 'zod';

/*
 * The public contact endpoint takes only what the form sends. Zod strips any other key
 * (`to`, `headers`, `html`, `attachments`, ...): the recipient is CONTACT_TO, set in the service.
 */
const oneLine = (max: number) =>
  z.string().min(1).max(max).refine((v) => !/[\r\n]/.test(v), { message: 'Must be a single line' });

const BaseSchema = z.object({
  subject: oneLine(200),
  text: z.string().max(10_000).optional(),
  // One address, no list and no "Name <x>" form: it becomes an auto-reply recipient.
  replyTo: z.string().trim().email().max(254).optional(),
  template: z.object({
    name: z.literal('basic'),
    params: z.object({
      title: z.string().max(200).optional(),
      body: z.string().min(1).max(10_000),
      ctaText: z.string().max(100).optional(),
      ctaHref: z.string().url().max(2048).refine((v) => /^https:\/\//i.test(v), { message: 'https only' }).optional()
    })
  }).optional()
});

const EmailJSSchema = BaseSchema.extend({
  provider: z.literal('emailjs'),
  templateId: z.string().max(100),
  variables: z.record(z.string().max(100), z.string().max(5000))
});

const SmtpLikeSchema = BaseSchema.extend({
  provider: z.literal('smtp').optional()
}).refine(d => d.text || d.template, { message: 'Provide text or a template' });

export const SendSchema = z.union([EmailJSSchema, SmtpLikeSchema]);
export type SendPayload = z.infer<typeof SendSchema>;
