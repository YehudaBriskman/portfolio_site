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

  // The remote MCP server (#263): /mcp over Streamable HTTP, with its own
  // OAuth 2.1 authorization server that delegates sign-in to GitHub. OFF by
  // default: /mcp, /.well-known/oauth-* and /mcp/oauth/* answer 404, and the
  // ADMIN_API_TOKENS path above is untouched either way.
  MCP_REMOTE: z.enum(['off', 'on']).default('off'),
  // A GitHub OAuth app of its own (not oauth2-proxy's, whose callback is on
  // the auth host). Callback: <SITE_URL>/mcp/oauth/github/callback.
  MCP_GITHUB_CLIENT_ID: z.string().optional(),
  MCP_GITHUB_CLIENT_SECRET: z.string().optional(),
  // The owner's numeric GitHub id. Optional: without it the id is recorded
  // the first time ADMIN_GITHUB_LOGIN signs in, and held to from then on, so
  // a renamed account and a new account that takes the old login are told
  // apart either way.
  ADMIN_GITHUB_ID: z.string().regex(/^\d+$/).optional(),
  // Where GitHub is. Overridable only outside production, for a local mock.
  MCP_GITHUB_OAUTH_URL: z.string().url().default("https://github.com"),
  MCP_GITHUB_API_URL: z.string().url().default("https://api.github.com"),

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
  // IndexNow (#308): when set, a publish tells Bing, Yandex and the other
  // IndexNow engines which URLs changed, and `/<key>.txt` proves the key is
  // the site's. Public by design: the protocol serves it to anyone who asks.
  // 32 hex characters (`openssl rand -hex 16`). Unset, nothing is sent.
  INDEXNOW_KEY: z
    .string()
    .regex(/^[a-f0-9]{32}$/, 'INDEXNOW_KEY is 32 lowercase hex characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Search console ownership tokens (#308): the `content` of the meta tag
  // Google Search Console and Bing Webmaster Tools each hand out, written into
  // every rendered page's head. Public by design, like the key above. Unset,
  // no tag.
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
    if (!env.SMTP_PORT) (env).SMTP_PORT = 587;
  } else {
    for (const k of ['EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY','EMAILJS_SERVICE_ID'] as const) {
      if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${k} for EmailJS` });
    }
  }
});

export const env = EnvSchema.parse(process.env);
