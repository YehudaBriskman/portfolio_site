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

export const logger = pino({
  level,
  base: undefined
});

export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}
