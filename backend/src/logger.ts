import pino from 'pino';
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: undefined
});

export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}