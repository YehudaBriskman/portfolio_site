import { logger } from "../logger.js";
import { hashEmail, scanContacts } from "./store.js";
import { keyedHash, ledgerEntries, ledgerMove, resetLedgerCache } from "./ledger.js";

/*
 * One-off, idempotent re-key of the suppression ledger (EMAIL_HASH_KEY).
 *
 * For every contact whose address is still held, a ledger line under the legacy
 * unkeyed hash is moved to the keyed hash (written first, old line removed
 * second). Lines with no contact behind them (erased tombstones, minimised
 * unsubscribers) stay under the legacy hash and keep blocking through the
 * legacy check. Safe to run twice: the second run finds nothing to move.
 * Returns counts only; no address or hash is logged.
 */
export type RekeyResult = { moved: number; legacyOnly: number };

export async function rekeyLedger(opts: { apply?: boolean } = {}): Promise<RekeyResult> {
  const apply = opts.apply !== false;
  if (!keyedHash("probe@example.invalid")) throw new Error("EMAIL_HASH_KEY is not set; nothing to re-key to");
  resetLedgerCache();
  const entries = await ledgerEntries();
  let moved = 0;
  const keyedOfHeld = new Set<string>();
  for await (const c of scanContacts()) {
    if (!c.email) continue;
    const keyed = keyedHash(c.email);
    if (!keyed) continue;
    keyedOfHeld.add(keyed);
    const legacy = hashEmail(c.email);
    if (entries.has(legacy) && (!apply || (await ledgerMove(legacy, keyed)))) moved++;
  }
  resetLedgerCache();
  const after = await ledgerEntries();
  /* Lines still under an id no held address maps to: tombstones waiting for their address to come back, or for expiry. */
  let legacyOnly = 0;
  for (const id of after.keys()) if (!keyedOfHeld.has(id)) legacyOnly++;
  const result = { moved, legacyOnly };
  logger.info(result, "suppression ledger re-keyed");
  return result;
}
