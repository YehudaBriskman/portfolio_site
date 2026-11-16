/*
 * Re-keys the suppression ledger to the keyed address hash. Dry run by default.
 *
 *   COUCHDB_URL=http://127.0.0.1:5984 COUCHDB_USER=... COUCHDB_PASSWORD=... \
 *   EMAIL_HASH_KEY=<the production value> \
 *     npx tsx scripts/rekey-ledger.ts            # dry run: counts only
 *   ... npx tsx scripts/rekey-ledger.ts --apply  # moves the lines
 *
 * Idempotent: a second run moves nothing. A line whose address is no longer
 * held stays under the legacy hash and keeps blocking. Prints counts only, never
 * an address or a hash. COUCHDB_URL and EMAIL_HASH_KEY have no defaults on purpose:
 * say which store you mean (port-forward the CouchDB service, as scripts/api-token.ts
 * does) and use the same key the API runs with. See docs/newsletter.md.
 */
import { REKEY_ENV_DEFAULTS } from "./rekey-env.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const APPLY = args.includes("--apply");
  for (const a of args) {
    if (a !== "--apply") {
      console.error(`unknown argument ${a}. Usage: rekey-ledger.ts [--apply]`);
      process.exit(2);
    }
  }
  if (!process.env.COUCHDB_URL || !process.env.EMAIL_HASH_KEY) {
    console.error("COUCHDB_URL and EMAIL_HASH_KEY are both required (no defaults, on purpose).");
    process.exit(2);
  }
  for (const [k, v] of Object.entries(REKEY_ENV_DEFAULTS)) process.env[k] ??= v;

  // Imported only now: src/env.ts parses process.env as it loads.
  const { rekeyLedger } = await import("../src/audience/rekey.js");
  const r = await rekeyLedger({ apply: APPLY });
  console.log(`${APPLY ? "moved" : "would move"} ${r.moved} line(s); ${r.legacyOnly} line(s) remain under a legacy hash (no held address).`);
  if (!APPLY) console.log("Dry run. Pass --apply to write.");
  process.exit(0);
}

void main();
