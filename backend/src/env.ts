import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().default(8080),

  EMAIL_PROVIDER: z.enum(['smtp','emailjs']).default('smtp'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().optional().transform(v => v ? v === 'true' : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  EMAILJS_PUBLIC_KEY: z.string().optional(),
  EMAILJS_PRIVATE_KEY: z.string().optional(),
  EMAILJS_SERVICE_ID: z.string().optional(),

  MAIL_FROM: z.string().min(1),
  MAIL_REPLY_TO: z.string().optional(),
  CONTACT_TO: z.string().email(),

  // Content store. Defaults point at the in-cluster service; the API must start
  // even when CouchDB is unreachable, so nothing here is required at boot.
  COUCHDB_URL: z.string().default("http://couchdb-svc-couchdb.obsidian.svc.cluster.local:5984"),
  COUCHDB_USER: z.string().default("portfolio_api"),
  COUCHDB_PASSWORD: z.string().default(""),

  // Admin gate. Empty ADMIN_PROXY_SECRET fails closed in requireAdmin, so a
  // misconfigured deploy locks the admin surface rather than opening it.
  ADMIN_PROXY_SECRET: z.string().default(""),
  ADMIN_GITHUB_LOGIN: z.string().default("YehudaBriskman"),

  // Canonical origin. Every absolute URL the crawlers see is built from this,
  // so it must be the public name of the site and nothing else.
  SITE_URL: z.string().default("https://yehudabriskman.com"),
  // Where the built SPA shell is served from, for per-URL head injection.
  WEB_ORIGIN: z.string().default("http://web"),
})
.superRefine((env, ctx) => {
  if (env.EMAIL_PROVIDER === 'smtp') {
    for (const k of ['SMTP_HOST','SMTP_USER','SMTP_PASS'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${k} for SMTP` });
    }
    if (!env.SMTP_PORT) (env).SMTP_PORT = 587;
  } else {
    for (const k of ['EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY','EMAILJS_SERVICE_ID'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${k} for EmailJS` });
    }
  }
});

export const env = EnvSchema.parse(process.env);
