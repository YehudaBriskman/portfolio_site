import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

/* One JSON line per finished request; level by status (5xx error, 4xx warn). /mcp and /api/subscribe query strings (tokens) are dropped. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const status = res.statusCode;
    const fields = {
      method: req.method,
      // originalUrl, not url: a mounted router strips the mount path from `url`.
      // The MCP OAuth endpoints carry codes and state in the query; never log them.
      url: /^\/(mcp|api\/subscribe)/.test(req.originalUrl) ? req.originalUrl.split("?")[0] : req.originalUrl,
      status,
      durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
    };
    if (status >= 500) logger.error(fields, "request");
    else if (status >= 400) logger.warn(fields, "request");
    else logger.info(fields, "request");
  });

  next();
}
