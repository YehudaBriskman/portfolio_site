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

/*
 * The content store's own shape, ensured before anything reads or writes it.
 *
 * Deliberately after app.listen and deliberately not fatal: the API answers
 * /api/email, /api/github and the crawler files without CouchDB, and
 * src/env.ts requires nothing of the store at boot for that reason. A store
 * that cannot be prepared must therefore degrade the content routes, not take
 * the whole service down with it — but it must say so in the log, because the
 * failure it replaces was completely silent. See couch.ensureDatabase for why
 * the API creates its database at all.
 */
async function ensureContentStore(): Promise<void> {
  await couch.ensureDatabase();
  /*
   * The blog selector sorts on [type, status, publishedAt] and Mango refuses a
   * sort it has no index for, so without this every /api/blog/posts answers
   * 400 — which on the page is the same error card as the store being down.
   * Same name and same fields as backend/scripts/seed-dev-content.mjs creates,
   * so the two cannot produce a second, divergent index.
   *
   * couch.ensureIndex has existed since the client was written and was called
   * from nowhere. The only thing that had ever created this index was a seed
   * script somebody had to know to run, which is precisely how a namespace
   * ends up serving 404s to every read.
   */
  await couch.ensureIndex("type-status-publishedAt", ["type", "status", "publishedAt"]);
}

ensureContentStore()
  .then(() => logger.info("content store ready: database and query index present"))
  .catch((err: unknown) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "content store could not be prepared; content reads will fail until it is",
    );
  })
  .finally(() => {
    /*
     * Chained rather than started at module scope: on a fresh namespace this
     * wrote collection documents into a database that did not exist yet, and
     * its first pass failed for that reason alone. `finally` and not `then` —
     * if the bootstrap failed the refresh should still run and report its own
     * failures rather than quietly never starting.
     */
    startStatsRefresh({
      list: async () =>
        (await couch.find<Collection>({ selector: { type: "collection" }, limit: 100 })).docs,
      save: async (c) => {
        await couch.put(c._id!, { ...c, updatedAt: new Date().toISOString() });
      },
    });
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
