import { couch } from "../db/couch.js";
import { auditEntry } from "../services/audit.js";
import { logger } from "../logger.js";
import { deleteContact, deleteSendDocs, scanContacts, updateContact } from "../audience/store.js";
import type { Contact } from "../audience/schemas.js";
import { ledgerClear, ledgerEntries, ledgerPut, writeReport, type LedgerEntry, type LedgerKind } from "../audience/ledger.js";

/*
 * The sender guard: the sender does not run unless the suppression ledger can
 * be read and every contact it protects is in the state the ledger says.
 *
 * Stateless on purpose. It does not try to detect that a restore happened; it
 * compares the two databases every time, so a restore, a bad import and a bug
 * all end the same way: the person is put back in the state they chose, and
 * the owner is told (a count, never an address).
 *
 * Only an ACTIVE contact is ever repaired. Anyone else cannot be mailed, and a
 * pending contact may be a person signing up again on purpose.
 */

const CHUNK = 200;
const BACKFILL_EVERY_MS = 10 * 60_000;
const WARN_EVERY_MS = 5 * 60_000;

export type GuardResult = { ok: true; repaired: number } | { ok: false; reason: "ledger-unavailable" };

let lastBackfill = 0;
let lastWarn = 0;
export const resetGuard = () => { lastBackfill = 0; lastWarn = 0; };

const expired = (e: LedgerEntry, nowMs: number) => e.kind === "erased" && !!e.expiresAt && Date.parse(e.expiresAt) <= nowMs;

/* Contacts whose status already says unsubscribed/suppressed but that the ledger does not know: a write the ledger missed while it was down, or data from before it existed. */
async function backfill(known: ReadonlyMap<string, LedgerEntry>, nowMs: number): Promise<number> {
  if (nowMs - lastBackfill < BACKFILL_EVERY_MS) return 0;
  lastBackfill = nowMs;
  let n = 0;
  for await (const c of scanContacts()) {
    if (c.status !== "unsubscribed" && c.status !== "suppressed") continue;
    const hash = c._id.slice("contact:".length);
    if (known.has(hash)) continue;
    await ledgerPut(hash, c.status);
    n++;
  }
  return n;
}

async function repairOne(c: Contact, e: LedgerEntry): Promise<boolean> {
  const hash = c._id.slice("contact:".length);
  if (c.status !== "active") return false;
  if (e.kind === "erased") {
    await deleteContact(hash);
    await deleteSendDocs(hash);
    return true;
  }
  const kind = e.kind;
  await updateContact(hash, (x) => {
    if (x.status !== "active") return false;
    x.status = kind;
    x.unsubscribedAt = e.at;
  });
  return true;
}

export async function ledgerGuard(nowMs = Date.now()): Promise<GuardResult> {
  try {
    let entries = await ledgerEntries(nowMs);
    for (const [hash, e] of entries) if (expired(e, nowMs)) await ledgerClear(hash);
    if ((await backfill(entries, nowMs)) > 0) entries = await ledgerEntries(nowMs);

    const repaired: Record<LedgerKind, number> = { unsubscribed: 0, suppressed: 0, erased: 0 };
    const live = [...entries].filter(([, e]) => !expired(e, nowMs));
    for (let i = 0; i < live.length; i += CHUNK) {
      const part = new Map(live.slice(i, i + CHUNK));
      const docs = await couch.docs<Contact>([...part.keys()].map((h) => `contact:${h}`));
      for (const c of docs) {
        const e = part.get(c._id.slice("contact:".length));
        if (e && (await repairOne(c, e))) repaired[e.kind]++;
      }
    }
    const total = repaired.unsubscribed + repaired.suppressed + repaired.erased;
    if (total > 0) {
      await writeReport(repaired, new Date(nowMs));
      logger.warn({ repaired }, "suppression ledger repaired contacts that were mailable but must not be");
      const entry = auditEntry({
        at: new Date(nowMs), actor: { login: "system", via: "proxy", tokenId: null }, method: "SYSTEM", path: "ledger.repair", status: 200,
        change: { target: "ledger", before: null, after: repaired },
      });
      await couch.append(entry._id, entry as unknown as Record<string, unknown>).catch(() => undefined);
    }
    return { ok: true, repaired: total };
  } catch (err) {
    // Fails closed: no ledger, no mail.
    if (nowMs - lastWarn >= WARN_EVERY_MS) {
      lastWarn = nowMs;
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "suppression ledger unavailable; the sender is held");
    }
    return { ok: false, reason: "ledger-unavailable" };
  }
}
