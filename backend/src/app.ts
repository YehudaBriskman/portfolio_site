import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createImagesRouter } from "./routes/images.route";
import { createGithubRouter } from "./routes/github.route.js";
import { requestLogger } from "./middlewares/logger";
import emailRoutes from './routes/email.route.js';
import blogRoutes from './routes/blog.route.js';
import adminRoutes from './routes/admin.route.js';
import seoRoutes from './routes/seo.route.js';
import feedRoutes from './routes/feeds.route.js';
import { activityRouter, areasRouter } from './routes/activity.route.js';
import { createBearerFailureLimiter, requireAdmin } from './middlewares/requireAdmin.js';
import { auditWrites } from './services/audit.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { couch } from './db/couch.js';
import { env } from './env.js';

export function createApp() {
  const app = express();

  // Express advertises itself on every response; nothing needs to know.
  app.disable("x-powered-by");

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
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server requests send no Origin at all.
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  // The mail route relays over real SMTP credentials. Unthrottled and public,
  // it is an open relay for anyone who finds it.
  // Two limits, because they defend against different things.
  // Sends: what an abuser actually wants. Validation failures are skipped so a
  // visitor mistyping their address five times is not locked out for 15 minutes.
  const mailSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipFailedRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, error: "Too many messages sent. Try again shortly." },
  });
  // Requests: stops the endpoint being hammered with junk that never validates,
  // which the send limiter deliberately ignores.
  const mailBurstLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, error: "Too many requests. Try again shortly." },
  });
  // Crawler files and the per-URL rendered shells sit on the path every human
  // visitor to /blog and /projects takes, so this ceiling is deliberately high:
  // throttling it would break the page, not just an API call.
  const seoLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  /*
   * Two hops, because there are two proxies, and the count is read off the
   * deploy rather than guessed.
   *
   * The path a request takes in production and in preprod, from the manifests
   * in the oci-free repository (k8s/portfolio.yaml, k8s/portfolio-preprod.yaml,
   * k8s/traefik-config.yaml):
   *
   *     client ──▶ Traefik (k3s ingress) ──▶ nginx (web pod) ──▶ this process
   *
   * Nothing sits in front of Traefik. The apex and www resolve straight to the
   * node's public address (no CDN proxy; checked with `dig` on 2026-11-02), and
   * Traefik's Service runs `externalTrafficPolicy: Local`, which is what stops
   * kube-proxy rewriting the source address — the preprod ipAllowList only
   * works because Traefik sees the real client. So Traefik puts the client in
   * X-Forwarded-For, nginx appends Traefik's pod address with
   * `$proxy_add_x_forwarded_for`, and the socket this process reads is nginx's.
   * Express walks that chain from the right, one entry per trusted hop:
   *
   *     socket = nginx    trusted (hop 1) → step to the last XFF entry
   *     XFF[-1] = Traefik trusted (hop 2) → step to the one before it
   *     XFF[-2] = client  ← req.ip
   *
   * This said 1 until #121, which stopped one step short: req.ip was Traefik's
   * pod address for every visitor, so every limiter below was one bucket for
   * the whole internet, and five messages from anybody silenced the contact
   * form for everybody for fifteen minutes.
   *
   * A count, and never `true`. Trusting every hop makes req.ip the leftmost
   * X-Forwarded-For entry, which is whatever the client typed; one header per
   * request would then buy a fresh bucket per request. With a count, anything a
   * client writes into the header lands to the left of the address Traefik
   * appended and is never reached. If a hop is ever added or removed — a CDN in
   * front, nginx taken out of the path — this number changes with it, and
   * src/rate-limit.test.ts is where the topology is written down as a test.
   *
   * Under Docker Compose there is no Traefik, so the chain is one hop short:
   * req.ip is the Docker network's gateway, and an X-Forwarded-For sent by the
   * client itself would be believed. That is acceptable on a laptop and only
   * there, which is why the count follows the cluster and not the Compose file.
   */
  app.set("trust proxy", 2);

  app.use("/api/email", mailBurstLimiter, mailSendLimiter);
  app.use("/api/images", readLimiter);

  // Routers

  app.use('/api/blog', readLimiter, blogRoutes);
  app.use('/api/activity', readLimiter, activityRouter);
  app.use('/api/areas', readLimiter, areasRouter);
  app.use('/api/seo/feed', seoLimiter, feedRoutes);
  app.use('/api/seo', seoLimiter, seoRoutes);
  // The gate holds, but an unmetered endpoint is an oracle for guessing the
  // proxy secret. Every other route is limited; this one was not.
  // Every write past the gate is recorded, refusals included (#252).
  app.use('/api/admin', adminLimiter, createBearerFailureLimiter(), requireAdmin, auditWrites, adminRoutes);
  app.use('/api/email', emailRoutes);
  app.use("/api/images", createImagesRouter());
  /*
   * The contribution year, on the read limiter the blog uses.
   *
   * One request per home-page load and the answer is a cached array, so the
   * ceiling only has to be above a reader refreshing; it is deliberately not
   * the seoLimiter's 600, because nothing here sits on a crawler's path — the
   * rendered shell in seo.route.ts carries the year's total as prose instead.
   */
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
