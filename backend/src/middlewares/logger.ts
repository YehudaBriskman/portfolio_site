import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

/*
 * One structured line per finished request, through the same pino logger as
 * everything else.
 *
 * This used to be console.log with hand-rolled ANSI colour codes. In a
 * terminal that was pleasant; in production it meant every request line
 * reached the log pipeline as an unparseable string full of `\x1b[32m`
 * escapes, beside pino's JSON from the rest of the service — two formats in
 * one stream, and the one that carried status and latency was the one nothing
 * could query. pino writes plain JSON with no colour in any environment, so
 * status and duration arrive as fields a query can filter on.
 *
 * pino-http would do this too, but it is a new dependency for a dozen lines,
 * and this keeps the exact fields the old line had.
 *
 * Level follows the status, as the colours did: a 5xx is an error, a 4xx a
 * warning, and everything else is info. The error handler logs the cause of a
 * failure separately; this line records that the request happened and how
 * long it took, so the two are complementary rather than duplicates.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const status = res.statusCode;
    const fields = {
      method: req.method,
      // originalUrl, not url: inside a mounted router `url` has had the mount
      // path stripped, and this runs before routing but finishes after it.
      // The OAuth endpoints of the remote MCP server (#263) carry codes and
      // states in their query strings; those never reach a log.
      url: req.originalUrl.startsWith("/mcp") ? req.originalUrl.split("?")[0] : req.originalUrl,
      status,
      durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
    };
    if (status >= 500) logger.error(fields, "request");
    else if (status >= 400) logger.warn(fields, "request");
    else logger.info(fields, "request");
  });

  next();
}
