import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  // 5000 is what the Dockerfile and both compose files set; the listener and
  // its log line both read this, so there is one answer to "which port".
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  HOST: z.string().default('0.0.0.0'),

  EMAIL_PROVIDER: z.enum(['smtp','emailjs']).default('smtp'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  // Unset means "decide from the port" (465 is implicit TLS); a typo is an error, not false.
  SMTP_SECURE: z.enum(['true', 'false']).optional().transform(v => (v === undefined ? undefined : v === 'true')),
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
  // The suppression ledger lives in its own database so that restoring the content database cannot rewind it.
  LEDGER_DB: z.string().regex(/^[a-z][a-z0-9_$()+/-]*$/).default("portfolio_suppression"),

  // Admin gate. Empty ADMIN_PROXY_SECRET fails closed in requireAdmin, so a
  // misconfigured deploy locks the admin surface rather than opening it.
  ADMIN_PROXY_SECRET: z.string().default(""),
  ADMIN_GITHUB_LOGIN: z.string().default("YehudaBriskman"),

  // Bearer API tokens on /api/admin: off, tunnel (loopback only) or on. The modes are defined in requireAdmin.ts.
  ADMIN_API_TOKENS: z.enum(['off', 'tunnel', 'on']).default('off'),

  // The remote MCP server (/mcp, with its own OAuth). Off: its paths answer 404.
  MCP_REMOTE: z.enum(['off', 'on']).default('off'),
  // A GitHub OAuth app of its own; callback <SITE_URL>/mcp/oauth/github/callback.
  MCP_GITHUB_CLIENT_ID: z.string().optional(),
  MCP_GITHUB_CLIENT_SECRET: z.string().optional(),
  // The owner's numeric GitHub id. Without it the id is recorded at the first sign-in and held to.
  ADMIN_GITHUB_ID: z.string().regex(/^\d+$/).optional(),
  // Where GitHub is. Overridable only outside production, for a local mock.
  MCP_GITHUB_OAUTH_URL: z.string().url().default("https://github.com"),
  MCP_GITHUB_API_URL: z.string().url().default("https://api.github.com"),

  // GitHub token. Optional and must never fail a boot: REST works without it (60/h), the contribution calendar reports itself unavailable.
  GITHUB_TOKEN: z.string().optional(),
  // Whose contribution year is drawn (not who may edit: ADMIN_GITHUB_LOGIN).
  GITHUB_LOGIN: z.string().default("YehudaBriskman"),
  // This site's own repository, `owner/name`; its `v*` releases feed the activity log.
  SITE_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/).default("YehudaBriskman/portfolio_site"),

  // Canonical origin, trailing slash stripped; every absolute URL is built from it.
  // Signs confirm/unsubscribe links. Unset: a generated secret in the admin-only store.
  SUBSCRIBE_SECRET: z.string().min(16).optional(),
  SITE_URL: z.string().default("https://yehudabriskman.com").transform((s) => s.replace(/\/+$/, "")),
  // Whether this host asks to be crawled. `auto`: open only on the SITE_URL host.
  ROBOTS_POLICY: z.enum(['auto', 'open', 'closed']).default('auto'),
  // IndexNow key (32 hex). Public by design: served at /<key>.txt. Unset, nothing is sent.
  INDEXNOW_KEY: z
    .string()
    .regex(/^[a-f0-9]{32}$/, 'INDEXNOW_KEY is 32 lowercase hex characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Search console ownership meta-tag content; public by design. Unset, no tag.
  GOOGLE_SITE_VERIFICATION: z
    .string()
    .regex(/^[\w-]{10,100}$/, 'GOOGLE_SITE_VERIFICATION is the content of the meta tag, letters, digits, _ and -')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  BING_SITE_VERIFICATION: z
    .string()
    .regex(/^[\w-]{10,100}$/, 'BING_SITE_VERIFICATION is the content of the msvalidate.01 meta tag')
    .optional()
    .or(z.literal('').transform(() => undefined)),
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
  if (env.MCP_REMOTE === 'on') {
    for (const k of ['MCP_GITHUB_CLIENT_ID', 'MCP_GITHUB_CLIENT_SECRET'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `MCP_REMOTE=on needs ${k}` });
    }
  }
  if (
    env.NODE_ENV === 'production' &&
    (env.MCP_GITHUB_OAUTH_URL !== "https://github.com" || env.MCP_GITHUB_API_URL !== "https://api.github.com")
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCP_GITHUB_*_URL may only be overridden outside production" });
  }
  if (env.EMAIL_PROVIDER === 'smtp') {
    for (const k of ['SMTP_HOST','SMTP_USER','SMTP_PASS'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${k} for SMTP` });
    }
  } else {
    for (const k of ['EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY','EMAILJS_SERVICE_ID'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${k} for EmailJS` });
    }
  }
});

export const env = EnvSchema.parse(process.env);
