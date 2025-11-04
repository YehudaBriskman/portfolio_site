import express from "express";
import cors from "cors";
import { createImagesRouter } from "./routes/images.route";
import { requestLogger } from "./middleware/logger";

/**
 * יוצר מופע Express מוכן לשימוש בטסטים / שרת
 * בלי app.listen – כך אפשר להריץ עם supertest בלי לפתוח פורטים.
 */
export function createApp() {
  const app = express();

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  // Routers
  app.use("/api", createImagesRouter());

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 404 כללי (לא חובה, אבל שימושי)
  app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

  return app;
}
