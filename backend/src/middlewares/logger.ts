import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

/*
 * The URL as it may be logged. Query strings are dropped for routes where one can
 * hold a credential or a person: MCP OAuth codes, subscribe/unsubscribe/manage
 * tokens (the API and the pages that render for them), and every admin route (the
 * audience search puts an address or a fragment of one in `q`; a path is enough
 * to debug an admin call).
 */
const QUERYLESS = /^\/(mcp|api\/subscribe|api\/admin|api\/seo\/render\/(subscribe|unsubscribe))(?=[/?]|$)/;
export const loggableUrl = (originalUrl: string): string => (QUERYLESS.test(originalUrl) ? originalUrl.split("?")[0] : originalUrl);

/* One JSON line per finished request; level by status (5xx error, 4xx warn). Query strings of token and admin routes are dropped (loggableUrl). */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const status = res.statusCode;
    const fields = {
      method: req.method,
      // originalUrl, not url: a mounted router strips the mount path from `url`.
      url: loggableUrl(req.originalUrl),
      status,
      durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
    };
    if (status >= 500) logger.error(fields, "request");
    else if (status >= 400) logger.warn(fields, "request");
    else logger.info(fields, "request");
  });

  next();
}
