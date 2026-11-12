import rateLimit from "express-rate-limit";

const MINUTE = 60 * 1000;
const FIFTEEN_MINUTES = 15 * MINUTE;

function makeLimiter(windowMs: number, limit: number, extra: { skipFailedRequests?: boolean; message?: unknown } = {}) {
  return rateLimit({ windowMs, limit, standardHeaders: "draft-7", legacyHeaders: false, ...extra });
}

/*
 * The mail route relays over real SMTP credentials; unthrottled and public it
 * is an open relay. Two limits defend against different things.
 * Sends are what an abuser wants; failed validation is skipped so a visitor
 * mistyping their address is not locked out for 15 minutes.
 */
export const MAIL_SEND_LIMIT = 5;
export const createMailSendLimiter = () =>
  makeLimiter(FIFTEEN_MINUTES, MAIL_SEND_LIMIT, {
    skipFailedRequests: true,
    message: { ok: false, error: "Too many messages sent. Try again shortly." },
  });

/* Junk that never validates, which the send limiter deliberately ignores. */
export const MAIL_BURST_LIMIT = 40;
export const createMailBurstLimiter = () =>
  makeLimiter(FIFTEEN_MINUTES, MAIL_BURST_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });

/* Crawler files and per-URL shells sit on the path every human visitor to /blog
   and /projects takes, so the ceiling is high: throttling would break the page. */
export const SEO_LIMIT = 600;
export const createSeoLimiter = () => makeLimiter(MINUTE, SEO_LIMIT);

export const ADMIN_LIMIT = 240;
export const createAdminLimiter = () => makeLimiter(MINUTE, ADMIN_LIMIT);

export const READ_LIMIT = 120;
export const createReadLimiter = () => makeLimiter(MINUTE, READ_LIMIT);

/* Public signup: it sends mail to an address the caller chose, so it is the tightest public limit. Failures count too. */
export const SUBSCRIBE_LIMIT = 10;
export const createSubscribeLimiter = () =>
  makeLimiter(FIFTEEN_MINUTES, SUBSCRIBE_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });

/* Confirm, unsubscribe and manage links: tokens, not addresses, but still public. */
export const SUBSCRIBE_LINK_LIMIT = 60;
export const createSubscribeLinkLimiter = () =>
  makeLimiter(FIFTEEN_MINUTES, SUBSCRIBE_LINK_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });
