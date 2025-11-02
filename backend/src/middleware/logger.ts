import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url } = req;

  // color helpers for nicer terminal output
  const color = {
    grey: (s: string) => `\x1b[90m${s}\x1b[0m`,
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const colorizeStatus =
      status >= 500
        ? color.red(status.toString())
        : status >= 400
        ? color.yellow(status.toString())
        : color.green(status.toString());

    const logLine = `${color.grey(`[${new Date().toISOString()}]`)} ${color.cyan(
      method
    )} ${url} → ${colorizeStatus} ${color.grey(`${duration}ms`)}`;

    console.log(logLine);
  });

  next();
}
