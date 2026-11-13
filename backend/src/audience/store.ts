import { createHash } from "node:crypto";
import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import { loadSettings } from "../announce/store.js";
import { getConsentText } from "./consent-texts.js";
import { SYSTEM_GROUP, type Consent, type Contact, type Group, type Lang } from "./schemas.js";
import { ledgerGet, ledgerPut } from "./ledger.js";
import { signToken, verifyToken } from "./tokens.js";

export { signToken, verifyToken };

const CONTACT = "contact:";
const GROUP = "audience:";
const isStatus = (e: unknown, s: number) => e instanceof CouchError && e.status === s;

/** The identity of an address: SHA-256 of the lowercased, trimmed address, first 32 hex chars. */
export const hashEmail = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
export const contactId = (hash: string) => `${CONTACT}${hash}`;
export const groupId = (slug: string) => `${GROUP}${slug}`;

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (isStatus(e, 404)) return null;
    throw e;
  }
}

export const getContact = (hash: string) => tryGet<Contact>(contactId(hash));

/** Creates the contact; false when it already exists. */
export async function createContact(c: Contact): Promise<boolean> {
  try {
    await couch.append(c._id, c as unknown as Record<string, unknown>);
    return true;
  } catch (e) {
    if (isStatus(e, 409)) return false;
    throw e;
  }
}

/** Read-modify-write, retried once on a revision clash. `change` returns false to leave the doc as it is. */
export async function updateContact(hash: string, change: (c: Contact) => boolean | void): Promise<Contact | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const c = await getContact(hash);
    if (!c) return null;
    if (change(c) === false) return c;
    c.updatedAt = new Date().toISOString();
    try {
      const r = await couch.put<{ rev?: string }>(c._id, c);
      if (r && typeof r.rev === "string") c._rev = r.rev;
      return c;
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  throw new CouchError(409, "contact changed concurrently");
}

export async function deleteContact(hash: string): Promise<boolean> {
  const c = await getContact(hash);
  if (!c?._rev) return false;
  try {
    await couch.del(c._id, c._rev);
    return true;
  } catch (e) {
    if (isStatus(e, 404)) return false;
    throw e;
  }
}

export async function isSuppressed(email: string): Promise<boolean> {
  return (await getContact(hashEmail(email)))?.status === "suppressed";
}

/** Every contact, in id order, a page at a time. */
export async function* scanContacts(after = ""): AsyncGenerator<Contact> {
  const PAGE = 500;
  let cursor = after || CONTACT;
  for (;;) {
    const { docs } = await couch.find<Contact>({
      selector: { _id: { $gt: cursor, $lt: `${CONTACT}￿` } },
      sort: [{ _id: "asc" }],
      limit: PAGE,
    });
    for (const d of docs) yield d;
    if (docs.length < PAGE) return;
    cursor = docs[docs.length - 1]._id;
  }
}

/** Active contacts only; an empty `groups` list matches nobody. */
export async function* listRecipients(opts: {
  groups: string[];
  lang?: Lang;
  topic?: "blog" | "releases";
}): AsyncGenerator<Contact> {
  if (opts.groups.length === 0) return;
  for await (const c of scanContacts()) {
    if (c.status !== "active") continue;
    if (!c.groups.some((g) => opts.groups.includes(g))) continue;
    if (opts.lang && c.lang !== opts.lang) continue;
    if (opts.topic && !c.topics?.[opts.topic]) continue;
    yield c;
  }
}

/* --- pending expiry --------------------------------------------------- */

export const isPendingExpired = (c: Contact, ttlDays: number, now = Date.now()) =>
  c.status === "pending" && Date.parse(c.updatedAt) + ttlDays * 86_400_000 <= now;

