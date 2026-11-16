import express from "express";
import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { EmailProvider } from "./types/provider.js";

/*
 * Prometheus metrics (#890).
 *
 * PRIVACY RULE, absolute: a label value is one of a fixed, code-defined set
 * (a route TEMPLATE, a status class, a result word). Never an address, a
 * subscriber id or hash, a token, an IP, a query string or anything a visitor
 * typed. metrics.test.ts exercises signup and unsubscribe with a known address
 * and fails if any trace of it reaches the output.
 *
 * EXPOSURE: this registry is served by createMetricsApp() on its own port
 * (METRICS_PORT), never by the public app. The Service and Ingress publish
 * only PORT, and nginx forwards only /api/*.
 */
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequests = new Counter({
  name: "http_requests_total",
  help: "HTTP requests finished, by method, route template and status class.",
  labelNames: ["method", "route", "status_class"] as const,
  registers: [metricsRegistry],
});

export const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration by method, route template and status class.",
  labelNames: ["method", "route", "status_class"] as const,
  buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const mailSends = new Counter({
  name: "mail_send_total",
  help: "Mail send attempts by outcome: ok, failed, suppressed (not sent: address suppressed) or blocked (policy: SEND_ENABLED not on).",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const signups = new Counter({
  name: "signup_total",
  help: "Newsletter list outcomes: created, resent, known, suppressed, bot, invalid, confirmed, unsubscribed.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const rateLimitHits = new Counter({
  name: "rate_limit_hits_total",
  help: "Requests refused by a rate limiter, by limiter name.",
  labelNames: ["route"] as const,
  registers: [metricsRegistry],
});

export const campaignQueueDepth = new Gauge({
  name: "campaign_queue_depth",
  help: "Campaigns waiting (scheduled) or being sent (sending), as of the last sender tick.",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

export const senderLastTick = new Gauge({
  name: "campaign_sender_last_tick_timestamp_seconds",
  help: "Unix time of the last sender tick that read the queue.",
  registers: [metricsRegistry],
});

export type SignupResult = "created" | "resent" | "known" | "suppressed" | "bot" | "invalid" | "confirmed" | "unsubscribed";
export const countSignup = (result: SignupResult): void => signups.inc({ result });

/** Zeroes every series; tests only. */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}

const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

/**
 * The route template a request matched: mount path plus the route's pattern,
 * e.g. `/api/subscribe/confirm`. A request no route claimed (404, a rate-limit
 * refusal, a scanner's guess) is `unmatched`, never its raw path.
 */
function routeTemplate(req: Request): string {
  const route = req.route as { path?: unknown } | undefined;
  if (!route || typeof route.path !== "string") return "unmatched";
  const full = `${req.baseUrl}${route.path === "/" ? "" : route.path}`;
  return full === "" ? "/" : full;
}

export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const labels = { method: req.method, route: routeTemplate(req), status_class: statusClass(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

/** Wraps the mail provider so every send, from any path, is counted by outcome and nothing else. */
export function instrumentProvider(p: EmailProvider): EmailProvider {
  return {
    async send(data) {
      try {
        const r = await p.send(data);
        mailSends.inc({ result: r.ok ? "ok" : r.kind === "policy" ? "blocked" : "failed" });
        return r;
      } catch (err) {
        mailSends.inc({ result: "failed" });
        throw err;
      }
    },
  };
}

function bearerOk(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer /i, ""));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * The app served on METRICS_PORT: GET /metrics and nothing else. `token`, when
 * set (METRICS_TOKEN), is also required as a bearer token (defence in depth for
 * a cluster where the port is reachable more widely than intended).
 */
export function createMetricsApp(token?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/metrics", async (req, res) => {
    if (token && !bearerOk(req.header("authorization"), token)) return void res.status(401).end();
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });
  return app;
}
