/*
 * The media visibility migration (#876). Dry run by default.
 *
 *   COUCHDB_URL=http://127.0.0.1:5984 COUCHDB_USER=... COUCHDB_PASSWORD=... \
 *     npx tsx scripts/migrate-media-visibility.ts            # dry run
 *   ... npx tsx scripts/migrate-media-visibility.ts --apply  # writes it
 *
 * Stamps `visibility: "public"` on every media item that has no `visibility`,
 * which is every item that existed before drafts did. The API already reads a
 * missing field as public, so running this changes nothing anyone can see: it
 * makes the state explicit. Idempotent (a second run writes nothing), never
 * touches an item that already says `draft` or `public`, and writes with the
 * `_rev` it read, so a concurrent edit is a skipped conflict. Back up first.
 */
import { migrateVisibility } from "../src/services/media-visibility";
import { findAll } from "./find-all";

const APPLY = process.argv.slice(2).includes("--apply");
const url = process.env.COUCHDB_URL;
if (!url) {
  console.error("COUCHDB_URL is required (no default: say which store you mean).");
  process.exit(2);
}
const base = `${url.replace(/\/+$/, "")}/${process.env.COUCHDB_DB ?? "portfolio_content"}`;
const auth = "Basic " + Buffer.from(`${process.env.COUCHDB_USER ?? ""}:${process.env.COUCHDB_PASSWORD ?? ""}`).toString("base64");
const headers = { Authorization: auth, "Content-Type": "application/json" };
type Raw = Record<string, unknown>;
const PAGE = 500;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Raw };
}

async function main() {
  const docs = await findAll<Raw>(async (bookmark) => {
    const r = await call("POST", "/_find", { selector: { type: "media" }, limit: PAGE, ...(bookmark ? { bookmark } : {}) });
    if (r.status !== 200) throw new Error(`_find media: ${r.status} ${JSON.stringify(r.json)}`);
    return { docs: (r.json.docs as Raw[]) ?? [], bookmark: r.json.bookmark as string | undefined };
  }, PAGE);
  const changes = docs.map((d) => migrateVisibility(d)).filter((d): d is Raw => d !== null);
  console.log(`${docs.length} media items read; ${changes.length} have no visibility.`);
  if (!APPLY) {
    console.log(changes.length ? "Dry run: nothing written. Run again with --apply." : "Nothing to do.");
    return;
  }
  let written = 0;
  for (const next of changes) {
    // The attachment stubs go back as read, so CouchDB keeps the files.
    const r = await call("PUT", `/${encodeURIComponent(String(next._id))}`, next);
    if (r.status === 409) console.warn(`  conflict on ${next._id}: changed since read; skipped. Run again.`);
    else if (r.status !== 201 && r.status !== 200) throw new Error(`PUT ${next._id}: ${r.status} ${JSON.stringify(r.json)}`);
    else written += 1;
  }
  console.log(`Wrote ${written}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
