import rateLimit from "express-rate-limit";
import { rateLimitHits } from "./metrics.js";

const MINUTE = 60 * 1000;
const FIFTEEN_MINUTES = 15 * MINUTE;

/* `name` is the metric label: one fixed word per limiter, never anything about the client. */
function makeLimiter(name: string, windowMs: number, limit: number, extra: { skipFailedRequests?: boolean; message?: unknown } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...extra,
    handler: (_req, res, _next, options) => {
      rateLimitHits.inc({ route: name });
      res.status(options.statusCode).send(options.message);
    },
  });
}

/*
 * The mail route relays over real SMTP credentials; unthrottled and public it
 * is an open relay. The per-client, global, per-address and daily limits on
 * what is actually sent live in services/contactGuard.ts and answer the
 * visitor exactly as a send does, so they leave no hint for a bot.
 */

/* Junk that never validates: the one limit here that is visible, because it counts requests, not mail. */
export const MAIL_BURST_LIMIT = 40;
export const createMailBurstLimiter = () =>
  makeLimiter("email_burst", FIFTEEN_MINUTES, MAIL_BURST_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });

/* Crawler files and per-URL shells sit on the path every human visitor to /blog
   and /projects takes, so the ceiling is high: throttling would break the page. */
export const SEO_LIMIT = 600;
export const createSeoLimiter = () => makeLimiter("seo", MINUTE, SEO_LIMIT);

export const ADMIN_LIMIT = 240;
export const createAdminLimiter = () => makeLimiter("admin", MINUTE, ADMIN_LIMIT);

export const READ_LIMIT = 120;
export const createReadLimiter = () => makeLimiter("read", MINUTE, READ_LIMIT);

/* Public signup: it sends mail to an address the caller chose, so it is the tightest public limit. Failures count too. */
export const SUBSCRIBE_LIMIT = 10;
export const createSubscribeLimiter = () =>
  makeLimiter("subscribe", FIFTEEN_MINUTES, SUBSCRIBE_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });

/* Confirm, unsubscribe and manage links: tokens, not addresses, but still public. */
export const SUBSCRIBE_LINK_LIMIT = 60;
export const createSubscribeLinkLimiter = () =>
  makeLimiter("subscribe_link", FIFTEEN_MINUTES, SUBSCRIBE_LINK_LIMIT, { message: { ok: false, error: "Too many requests. Try again shortly." } });
