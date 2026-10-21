import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createImagesRouter } from "./routes/images.route";
import { requestLogger } from "./middlewares/logger";
import emailRoutes from './routes/email.route.js';
import blogRoutes from './routes/blog.route.js';
import adminRoutes from './routes/admin.route.js';
import seoRoutes from './routes/seo.route.js';
import { requireAdmin } from './middlewares/requireAdmin.js';

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

  // Behind nginx and Traefik, so the client address arrives in X-Forwarded-For.
  // Trust exactly one hop: trusting them all lets a client spoof the header and
  // hand itself a fresh rate-limit bucket per request.
  app.set("trust proxy", 1);

  app.use("/api/email", mailBurstLimiter, mailSendLimiter);
  app.use("/api/images", readLimiter);

  // Routers

  app.use('/api/blog', readLimiter, blogRoutes);
  app.use('/api/seo', seoLimiter, seoRoutes);
  // The gate holds, but an unmetered endpoint is an oracle for guessing the
  // proxy secret. Every other route is limited; this one was not.
  app.use('/api/admin', adminLimiter, requireAdmin, adminRoutes);
  app.use('/api/email', emailRoutes);
  app.use("/api/images", createImagesRouter());

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 404 כללי (לא חובה, אבל שימושי)
  app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

  return app;
}
