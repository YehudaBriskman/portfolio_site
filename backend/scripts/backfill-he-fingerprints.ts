/*
 * The Hebrew fingerprint backfill (#303). Dry run by default.
 *
 *   COUCHDB_URL=http://127.0.0.1:5984 COUCHDB_USER=... COUCHDB_PASSWORD=... \
 *     npx tsx scripts/backfill-he-fingerprints.ts            # dry run: lists what it would stamp
 *   ... npx tsx scripts/backfill-he-fingerprints.ts --apply  # writes it
 *
 * For every note, area and content document holding Hebrew with no
 * fingerprint, records the fingerprint of the English beside it today (see
 * src/services/he-backfill.ts for why that is true). Until it runs, that Hebrew
 * reads as "unverified" in the Translations report, which every consumer
 * treats as translated, so running it is not urgent; it is what makes the
 * next English edit show as stale.
 *
 * What it will and will not do:
 *   - Dry run unless `--apply` is given. The dry run only reads.
 *   - Only fills an absent fingerprint. Never replaces one, never changes a
 *     word of text, never deletes. Idempotent: a second run writes nothing.
 *   - Writes each document with the `_rev` it read, so an edit that lands in
 *     between is a conflict, reported and skipped, never overwritten.
 *   - Appends one entry per write to the admin audit log, as the API does.
 *
 * Take a backup of the store first. COUCHDB_URL has no default on purpose:
 * say which store you mean (for production, port-forward the CouchDB service
 * and point at the forward, as scripts/api-token.ts does).
 */
import { createHash, randomBytes } from "node:crypto";
import { backfillDoc } from "../src/services/he-backfill";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
for (const a of args) {
  if (a !== "--apply") {
    console.error(`unknown argument ${a}. Usage: backfill-he-fingerprints.ts [--apply]`);
    process.exit(2);
  }
}

const url = process.env.COUCHDB_URL;
if (!url) {
  console.error("COUCHDB_URL is required (no default: say which store you mean).");
  process.exit(2);
}
const base = `${url.replace(/\/+$/, "")}/${process.env.COUCHDB_DB ?? "portfolio_content"}`;
const auth = "Basic " + Buffer.from(`${process.env.COUCHDB_USER ?? ""}:${process.env.COUCHDB_PASSWORD ?? ""}`).toString("base64");
const headers = { Authorization: auth, "Content-Type": "application/json" };

type Raw = Record<string, unknown>;

/*
 * The audit entry, shaped as src/services/audit.ts writes one. Built here
 * rather than imported: that module loads the API's environment, which a
 * script has no business needing.
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out: Raw = {};
    for (const k of Object.keys(v as object).sort()) if (k !== "_rev") out[k] = canonical((v as Raw)[k]);
    return out;
  }
  return v;
}

const docHash = (doc: unknown) => (doc == null ? null : createHash("sha256").update(JSON.stringify(canonical(doc))).digest("hex"));

function auditEntry(target: string, before: unknown, after: unknown) {
  const at = new Date().toISOString();
  return {
    _id: `audit:${at}:${randomBytes(4).toString("hex")}`,
    type: "audit",
    at,
    actor: { login: "script:backfill-he-fingerprints", via: "token", tokenId: null },
    method: "SCRIPT",
    path: "scripts/backfill-he-fingerprints.ts",
    status: 200,
    target,
    beforeHash: docHash(before),
    afterHash: docHash(after),
  };
}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Raw }> {
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Raw;
  return { status: res.status, json };
}

async function find(type: string): Promise<Raw[]> {
  const r = await call("POST", "/_find", { selector: { type }, limit: 5000 });
  if (r.status !== 200) throw new Error(`_find ${type}: ${r.status} ${JSON.stringify(r.json)}`);
  return (r.json.docs as Raw[]) ?? [];
}

async function main() {
  const docs = [...(await find("post")), ...(await find("collection")), ...(await find("content"))];
  const changes = docs.map(backfillDoc).filter((c) => c !== null);
  console.log(`${docs.length} documents read; ${changes.length} hold Hebrew with no fingerprint.`);
  for (const c of changes) console.log(`  ${c.id}: ${c.units.join(", ")}`);
  if (!APPLY) {
    console.log(changes.length ? "\nDry run: nothing written. Run again with --apply to stamp these." : "\nNothing to do.");
    return;
  }
  let written = 0;
  let conflicts = 0;
  for (const c of changes) {
    const r = await call("PUT", `/${encodeURIComponent(c.id)}`, c.next);
    if (r.status === 409) {
      conflicts += 1;
      console.warn(`  conflict on ${c.id}: changed since it was read; skipped. Run again.`);
      continue;
    }
    if (r.status !== 201 && r.status !== 200) throw new Error(`PUT ${c.id}: ${r.status} ${JSON.stringify(r.json)}`);
    written += 1;
    const before = docs.find((d) => d._id === c.id);
    const entry = auditEntry(c.id, before, c.next);
    const a = await call("PUT", `/${encodeURIComponent(entry._id)}`, entry);
    if (a.status !== 201 && a.status !== 200) console.warn(`  audit entry for ${c.id} not written: ${a.status}`);
  }
  console.log(`\nWrote ${written}; ${conflicts} conflicts.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
