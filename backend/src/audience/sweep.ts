import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import { purgeExpiredPending } from "./store.js";

/*
 * The scheduled list-hygiene sweep. The lazy purge in store.ts only runs when
 * someone visits the admin or signs up; the privacy text promises an unconfirmed
 * address is deleted after about a week whether anyone visits or not, so a timer
 * does it too.
 *
 * One process runs the API, so an in-process `running` flag is the lock. Every
 * step is idempotent (deleting what is already gone is a no-op), so a second
 * instance or a restart mid-run only repeats work. Counts, never addresses, are
 * kept and logged.
 */

export const SWEEP_ID = "sweep:audience";
const SWEEP_MS = 60 * 60_000;

export type SweepReport = {
  _id: typeof SWEEP_ID;
  _rev?: string;
  type: "sweep-report";
  /** When the last run finished. */
  at: string;
  /** Unconfirmed signups deleted by the last run, and by every run since `since`. */
  lastPurged: number;
  totalPurged: number;
  since: string;
};

export const getSweepReport = async (): Promise<SweepReport | null> => {
  try {
    return await couch.get<SweepReport>(SWEEP_ID);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
};

async function record(purged: number, now: number): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const prev = await getSweepReport();
    const doc: SweepReport = {
      _id: SWEEP_ID,
      ...(prev?._rev ? { _rev: prev._rev } : {}),
      type: "sweep-report",
      at: new Date(now).toISOString(),
      lastPurged: purged,
      totalPurged: (prev?.totalPurged ?? 0) + purged,
      since: prev?.since ?? new Date(now).toISOString(),
    };
    try {
      await couch.put(SWEEP_ID, doc);
      return;
    } catch (e) {
      if (!(e instanceof CouchError && e.status === 409)) throw e;
    }
  }
}

let running = false;

/** One pass. Never throws; returns what it did, or null when a pass was already running or failed. */
export async function runAudienceSweep(now = Date.now()): Promise<{ purged: number } | null> {
  if (running) return null;
  running = true;
  try {
    const purged = await purgeExpiredPending(now, true);
    await record(purged, now);
    if (purged > 0) logger.info({ purged }, "audience sweep removed expired unconfirmed signups");
    return { purged };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "audience sweep failed");
    return null;
  } finally {
    running = false;
  }
}

/** Starts the timer (and one run shortly after boot). Unref'd so it never holds the process open. */
export function startAudienceSweep(every = SWEEP_MS): () => void {
  const first = setTimeout(() => void runAudienceSweep(), 60_000);
  first.unref?.();
  const t = setInterval(() => void runAudienceSweep(), every);
  t.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(t);
  };
}
