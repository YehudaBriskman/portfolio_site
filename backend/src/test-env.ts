/**
 * Minimum configuration for the test suite.
 *
 * Only fills what is absent, so a developer with a real .env keeps it - dotenv
 * does not override already-set variables either, so the precedence is the same
 * in both directions. None of these reach a network: no test sends mail, and
 * the content store is unreachable by design in `src/env.ts`.
 */
const DEFAULTS: Record<string, string> = {
  NODE_ENV: 'test',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.invalid',
  SMTP_PORT: '587',
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
  MAIL_FROM: 'test@example.invalid',
  CONTACT_TO: 'test@example.invalid',
  /* A token the GitHub services can read without any of them reaching GitHub:
     every test that exercises them stubs `fetch`. It is here rather than in a
     `beforeEach` because `src/env.ts` parses process.env once, at import time —
     a variable set after the module graph has loaded is a variable `env` never
     sees, which is the same reason this file exists at all. */
  GITHUB_TOKEN: 'test-token',
  /* The admin gate fails closed on an empty secret (see requireAdmin), which
     is right for a deploy and makes every admin route untestable past the 401.
     A fixed value here lets the admin tests present the proof header; they
     read it back from `env` rather than repeating it, so a developer whose
     .env already sets one is not broken by this. */
  ADMIN_PROXY_SECRET: 'test-admin-proxy-secret',
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  process.env[key] ??= value;
}
