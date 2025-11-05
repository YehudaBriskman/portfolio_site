// src/schemas/email.ts
import { z } from 'zod';

const AddressSchema = z.union([
  z.string().email().or(z.string().min(3)), // "שם <מייל>" אפשרי
  z.object({ name: z.string().optional(), address: z.string().email() })
]);

const BaseSchema = z.object({
  to: z.union([AddressSchema, z.array(AddressSchema).min(1)]),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  headers: z.record(z.string(),z.string()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.union([
      z.string(), // raw
      z.string().transform(s => Buffer.from(s, 'base64')) // base64 → Buffer
    ]),
    contentType: z.string().optional()
  })).optional(),
  replyTo: z.string().optional(),
  idempotencyKey: z.string().optional(),
  template: z.object({
    name: z.literal('basic'),
    params: z.object({
      title: z.string().optional(),
      body: z.string(),
      ctaText: z.string().optional(),
      ctaHref: z.string().url().optional()
    })
  }).optional()
});

const EmailJSSchema = BaseSchema.extend({
  provider: z.literal('emailjs'),
  templateId: z.string(),
  variables: z.record(z.string(),z.string())
});

const SmtpLikeSchema = BaseSchema.extend({
  provider: z.literal('smtp').optional()
}).refine(d => d.text || d.html || d.template, { message: 'Provide text/html/template' });

export const SendSchema = z.union([EmailJSSchema, SmtpLikeSchema]);
export type SendPayload = z.infer<typeof SendSchema>;
