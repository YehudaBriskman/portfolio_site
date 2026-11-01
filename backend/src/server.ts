import "dotenv/config";
import { startStatsRefresh } from "./services/github.js";
import { startContributionsRefresh } from "./services/contributions.js";
import { couch } from "./db/couch.js";
import type { Collection } from "./schemas/content.js";
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

startStatsRefresh({
  list: async () => (await couch.find<Collection>({ selector: { type: "collection" }, limit: 100 })).docs,
  save: async (c) => {
    await couch.put(c._id!, { ...c, updatedAt: new Date().toISOString() });
  },
});

/*
 * The contribution year keeps itself warm.
 *
 * No injected store, unlike the stats refresh above: a contribution calendar
 * belongs to no collection document, so the cache is the service's own and this
 * call only starts its clock. The first reader fills a cold cache regardless,
 * so a failure here costs a slower first paint and nothing else.
 */
startContributionsRefresh();