let lastPurge = 0;
/** Lazy cleanup: deletes pending contacts past the TTL. Runs at most once a minute per process; never throws. */
export async function purgeExpiredPending(now = Date.now(), force = false): Promise<number> {
  if (!force && now - lastPurge < 60_000) return 0;
  lastPurge = now;
  try {
    const ttl = (await loadSettings()).sender.pendingTtlDays;
    let n = 0;
    for await (const c of scanContacts()) {
      if (isPendingExpired(c, ttl, now) && c._rev) {
        try {
          await couch.del(c._id, c._rev);
          n++;
        } catch (e) {
          if (!isStatus(e, 409) && !isStatus(e, 404)) throw e;
        }
      }
    }
    return n;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "pending subscription cleanup failed");
    return 0;
  }
}
export const resetPurgeClock = () => { lastPurge = 0; };

/* --- minimisation ------------------------------------------------------ */

/* Days after unsubscribing that the address, name and language are dropped. Backups follow their own rotation and are not touched. */
export const MINIMISE_AFTER_DAYS = 30;

export const isMinimisable = (c: Contact, now = Date.now()) =>
  c.status === "unsubscribed" && !c.minimisedAt && Date.parse(c.unsubscribedAt ?? c.updatedAt) + MINIMISE_AFTER_DAYS * 86_400_000 <= now;

/**
 * Drops everything about an unsubscribed person except what proves the refusal
 * and the consent: the id (the one-way fingerprint), status, the consent and
 * unsubscribe times and the id/hash of the wording they saw. The ledger line
 * (hash + kind + date) is the other half and is written by the caller FIRST.
 * Free-text consent notes and the consent language go too: they can describe a person.
 */
export function minimise(c: Contact, at: string): void {
  const keep = (k: Consent): Consent => ({
    textId: k.textId, textHash: k.textHash, at: k.at, source: k.source, ...(k.confirmedAt ? { confirmedAt: k.confirmedAt } : {}),
  });
  const history = consentHistoryOf(c).map(keep);
  c.email = "";
  delete c.name;
  delete c.lang;
  delete c.softBounces;
  delete c.suppressedReason;
  c.groups = [];
  c.topics = { blog: false, releases: false };
  c.consentHistory = history;
  c.consent = history[history.length - 1];
  c.consentNote = c.consent.textId ?? "";
  c.minimisedAt = at;
}

/** Minimises every unsubscribed contact past the grace period. Returns how many. A failed contact is skipped, not fatal. */
export async function minimiseUnsubscribed(now = Date.now()): Promise<number> {
  let n = 0;
  for await (const c of scanContacts()) {
    if (!isMinimisable(c, now)) continue;
    const hash = c._id.slice(CONTACT.length);
    // Ledger first: if it cannot be written the address stays, because the line is what keeps a returning address blocked after a restore.
    if (!(await ledgerGet(hash).catch(() => null))) {
      try {
        await ledgerPut(hash, "unsubscribed");
      } catch {
        continue;
      }
    }
    const done = await updateContact(hash, (x) => {
      if (!isMinimisable(x, now)) return false;
      minimise(x, new Date(now).toISOString());
    }).catch(() => null);
    if (done?.minimisedAt) n++;
  }
  return n;
}

/** Every per-recipient result document of one contact, read only; the counterpart of deleteSendDocs. */
export async function listSendDocs(hash: string): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let cursor = "send:";
  for (;;) {
    const { docs } = await couch.find<Record<string, unknown> & { _id: string }>({
      selector: { _id: { $gt: cursor, $lt: "send:￿" } },
      sort: [{ _id: "asc" }],
      limit: 1000,
    });
    for (const d of docs) if (d._id.endsWith(`:${hash}`)) out.push(d);
    if (docs.length < 1000) return out;
    cursor = docs[docs.length - 1]._id;
  }
}

/* --- groups ------------------------------------------------------------ */

export async function ensureSystemGroup(): Promise<void> {
  const g: Group = { _id: groupId(SYSTEM_GROUP), type: "audience", name: "Subscribers", kind: "system", createdAt: new Date().toISOString() };
  try {
    await couch.append(g._id, g as unknown as Record<string, unknown>);
  } catch (e) {
    if (!isStatus(e, 409)) throw e;
  }
}

