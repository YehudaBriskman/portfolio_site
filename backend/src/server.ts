import "dotenv/config";
import express from "express";
import cors from "cors";
import { createImagesRouter } from "./routes/images.route";
import { requestLogger } from "./middleware/logger";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

// Routers
app.use("/api", createImagesRouter());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 5000);
app.listen(port,'0.0.0.0', () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Images dir: ${process.env.UPLOADS_DIR ?? "uploads/"}`);
});
