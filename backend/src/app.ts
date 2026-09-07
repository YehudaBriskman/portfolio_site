import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createImagesRouter } from "./routes/images.route";
import { requestLogger } from "./middlewares/logger";
import emailRoutes from './routes/email.route.js';
import blogRoutes from './routes/blog.route.js';

export function createApp() {
  const app = express();

  // Middlewares
  app.use(cors());
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
  app.use('/api/email', emailRoutes);
  app.use("/api/images", createImagesRouter());

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 404 כללי (לא חובה, אבל שימושי)
  app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

  return app;
}
