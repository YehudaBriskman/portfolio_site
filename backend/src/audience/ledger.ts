import { createHmac } from "node:crypto";
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
 * Keyed hash (EMAIL_HASH_KEY set): new lines are keyed by HMAC-SHA256(key, address), so
 * guessing an address is no longer enough to find, or confirm, a line. Lines written before
 * the key existed use the legacy unkeyed hash; every check tests BOTH (a person is blocked if
 * either matches), writes use the keyed one, and rekey.ts moves legacy lines over when the
 * address is known. A legacy line whose address is gone (an erased tombstone) simply stays,
 * and keeps working through the legacy check. Key unset: exactly the old behaviour.
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
const PROBE = "meta:probe";
/* A line for an erased person outlives every backup that still holds them: the 14 dumps kept plus a fortnight of margin. */
export const ERASED_KEEP_DAYS = 30;
const CACHE_MS = 30_000;
/** HMAC-SHA256 of the normalised address, first 32 hex; null when EMAIL_HASH_KEY is unset. */
export const keyedHash = (email: string): string | null =>
  env.EMAIL_HASH_KEY ? createHmac("sha256", env.EMAIL_HASH_KEY).update(email.trim().toLowerCase()).digest("hex").slice(0, 32) : null;

/** Every key a person's line may sit under: keyed first (when the key is set and the address known), then the legacy contact hash. */
export const ledgerKeys = (hash: string, email?: string): string[] => {
  const k = email ? keyedHash(email) : null;
  return k && k !== hash ? [k, hash] : [hash];
};

let warnedUnkeyed = false;
/** One warning per process while EMAIL_HASH_KEY is unset. */
export function warnIfUnkeyed(): void {
  if (env.EMAIL_HASH_KEY || warnedUnkeyed) return;
  warnedUnkeyed = true;
  logger.warn("EMAIL_HASH_KEY is not set: the suppression ledger uses the unkeyed address hash (see docs/newsletter.md)");
}
export const resetUnkeyedWarning = () => { warnedUnkeyed = false; };

/** The line for this person in a loaded map under any of their keys; `suppressed` wins over the rest. */
export function findEntry(entries: ReadonlyMap<string, LedgerEntry>, hash: string, email?: string): LedgerEntry | undefined {
  const found = ledgerKeys(hash, email).flatMap((k) => { const e = entries.get(k); return e ? [e] : []; });
  return found.find((e) => e.kind === "suppressed") ?? found[0];
}

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
  /** Makes sure the database exists: looks first (a plain member may not PUT), creates only on a 404; a 412 is not an error. */
  create: () => Promise<void>;
};

