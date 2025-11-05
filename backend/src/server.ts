import "dotenv/config";
import { createApp } from "./app";
import { env } from './env.js';
import { logger } from './logger.js';

const app = createApp();

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`API listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  logger.info(`Email service listening on :${env.PORT} (${env.EMAIL_PROVIDER})`)
  console.log(`Images dir: ${process.env.UPLOADS_DIR ?? "src/uploads/"}`);
});
