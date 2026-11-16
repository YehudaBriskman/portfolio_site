import pino from 'pino';

/*
 * Silent under test: every request now logs a line, and the failure-path tests
 * provoke errors on purpose, so the suite's output would otherwise be buried
 * in JSON describing failures that are the expected result. The tests that care
 * about logging spy on these methods, which are still called at any level.
 */
const level =
  process.env.NODE_ENV === 'production' ? 'info'
  : process.env.NODE_ENV === 'test' ? 'silent'
  : 'debug';

/*
 * Credentials and addresses never reach the log. fast-redact paths are literal,
 * so each shape that can carry one is listed: at the top level, one level down
 * (a body, a contact, a header bag) and inside req/res headers.
 */
const SECRET_KEYS = ['authorization', 'cookie', 'set-cookie', 'x-admin-proxy-secret', 'token', 'access_token', 'refresh_token', 'password', 'secret', 'email'];
const quote = (k: string) => (/^[a-z_]+$/i.test(k) ? k : `["${k}"]`);
const at = (prefix: string, k: string) => (prefix ? (/^\[/.test(quote(k)) ? `${prefix}${quote(k)}` : `${prefix}.${k}`) : quote(k));
export const REDACT_PATHS = [
  ...SECRET_KEYS.map((k) => at('', k)),
  ...SECRET_KEYS.map((k) => `*${quote(k).startsWith('[') ? quote(k) : '.' + k}`),
  ...['req', 'res'].flatMap((p) => ['authorization', 'cookie', 'set-cookie', 'x-admin-proxy-secret'].map((k) => at(`${p}.headers`, k))),
];

export const logOptions = (lvl: string) => ({
  level: lvl,
  base: undefined,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
});

export const logger = pino(logOptions(level));

export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}
