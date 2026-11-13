import "dotenv/config";
import { startStatsRefresh } from "./services/github.js";
import { startContributionsRefresh } from "./services/contributions.js";
import { couch } from "./db/couch.js";
import type { Collection } from "./schemas/content.js";
import { loadSiteReleases } from "./services/activity.js";
import { createApp } from "./app";
import { env } from './env.js';
import { logger } from './logger.js';
import { startSender } from './campaigns/sender.js';
import { startAudienceSweep } from './audience/sweep.js';
import { ensureSendIndex } from './campaigns/store.js';
import { ensureLedger } from './audience/ledger.js';
import { startOwnerNotifier } from './notify/notifier.js';

const app = createApp();

const { PORT: port, HOST: host } = env;

const server = app.listen(port, host, () => {
  logger.info(`API listening on ${host}:${port} (email: ${env.EMAIL_PROVIDER})`);
});

/*
 * Node is PID 1 in the container and has no default SIGTERM action there, so
 * without a handler a rollout waits out the grace period and SIGKILLs it
 * mid-request. Stop accepting, let in-flight requests finish, and force the
 * exit if a keep-alive connection holds the server open past the timeout.
 */
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  const force = setTimeout(() => {
    logger.error("graceful shutdown timed out; exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();
  server.close((err) => process.exit(err ? 1 : 0));
  server.closeIdleConnections?.();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason instanceof Error ? reason.message : String(reason) }, "unhandled rejection");
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
  /* The monthly limit counts a person's sent mails by time; without this it would scan every result doc. */
  await ensureSendIndex();
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
        /*
         * `updatedAt` is left alone on purpose. It is what the sitemap publishes
         * as <lastmod>, and a star count moving is not the page changing. This
         * used to stamp "now" on every collection every cycle, so every project
         * and area URL read as modified minutes ago, forever; Google learns that
         * a site's lastmod is noise and then stops using it to schedule crawls.
         */
        await couch.put(c._id!, c);
      },
      // The site's own `v*` releases, for the activity feed's `site` events.
      siteReleases: {
        repo: { owner: env.SITE_REPO.split("/")[0], name: env.SITE_REPO.split("/")[1] },
        load: loadSiteReleases,
        save: async (doc) => {
          await couch.put(doc._id, doc);
        },
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

/*
 * The suppression ledger's own database. Not fatal, but the sender refuses to
 * run without it (campaigns/guard.ts), so a failure here is the loud kind.
 */
ensureLedger()
  .then(() => logger.info("suppression ledger ready"))
  .catch((err: unknown) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "suppression ledger could not be prepared; campaigns will not send until it exists (see docs/newsletter.md)",
    );
  });

/* The campaign sender: resumable, so a restart only costs the time until the next tick. */
startSender();
/* List hygiene: unconfirmed signups expire on their own, not only when the admin is opened. */
startAudienceSweep();

/* Owner notifications: subscribes to the event seams; nothing it does can fail a send. */
startOwnerNotifier();