export async function listGroups(): Promise<Group[]> {
  const { docs } = await couch.find<Group>({ selector: { _id: { $gt: GROUP, $lt: `${GROUP}￿` } }, limit: 500 });
  return docs.sort((a, b) => a._id.localeCompare(b._id));
}
export const getGroup = (slug: string) => tryGet<Group>(groupId(slug));

/* --- consent records --------------------------------------------------- */

/**
 * The current consent of a contact, whatever its age. Older documents carry
 * only consentAt/consentNote (a form version for site signups, the owner's
 * note otherwise); this reads them as a consent without rewriting anything.
 */
export function consentOf(c: Contact): Consent {
  if (c.consent) return c.consent;
  const text = c.source === "site" ? getConsentText(c.consentNote) : undefined;
  return {
    textId: text?.id ?? null,
    textHash: text?.sha256 ?? null,
    lang: c.lang,
    at: c.consentAt,
    ...(c.confirmedAt ? { confirmedAt: c.confirmedAt } : {}),
    source: c.source,
    ...(text ? {} : { note: c.consentNote }),
  };
}

/** The full trail, oldest first; a legacy document has exactly one entry. */
export const consentHistoryOf = (c: Contact): Consent[] => (c.consentHistory?.length ? c.consentHistory : [consentOf(c)]);

/** Records a new consent: appended to the history, never replacing an earlier entry. consentAt/consentNote stay in step for readers of the old fields. */
export function recordConsent(c: Contact, next: Consent): void {
  const history = consentHistoryOf(c).map((e) => ({ ...e }));
  history.push(next);
  c.consentHistory = history;
  c.consent = next;
  c.consentAt = next.at;
  c.consentNote = next.textId ?? next.note ?? c.consentNote;
}

/** Marks the current consent confirmed (the double opt-in click), in the history too. */
export function confirmConsent(c: Contact, at: string): void {
  const history = consentHistoryOf(c).map((e) => ({ ...e }));
  const last = history[history.length - 1];
  last.confirmedAt = at;
  c.consentHistory = history;
  c.consent = last;
}

let backfilled = false;
/**
 * Adds consent/consentHistory to contacts that only have the old fields.
 * Purely additive and idempotent; runs once per process and never throws.
 * It writes the document itself, not through updateContact, so updatedAt (the
 * pending-expiry clock) does not move.
 */
export async function backfillConsent(): Promise<number> {
  if (backfilled) return 0;
  backfilled = true;
  let n = 0;
  try {
    for await (const c of scanContacts()) {
      if (c.consent) continue;
      const one = consentOf(c);
      try {
        await couch.put(c._id, { ...c, consent: one, consentHistory: [one] });
        n++;
      } catch (e) {
        if (!isStatus(e, 409)) throw e;
      }
    }
  } catch (err) {
    backfilled = false;
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "consent backfill failed");
  }
  return n;
}
export const resetConsentBackfill = () => { backfilled = false; };

/* --- erasure --------------------------------------------------------------- */

/**
 * Deletes every per-recipient result document of one contact (`send:<campaign>:<hash>`).
 * The id has the hash LAST, so there is no prefix to seek on: this walks the
 * send documents. Erasure is rare and the set is small. Returns how many went.
 */
export async function deleteSendDocs(hash: string): Promise<number> {
  let n = 0;
  let cursor = "send:";
  for (;;) {
    const { docs } = await couch.find<{ _id: string; _rev?: string }>({
      selector: { _id: { $gt: cursor, $lt: "send:￿" } },
      sort: [{ _id: "asc" }],
      limit: 1000,
    });
    for (const d of docs) {
      if (!d._id.endsWith(`:${hash}`) || !d._rev) continue;
      try {
        await couch.del(d._id, d._rev);
        n++;
      } catch (e) {
        if (!isStatus(e, 404) && !isStatus(e, 409)) throw e;
      }
    }
    if (docs.length < 1000) return n;
    cursor = docs[docs.length - 1]._id;
  }
}
