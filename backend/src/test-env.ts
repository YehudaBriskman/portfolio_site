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
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  process.env[key] ??= value;
}
