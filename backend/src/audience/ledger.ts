import { couchConfig, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

/*
 * The suppression ledger: who must never be mailed again, kept in a database of
 * its own.
 *
 * Why separate: a restore of the content database brings back every contact as
 * it was on the backup's day, including people who have since unsubscribed or
 * asked to be erased. The ledger is never part of that restore, so it still
 * knows. It holds the contact hash, a kind and a date and NOTHING else: no
 * address, no name, no reason text. The hash is the same SHA-256 prefix the
 * contact id uses, so whoever can guess an address can recompute it; the ledger
 * is therefore treated as personal data kept for one purpose (honouring a
 * refusal), and `erased` lines expire.
 *
 * Writes go ledger-first, content second: a crash between them leaves the safe
 * state (the person blocked, not mailed).
 */

export type LedgerKind = "unsubscribed" | "suppressed" | "erased";
export type LedgerEntry = { _id: string; _rev?: string; type: "ledger"; kind: LedgerKind; at: string; expiresAt?: string };
/** Written by the guard when it had to fix a contact; read by the admin banner. Counts only. */
export type LedgerReport = {
  _id: "meta:report";
  _rev?: string;
  at: string;
  repaired: Record<LedgerKind, number>;
  acknowledgedAt?: string;
};

const MARKER = "meta:ledger";
const REPORT = "meta:report";
/* A line for an erased person outlives every backup that still holds them: the 14 dumps kept plus a fortnight of margin. */
export const ERASED_KEEP_DAYS = 30;
const CACHE_MS = 30_000;
export const isHash = (id: string) => /^[0-9a-f]{32}$/.test(id);

/* --- the store: plain HTTP against the ledger database, replaceable in tests --- */

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(`${couchConfig.base}/${env.LEDGER_DB}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { Authorization: couchConfig.auth, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
      });
    } catch (cause) {
      throw new CouchError(0, `ledger unreachable on ${path}`, cause);
    }
    if (!res.ok) throw new CouchError(res.status, `ledger ${res.status} on ${path}`);
    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new CouchError(0, `ledger returned a non-JSON body on ${path}`, cause);
    }
  } finally {
    clearTimeout(t);
  }
}

export type LedgerStore = {
  get: (id: string) => Promise<Record<string, unknown>>;
  put: (id: string, doc: Record<string, unknown>) => Promise<{ rev?: string }>;
  del: (id: string, rev: string) => Promise<unknown>;
  /** Every document with its body; the ledger is small. */
  all: () => Promise<Array<Record<string, unknown>>>;
  /** Creates the database; a 412 (already there) is not an error. */
  create: () => Promise<void>;
};

const httpStore: LedgerStore = {
  get: (id) => call(`/${encodeURIComponent(id)}`),
  put: (id, doc) => call(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
  del: (id, rev) => call(`/${encodeURIComponent(id)}?rev=${encodeURIComponent(rev)}`, { method: "DELETE" }),
  all: async () => (await call<{ rows: Array<{ doc?: Record<string, unknown> }> }>("/_all_docs?include_docs=true")).rows.flatMap((r) => (r.doc ? [r.doc] : [])),
  create: async () => {
    try {
      await call("", { method: "PUT" });
    } catch (e) {
      if (!(e instanceof CouchError && e.status === 412)) throw e;
    }
  },
};

let store: LedgerStore = httpStore;
let cache: { at: number; entries: Map<string, LedgerEntry> } | null = null;

/** Tests only: swap the store, or pass nothing to restore the HTTP one. */
export function useLedgerStore(s?: LedgerStore): void {
  store = s ?? httpStore;
  cache = null;
}
export const resetLedgerCache = () => { cache = null; };

const isStatus = (e: unknown, s: number) => e instanceof CouchError && e.status === s;
async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return (await store.get(id)) as T;
  } catch (e) {
    if (isStatus(e, 404)) return null;
    throw e;
  }
}

/* --- reads -------------------------------------------------------------------- */

export const ledgerGet = (hash: string) => tryGet<LedgerEntry>(hash);

/**
 * Every ledger line, cached for 30 seconds (and dropped by this process's own
 * writes). Throws when the ledger cannot be read OR when its marker is missing:
 * an empty database that was never set up is indistinguishable from a ledger
 * that lost everything, and neither may be taken for "nobody to protect".
 */
export async function ledgerEntries(now = Date.now()): Promise<Map<string, LedgerEntry>> {
  if (cache && now - cache.at < CACHE_MS) return cache.entries;
  const docs = await store.all();
  if (!docs.some((d) => d._id === MARKER)) throw new CouchError(404, "ledger marker missing");
  const entries = new Map<string, LedgerEntry>();
  for (const d of docs) if (typeof d._id === "string" && isHash(d._id) && d.type === "ledger") entries.set(d._id, d as LedgerEntry);
  cache = { at: now, entries };
  return entries;
}

/** The kind the cache holds for this hash, without any I/O; undefined when unknown or not loaded. */
export const cachedKind = (hash: string): LedgerKind | undefined => cache?.entries.get(hash)?.kind;

/* --- writes ------------------------------------------------------------------- */

/** Records (or changes) a person's line. `erased` lines get an expiry. Throws if the ledger cannot be written. */
export async function ledgerPut(hash: string, kind: LedgerKind, now = new Date()): Promise<void> {
  if (!isHash(hash)) throw new Error("ledger key must be a contact hash");
  for (let attempt = 0; attempt < 2; attempt++) {
    const prev = await ledgerGet(hash);
    const doc: LedgerEntry = {
      _id: hash, ...(prev?._rev ? { _rev: prev._rev } : {}), type: "ledger", kind, at: now.toISOString(),
      ...(kind === "erased" ? { expiresAt: new Date(now.getTime() + ERASED_KEEP_DAYS * 86_400_000).toISOString() } : {}),
    };
    try {
      await store.put(hash, doc);
      cache = null;
      return;
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  throw new CouchError(409, "ledger line changed concurrently");
}

/** Removes a person's line (a fresh, confirmed signup). A missing line is fine. Throws if the ledger cannot be written. */
export async function ledgerClear(hash: string): Promise<void> {
  const prev = await ledgerGet(hash);
  if (!prev?._rev) return;
  try {
    await store.del(hash, prev._rev);
  } catch (e) {
    if (!isStatus(e, 404)) throw e;
  }
  cache = null;
}

/** For callers that must not fail on a ledger outage (a mail client's one-click POST): the guard backfills what was missed. Never logs an address. */
export async function ledgerPutQuietly(hash: string, kind: LedgerKind): Promise<boolean> {
  try {
    await ledgerPut(hash, kind);
    return true;
  } catch (err) {
    logger.warn({ kind, err: err instanceof Error ? err.message : String(err) }, "suppression ledger write failed; the guard will backfill it");
    return false;
  }
}

/**
 * Creates the database and its marker if missing. Run at boot; never creates
 * lines. Needs a credential that may create databases (see docs/newsletter.md).
 */
export async function ensureLedger(): Promise<void> {
  await store.create();
  if (!(await tryGet(MARKER))) {
    try {
      await store.put(MARKER, { type: "meta", createdAt: new Date().toISOString() });
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  cache = null;
}

/* --- the report the admin banner shows ---------------------------------------- */

export const ledgerReport = () => tryGet<LedgerReport>(REPORT);

/** Adds to the open (unacknowledged) report, or opens a new one. Counts only. */
export async function writeReport(repaired: Record<LedgerKind, number>, now = new Date()): Promise<void> {
  const prev = await tryGet<LedgerReport>(REPORT);
  const open = prev && !prev.acknowledgedAt ? prev.repaired : { unsubscribed: 0, suppressed: 0, erased: 0 };
  const sum = { unsubscribed: open.unsubscribed + repaired.unsubscribed, suppressed: open.suppressed + repaired.suppressed, erased: open.erased + repaired.erased };
  await store.put(REPORT, { ...(prev?._rev ? { _rev: prev._rev } : {}), _id: REPORT, at: now.toISOString(), repaired: sum });
}

export async function acknowledgeReport(now = new Date()): Promise<boolean> {
  const prev = await tryGet<LedgerReport>(REPORT);
  if (!prev || prev.acknowledgedAt) return false;
  await store.put(REPORT, { ...prev, acknowledgedAt: now.toISOString() });
  return true;
}

/** A Map-backed ledger with CouchDB's revision rules, for tests (`down` simulates an outage). */
export function memoryLedgerStore(opts: { marker?: boolean } = {}): LedgerStore & { docs: Map<string, Record<string, unknown>>; down: boolean } {
  const docs = new Map<string, Record<string, unknown>>();
  let n = 0;
  const m = {
    docs,
    down: false,
    get: async (id: string) => {
      if (m.down) throw new CouchError(0, "down");
      const d = docs.get(id);
      if (!d) throw new CouchError(404, "404");
      return structuredClone(d);
    },
    put: async (id: string, doc: Record<string, unknown>) => {
      if (m.down) throw new CouchError(0, "down");
      const ex = docs.get(id);
      if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
      const rev = `${++n}-x`;
      docs.set(id, { ...structuredClone(doc), _id: id, _rev: rev });
      return { rev };
    },
    del: async (id: string, rev: string) => {
      if (m.down) throw new CouchError(0, "down");
      const ex = docs.get(id);
      if (!ex) throw new CouchError(404, "404");
      if (ex._rev !== rev) throw new CouchError(409, "409");
      docs.delete(id);
      return { ok: true };
    },
    all: async () => {
      if (m.down) throw new CouchError(0, "down");
      return [...docs.values()].map((d) => structuredClone(d));
    },
    create: async () => {
      if (m.down) throw new CouchError(0, "down");
    },
  };
  if (opts.marker !== false) docs.set(MARKER, { _id: MARKER, _rev: "0-x", type: "meta" });
  return m;
}