const httpStore: LedgerStore = {
  get: (id) => call(`/${encodeURIComponent(id)}`),
  put: (id, doc) => call(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
  del: (id, rev) => call(`/${encodeURIComponent(id)}?rev=${encodeURIComponent(rev)}`, { method: "DELETE" }),
  all: async () => (await call<{ rows: Array<{ doc?: Record<string, unknown> }> }>("/_all_docs?include_docs=true")).rows.flatMap((r) => (r.doc ? [r.doc] : [])),
  create: async () => {
    /* CouchDB answers a non-admin's PUT /db with 401 even when the database exists, so look first. */
    try {
      await call("");
      return;
    } catch (e) {
      if (!isStatus(e, 404)) throw e;
    }
    try {
      await call("", { method: "PUT" });
    } catch (e) {
      if (isStatus(e, 412)) return;
      if (e instanceof CouchError && (e.status === 401 || e.status === 403)) {
        throw new CouchError(e.status, "the ledger database does not exist and this user may not create it: see docs/newsletter.md", e);
      }
      throw e;
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

export async function ledgerGet(hash: string, email?: string): Promise<LedgerEntry | null> {
  const found: LedgerEntry[] = [];
  for (const k of ledgerKeys(hash, email)) {
    const e = await tryGet<LedgerEntry>(k);
    if (e) found.push(e);
  }
  return found.find((e) => e.kind === "suppressed") ?? found[0] ?? null;
}

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
export const cachedKind = (hash: string, email?: string): LedgerKind | undefined => (cache ? findEntry(cache.entries, hash, email)?.kind : undefined);

/* --- writes ------------------------------------------------------------------- */

/** Records (or changes) a person's line under the keyed hash when it can be computed, else the legacy one. `erased` lines get an expiry. A legacy line for the same person is dropped once the keyed one is written. Throws if the ledger cannot be written. */
export async function ledgerPut(hash: string, kind: LedgerKind, now = new Date(), email?: string): Promise<void> {
  if (!isHash(hash)) throw new Error("ledger key must be a contact hash");
  const [key, ...rest] = ledgerKeys(hash, email) as [string, ...string[]];
  let wrote = false;
  for (let attempt = 0; attempt < 2 && !wrote; attempt++) {
    const prev = await tryGet<LedgerEntry>(key);
    const doc: LedgerEntry = {
      _id: key, ...(prev?._rev ? { _rev: prev._rev } : {}), type: "ledger", kind, at: now.toISOString(),
      ...(kind === "erased" ? { expiresAt: new Date(now.getTime() + ERASED_KEEP_DAYS * 86_400_000).toISOString() } : {}),
    };
    try {
      await store.put(key, doc);
      cache = null;
      wrote = true;
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  if (!wrote) throw new CouchError(409, "ledger line changed concurrently");
  for (const old of rest) await deleteLine(old);
}

async function deleteLine(id: string): Promise<void> {
  const prev = await tryGet<LedgerEntry>(id);
  if (!prev?._rev) return;
  try {
    await store.del(id, prev._rev);
  } catch (e) {
    if (!isStatus(e, 404)) throw e;
  }
  cache = null;
}

/** Removes a person's line under every key (a fresh, confirmed signup). A missing line is fine. Throws if the ledger cannot be written. */
export async function ledgerClear(hash: string, email?: string): Promise<void> {
  for (const k of ledgerKeys(hash, email)) await deleteLine(k);
}

/** Moves a line to another key: written first, old one removed second, so a crash leaves both (blocked twice), never neither. Used by rekey. */
export async function ledgerMove(from: string, to: string): Promise<boolean> {
  const prev = await tryGet<LedgerEntry>(from);
  if (!prev) return false;
  if (!(await tryGet(to))) {
    const { _rev, ...rest } = prev;
    void _rev;
    await store.put(to, { ...rest, _id: to });
  }
  await deleteLine(from);
  cache = null;
  return true;
}

/** For callers that must not fail on a ledger outage (a mail client's one-click POST): the guard backfills what was missed. Never logs an address. */
export async function ledgerPutQuietly(hash: string, kind: LedgerKind, email?: string): Promise<boolean> {
  try {
    await ledgerPut(hash, kind, new Date(), email);
    return true;
  } catch (err) {
    logger.warn({ kind, err: err instanceof Error ? err.message : String(err) }, "suppression ledger write failed; the guard will backfill it");
    return false;
  }
}

/**
 * Creates the database and its marker if missing. Run at boot; never creates
 * lines. Creating the database needs a CouchDB admin; when it already exists a plain member is enough (see docs/newsletter.md).
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

/** Boot hook: prepares the ledger and says so. Never throws; the sender fails closed without it. */
export async function bootLedger(): Promise<boolean> {
  try {
    warnIfUnkeyed();
    await ensureLedger();
    logger.info("suppression ledger ready");
    return true;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "suppression ledger could not be prepared; campaigns will not send until it exists (see docs/newsletter.md)",
    );
    return false;
  }
}

/**
 * True when the ledger can be read (marker present, fresh read) AND written. A
 * campaign is not queued unless this holds: a ledger that cannot take a new
 * unsubscribe is a ledger the sender must not run on. Writes one probe document,
 * which is not a ledger line (its id is not a contact hash).
 */
export async function ledgerWritable(now = new Date()): Promise<boolean> {
  try {
    cache = null;
    await ledgerEntries(now.getTime());
    const cur = await tryGet<{ _rev?: string }>(PROBE);
    await store.put(PROBE, { ...(cur?._rev ? { _rev: cur._rev } : {}), type: "meta", at: now.toISOString() });
    return true;
  } catch {
    return false;
  } finally {
    /* A probe must leave nothing behind: the next reader loads its own copy. */
    cache = null;
  }
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
