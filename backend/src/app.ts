import express from "express";
import cors from "cors";
import { createImagesRouter } from "./routes/images.route";
import { createGithubRouter } from "./routes/github.route.js";
import { requestLogger } from "./middlewares/logger";
import emailRoutes from './routes/email.route.js';
import blogRoutes from './routes/blog.route.js';
import adminRoutes from './routes/admin.route.js';
import seoRoutes from './routes/seo.route.js';
import contentRoutes from './routes/content.route.js';
import settingsRoutes from './routes/settings.route.js';
import feedRoutes from './routes/feeds.route.js';
import { activityRouter, areasRouter } from './routes/activity.route.js';
import { createBearerFailureLimiter, requireAdmin } from './middlewares/requireAdmin.js';
import {
  createAdminLimiter,
  createMailBurstLimiter,
  createReadLimiter,
  createSubscribeLimiter,
  createSubscribeLinkLimiter,
  createSeoLimiter,
} from './rate-limit.js';
import { auditWrites } from './services/audit.js';
import { indexNowOnWrite } from './services/indexnow.js';
import subscribeRoutes from './audience/public.route.js';
import { announceOnWrite } from './announce/hooks.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { couch } from './db/couch.js';
import { createMcpRouter } from './mcp/router.js';
import { env } from './env.js';

export function createApp() {
  const app = express();

  // Express advertises itself on every response; nothing needs to know.
  app.disable("x-powered-by");
  app.use(requestLogger);

  /*
   * The remote MCP server and its OAuth endpoints (#263), ahead of the site's
   * CORS policy: a browser-based MCP client calls /mcp and the metadata from
   * any origin, with a Bearer token rather than a cookie, and the policy
   * below would answer its preflight with nothing. The router sets the CORS
   * it needs on its own paths, and 404s them all while MCP_REMOTE=off.
   */
  app.use(createMcpRouter(app));

  /*
   * The browser talks to this API from the site itself, so a wildcard buys
   * nothing and costs something: /api/email relays real SMTP, and `*` let any
   * page on the internet drive it from a visitor's browser.
   */
  const ALLOWED_ORIGINS = [
    "https://yehudabriskman.com",
    "https://www.yehudabriskman.com",
    "https://admin.yehudabriskman.com",
  ];
  /*
   * windom.app reads the published-post list from the visitor's browser. It is
   * keyed on path and method rather than added to ALLOWED_ORIGINS, which would
   * hand it every route, /api/email included. Its GET needs no preflight; one
   * that did is answered for GET and HEAD alone.
   */
  const FEED_ORIGINS = ["https://windom.app"];
  const FEED_PATH = "/api/blog/posts";
  const isFeedRead = (req: express.Request) => {
    // Express matches paths case-insensitively and with or without a trailing
    // slash, so the check normalises the same way the router does.
    const path = req.path.toLowerCase().replace(/\/+$/, "");
    if (path !== FEED_PATH) return false;
    if (req.method === "GET" || req.method === "HEAD") return true;
    const asked = req.header("access-control-request-method")?.toUpperCase();
    return req.method === "OPTIONS" && (asked === "GET" || asked === "HEAD");
  };
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      // Same-origin and server-to-server requests send no Origin at all.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, { origin: true });
      if (FEED_ORIGINS.includes(origin) && isFeedRead(req as express.Request)) {
        return callback(null, { origin: true, methods: ["GET", "HEAD"] });
      }
      return callback(null, { origin: false });
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  const mailBurstLimiter = createMailBurstLimiter();
  const seoLimiter = createSeoLimiter();
  const adminLimiter = createAdminLimiter();
  const readLimiter = createReadLimiter();

  /*
   * Hops in front of this process: Traefik, then nginx (client -> Traefik ->
   * nginx -> here). A count, never `true`: trusting every hop makes req.ip the
   * leftmost X-Forwarded-For entry, which the client controls, so each request
   * would get a fresh rate-limit bucket. Change it with the topology
   * (src/rate-limit.test.ts holds it). Compose has no Traefik, one hop short.
   */
  const TRUSTED_HOPS = 2;
  app.set("trust proxy", TRUSTED_HOPS);

  app.use("/api/email", mailBurstLimiter);
  app.use("/api/images", readLimiter);
  // Signup is the tight one; confirm/unsubscribe/manage share a looser bucket.
  app.post("/api/subscribe", createSubscribeLimiter());
  app.use("/api/subscribe", createSubscribeLinkLimiter(), subscribeRoutes);

  // Routers

  app.use('/api/blog', readLimiter, blogRoutes);
  app.use('/api/content', readLimiter, contentRoutes);
  app.use('/api/settings', readLimiter, settingsRoutes);
  app.use('/api/activity', readLimiter, activityRouter);
  app.use('/api/areas', readLimiter, areasRouter);
  app.use('/api/seo/feed', seoLimiter, feedRoutes);
  app.use('/api/seo', seoLimiter, seoRoutes);
  // The gate holds, but an unmetered endpoint is an oracle for guessing the
  // proxy secret.
  // Every write past the gate is recorded, refusals included (#252).
  app.use('/api/admin', adminLimiter, createBearerFailureLimiter(), requireAdmin, auditWrites, indexNowOnWrite, announceOnWrite, adminRoutes);
  app.use('/api/email', emailRoutes);
  app.use("/api/images", createImagesRouter());
  // The contribution year: a cached array, one request per home-page load, so the
  // read limiter is enough (nothing here is on a crawler's path).
  app.use("/api/github", readLimiter, createGithubRouter());

  /*
   * Health, in two depths. Neither is reachable from outside: nginx forwards
   * only /api/* to this process, so both are answered to the container's own
   * HEALTHCHECK and to the Deploy job, which reaches them through
   * `kubectl port-forward`.
   *
   * /health is liveness and stays independent of the store, so a CouchDB
   * outage does not mark the API container unhealthy and get it restarted for
   * a fault it cannot fix. /health/ready is what the Deploy job asserts on
   * after a rollout: the store answered, and this is the build it rolled out
   * (#200). `version` is the commit sha and nothing else; the repository is
   * public, so it tells nobody anything they could not read already.
   */
  app.get("/health", (_req, res) => res.json({ ok: true, version: env.BUILD_SHA }));
  app.get("/health/ready", async (_req, res) => {
    const up = await couch.reachable();
    res.status(up ? 200 : 503).json({ ok: up, db: up ? "up" : "down", version: env.BUILD_SHA });
  });

  /*
   * The catch-all 404, in the same `{ ok: false, error }` shape every other
   * failure answers in (`middlewares/errorHandler.ts`), so a client has one
   * thing to check rather than one shape per way of failing (#131).
   */
  app.use((_req, res) => res.status(404).json({ ok: false, error: "Not Found" }));

  // Last, and with four arguments: Express only routes a thrown or forwarded
  // error to a handler of that arity, and only to one mounted after the
  // routes. See middlewares/errorHandler.ts for the shape and the statuses.
  app.use(errorHandler);

  return app;
}
