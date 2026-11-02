import type { ErrorRequestHandler } from "express";
import { CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

/*
 * The one place a thrown error becomes a response.
 *
 * Every `asyncHandler` route forwards a rejection to `next(err)`. Before this
 * existed, that `next` led straight to Express's built-in final handler, which
 * answers in HTML — a `<pre>` with the stack trace in it outside production —
 * while every client in web/src expects JSON. The reader saw "Request failed
 * (500)" at best and a JSON parser error at worst, and because Express's
 * handler writes to stderr with console.error, none of it reached pino or the
 * log pipeline that reads pino's output.
 *
 * The shape is the one the routes already use for the failures they handle
 * themselves — `{ ok: false, error: string }` — so a client never has to know
 * whether an error was anticipated by the route or caught here. `stack` is an
 * addition outside production only, and is never relied upon by a client.
 *
 * Status is chosen conservatively, because an error's own `status` field is
 * not a promise that the status is meaningful to the CLIENT:
 *
 * - A CouchError carries CouchDB's status, but that is the store's answer to
 *   OUR query. A Mango 400 for an unindexed sort is this API's bug, not the
 *   caller's bad request, and passing it through once made a broken index look
 *   like a client fault. So any store failure is 502: an upstream let us down.
 * - Errors in the http-errors convention (what body-parser throws for malformed
 *   JSON or a body over the 1mb limit) mark themselves `expose: true` when the
 *   status and message are safe to repeat. Those keep their 4xx and message.
 * - Everything else is 500 with a fixed message. A raw message from an
 *   arbitrary throw can carry a file path, a hostname or a credentialed URL, so
 *   it goes to the log and never to the response.
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
