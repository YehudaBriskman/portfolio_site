import type { ErrorRequestHandler } from "express";
import { CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

/*
 * The one place a thrown error becomes a response: `{ ok: false, error }`
 * JSON (plus `stack` outside production), cause to the log, never the response.
 *
 * - CouchError -> 502: the store's status answers OUR query, so a Mango 400 is
 *   this API's bug, not the caller's.
 * - http-errors with `expose: true` (body-parser: bad JSON, over 1mb) keep
 *   their 4xx and message; only those are safe to repeat.
 * - Anything else -> 500, fixed message: a raw message can leak a path, host
 *   or credentialed URL.
 */

type ErrorBody = { ok: false; error: string; stack?: string };

function httpStatusOf(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: unknown; statusCode?: unknown; expose?: unknown };
  const status = typeof e.status === "number" ? e.status : e.statusCode;
  if (typeof status !== "number" || status < 400 || status > 599) return null;
  // Only the http-errors family vouches for its own status; see above.
  return e.expose === true ? status : null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  /*
   * Headers already gone means a response was half-written — a stream that
   * failed partway, say. Nothing useful can be sent now, and Express's own
   * handler is the one that knows to destroy the socket, so hand it back.
   */
  if (res.headersSent) {
    logger.error({ err, method: req.method, url: req.originalUrl }, "error after response started");
    return next(err);
  }

  let status = 500;
  let message = "Internal Server Error";

  if (err instanceof CouchError) {
    status = 502;
    message = "The content store is unavailable.";
  } else {
    const exposed = httpStatusOf(err);
    if (exposed !== null) {
      status = exposed;
      message = err instanceof Error && err.message ? err.message : message;
    }
  }

  /*
   * `err` under that exact key is what pino's standard serializer recognises,
   * so the log line carries type, message and stack as structured fields
   * rather than "[object Object]". A client mistake is a warning; anything the
   * server should have handled is an error, and is what an alert should key on.
   */
  const fields = { err, status, method: req.method, url: req.originalUrl };
  if (status >= 500) logger.error(fields, "request failed");
  else logger.warn(fields, "request rejected");

  const body: ErrorBody = { ok: false, error: message };
  if (env.NODE_ENV !== "production" && err instanceof Error && err.stack) body.stack = err.stack;
  res.status(status).json(body);
};
