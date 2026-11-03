/*
 * Create, list and revoke scoped API tokens straight in the content store
 * (#252). The same documents POST/GET/DELETE /api/admin/tokens manage from a
 * signed-in admin session; this is for when there is no browser at hand.
 *
 *   COUCHDB_URL=http://127.0.0.1:5984 COUCHDB_USER=... COUCHDB_PASSWORD=... \
 *     npx tsx scripts/api-token.ts create <name> [--scope write] [--days N]
 *   ... npx tsx scripts/api-token.ts list
 *   ... npx tsx scripts/api-token.ts revoke <id>
 *
 * COUCHDB_URL has no default on purpose: this writes credentials, and the one
 * time this project wrote to the wrong store it was a script with a default.
 * For production, port-forward the CouchDB service and point at the forward.
 *
 * `create` mints a READ token unless `--scope write` is passed: least
 * privilege is the default, and write has to be asked for by name. It
 * expires after `--days` (default 30, at most 90). The token is printed ONCE,
 * to stdout; only its SHA-256 is stored.
 */
import { parseArgs } from "node:util";
import {
  TOKEN_SCOPES,
  TOKEN_TTL_DAYS_DEFAULT,
  TOKEN_TTL_DAYS_MAX,
  newTokenDoc,
  publicToken,
  tokenDocId,
  type StoredToken,
  type TokenScope,
} from "../src/services/apiTokenFormat";

const url = process.env.COUCHDB_URL;
if (!url) {
  console.error("COUCHDB_URL is required (no default: say which store you mean).");
  process.exit(2);
}
const base = `${url.replace(/\/+$/, "")}/portfolio_content`;
const auth =
  "Basic " +
  Buffer.from(`${process.env.COUCHDB_USER ?? ""}:${process.env.COUCHDB_PASSWORD ?? ""}`).toString("base64");

async function couch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`couch ${res.status} on ${path}: ${await res.text()}`);
  return (await res.json()) as T;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { scope: { type: "string", default: "read" }, days: { type: "string", default: String(TOKEN_TTL_DAYS_DEFAULT) } },
});
const [cmd, a] = positionals;
const who = `cli:${process.env.USER ?? "unknown"}`;

async function main() {
  if (cmd === "create") {
    const days = Number(values.days);
    if (
      !a ||
      !/^[a-z0-9][a-z0-9-]{0,39}$/.test(a) ||
      !TOKEN_SCOPES.includes(values.scope as TokenScope) ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > TOKEN_TTL_DAYS_MAX
    ) {
      console.error(`usage: create <name: a-z0-9-> [--scope read|write] [--days 1-${TOKEN_TTL_DAYS_MAX}]`);
      process.exit(2);
    }
    const { token, doc } = newTokenDoc({ name: a, scope: values.scope as TokenScope, ttlDays: days, createdBy: who });
    await couch(`/${encodeURIComponent(doc._id)}`, { method: "PUT", body: JSON.stringify(doc) });
    console.error(`created ${doc.id} (${doc.scope}, expires ${doc.expiresAt}). The token is shown once:`);
    console.log(token);
  } else if (cmd === "list") {
    const { docs } = await couch<{ docs: StoredToken[] }>("/_find", {
      method: "POST",
      body: JSON.stringify({ selector: { type: "apitoken" }, limit: 200 }),
    });
    console.table(docs.map(publicToken));
  } else if (cmd === "revoke") {
    if (!a) {
      console.error("usage: revoke <id>");
      process.exit(2);
    }
    const id = `/${encodeURIComponent(tokenDocId(a))}`;
    const doc = await couch<StoredToken>(id);
    if (!doc.revokedAt) {
      await couch(id, { method: "PUT", body: JSON.stringify({ ...doc, revokedAt: new Date().toISOString() }) });
    }
    console.log(`revoked ${a}`);
  } else {
    console.error("usage: api-token.ts create <name> [--scope write] [--days N] | list | revoke <id>");
    process.exit(2);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
