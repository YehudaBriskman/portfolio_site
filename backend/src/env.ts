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

  // Bearer API tokens on /api/admin (#252). OFF by default: until the owner
  // opts in, a Bearer header is ignored and the admin API answers only to the
  // oauth2-proxy session, exactly as before tokens existed.
  //   off     tokens are not accepted at all
  //   tunnel  accepted only on a loopback socket: `kubectl port-forward` to
  //           the api pod. Requests through nginx arrive from the web pod's
  //           address, so the public domain stays closed to tokens.
  //   on      accepted from anywhere, the public domain included
  ADMIN_API_TOKENS: z.enum(['off', 'tunnel', 'on']).default('off'),

  // GitHub. Optional, and the two consumers degrade differently: the REST calls
  // in services/github.ts work unauthenticated at 60 requests an hour, while
  // the GraphQL contribution calendar has no anonymous mode at all and reports
  // itself unavailable without a token. Neither is allowed to fail a boot.
  GITHUB_TOKEN: z.string().optional(),
  // Whose year the contribution city draws. Separate from ADMIN_GITHUB_LOGIN,
  // which answers a different question — who may edit the site.
  GITHUB_LOGIN: z.string().default("YehudaBriskman"),
  // This site's own repository, `owner/name`. Its `v*` releases are the
  // activity feed's `site` events, fetched on the stats schedule.
  SITE_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/).default("YehudaBriskman/portfolio_site"),

  // Canonical origin. Every absolute URL the crawlers see is built from this,
  // so it must be the public name of the site and nothing else.
  SITE_URL: z.string().default("https://yehudabriskman.com"),
  // Whether this host asks to be crawled. `auto` reads it off SITE_URL — the
  // canonical host is open, every other host is closed — which is what every
  // deploy wants and what no deploy has to configure. `open` and `closed` say
  // it outright, for a host the derivation would get wrong: a second
  // production hostname, or a preprod that somebody wants crawled on purpose.
  ROBOTS_POLICY: z.enum(['auto', 'open', 'closed']).default('auto'),
  // Where the built SPA shell is served from, for per-URL head injection.
  WEB_ORIGIN: z.string().default("http://web"),

  // The commit this image was built from, baked in by the Dockerfile's
  // BUILD_SHA build-arg so the Deploy job can ask a pod which build it is
  // running (#200). Anything that is not a hex sha reads as `dev`: the value
  // is echoed by /health, and an unexpected string has no business there.
  BUILD_SHA: z
    .string()
    .default("dev")
    .transform((v) => (/^[0-9a-f]{7,40}$/.test(v) ? v : "dev")),
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
