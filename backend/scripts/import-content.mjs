#!/usr/bin/env node
/*
 * Upserts the reviewed drafts in backend/content/ through the admin API.
 *
 *   CONTENT_API_BASE=http://localhost:8080 \
 *   CONTENT_ADMIN_TOKEN=... \
 *   node backend/scripts/import-content.mjs            # dry run: prints the diff
 *   node backend/scripts/import-content.mjs --apply    # writes it
 *
 * Environment:
 *   CONTENT_API_BASE     the site or API origin; `/api/admin/...` is appended.
 *                        Plain http is allowed only for a loopback host, because
 *                        the token travels with every request.
 *   CONTENT_ADMIN_TOKEN  the admin proof the API checks (`X-Admin-Proxy-Secret`;
 *                        see src/middlewares/requireAdmin.ts). Required.
 *   CONTENT_ADMIN_LOGIN  the login sent as `X-Auth-Request-User`. Defaults to
 *                        the site owner's GitHub login, which the API compares
 *                        against ADMIN_GITHUB_LOGIN.
 *   CONTENT_ADMIN_COOKIE optional `Cookie` header, for an admin origin that sits
 *                        behind an SSO proxy and wants its session cookie too.
 *
 * What it will and will not do:
 *   - Dry run unless `--apply` is given. The dry run reads, never writes.
 *   - Never deletes or archives anything. A post on the server with no draft
 *     here is listed as "not managed here" and left alone.
 *   - Idempotent. A document whose fields already match is skipped, so a
 *     second `--apply` writes nothing.
 *   - Writes through the same PUT routes the admin UI uses, carrying the
 *     current `_rev`, so the API's own validation and optimistic lock apply.
 *   - `publishedAt` is stamped once by the API and never moved; for a post
 *     that is already published, a different date in the draft is reported
 *     and not sent as a change.
 */
import { loadContent, toCollectionWrite, toPostWrite } from "./content-files.mjs";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
for (const a of args) {
  if (a !== "--apply") {
    console.error(`unknown argument ${a}. Usage: import-content.mjs [--apply]`);
    process.exit(2);
  }
}

const BASE = (process.env.CONTENT_API_BASE ?? "").replace(/\/+$/, "");
const TOKEN = process.env.CONTENT_ADMIN_TOKEN ?? "";
const LOGIN = process.env.CONTENT_ADMIN_LOGIN ?? "YehudaBriskman";
const COOKIE = process.env.CONTENT_ADMIN_COOKIE ?? "";

if (!BASE || !TOKEN) {
  console.error("CONTENT_API_BASE and CONTENT_ADMIN_TOKEN are required (see the header of this script).");
  process.exit(2);
}
const baseUrl = new URL(BASE);
const LOOPBACK = ["127.0.0.1", "localhost", "[::1]", "::1"];
if (baseUrl.protocol !== "https:" && !LOOPBACK.includes(baseUrl.hostname)) {
  console.error(`refusing plain ${baseUrl.protocol} to ${baseUrl.hostname}: the admin token would travel unencrypted`);
  process.exit(2);
}

const headers = {
  "Content-Type": "application/json",
  "X-Admin-Proxy-Secret": TOKEN,
  "X-Auth-Request-User": LOGIN,
  ...(COOKIE ? { Cookie: COOKIE } : {}),
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok || !json?.ok) {
    const why = json?.error ?? (res.status >= 300 && res.status < 400 ? "redirected (an SSO login page?)" : text.slice(0, 120));
    throw new Error(`${method} ${path}: ${res.status} ${typeof why === "string" ? why : JSON.stringify(why)}`);
  }
  return json;
}

/* ------------------------------------------------------------------ diff -- */

const isEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function short(v) {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s.length > 90 ? `${s.slice(0, 87)}...` : s;
}

/** Changed lines of a long text, removed then added. Enough to review; not a patch. */
function lineDiff(before, after, limit = 12) {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");
  const inA = new Set(a);
  const inB = new Set(b);
  const out = [
    ...a.filter((l) => l.trim() && !inB.has(l)).map((l) => `      - ${l}`),
    ...b.filter((l) => l.trim() && !inA.has(l)).map((l) => `      + ${l}`),
  ];
  return out.length > limit ? [...out.slice(0, limit), `      ... ${out.length - limit} more changed lines`] : out;
}

/** Field-by-field changes between what the server holds and the draft's write body. */
function changes(existing, draft, { skip = [] } = {}) {
  const out = [];
  for (const [key, value] of Object.entries(draft)) {
    if (key === "slug" || skip.includes(key)) continue;
    if (!isEqual(existing?.[key], value)) out.push({ key, from: existing?.[key], to: value });
  }
  return out;
}

function printChanges(list) {
  for (const c of list) {
    if (c.key === "body" && (c.from === undefined || c.from === null)) {
      console.log(`    body: new, ${c.to.trim().split(/\s+/).length} words`);
    } else if (c.key === "body") {
      console.log(`    body: changed`);
      for (const l of lineDiff(c.from, c.to)) console.log(l);
    } else {
      console.log(`    ${c.key}: ${short(c.from)} -> ${short(c.to)}`);
    }
  }
}

/* ------------------------------------------------------------------ main -- */

async function main() {
  const { areas, posts } = loadContent();
  console.log(`${APPLY ? "APPLY" : "dry run"} against ${BASE}: ${areas.length} areas, ${posts.length} notes in backend/content\n`);

  const [{ items: liveAreas }, { items: livePosts }] = await Promise.all([
    api("GET", "/collections"),
    api("GET", "/posts"),
  ]);
  const areaBySlug = new Map(liveAreas.map((a) => [a.slug, a]));
  const postBySlug = new Map(livePosts.map((p) => [p.slug, p]));

  const plan = [];

  for (const { data } of areas) {
    const draft = toCollectionWrite(data);
    const existing = areaBySlug.get(draft.slug);
    const diff = changes(existing, draft);
    plan.push({ kind: "collection", slug: draft.slug, existing, draft, diff });
  }

  for (const post of posts) {
    const draft = toPostWrite(post);
    const existing = postBySlug.get(draft.slug);
    const notes = [];
    // The API keeps the first publish date, so sending a different one changes nothing.
    const skip = [];
    if (existing?.publishedAt && existing.status === "published") {
      skip.push("publishedAt");
      if (!isEqual(existing.publishedAt, draft.publishedAt)) {
        notes.push(`publishedAt stays ${existing.publishedAt} (the draft says ${draft.publishedAt}; the API never moves a publish date)`);
      }
    }
    const diff = changes(existing, draft, { skip });
    plan.push({ kind: "post", slug: draft.slug, existing, draft, diff, notes });
  }

  let toWrite = 0;
  for (const item of plan) {
    const label = `${item.kind} ${item.slug}`;
    if (!item.existing) {
      toWrite++;
      console.log(`+ create ${label}`);
      printChanges(item.diff);
    } else if (item.diff.length) {
      toWrite++;
      console.log(`~ update ${label}`);
      printChanges(item.diff);
    } else {
      console.log(`= unchanged ${label}`);
    }
    for (const n of item.notes ?? []) console.log(`    note: ${n}`);
  }

  const managed = new Set(posts.map((p) => p.meta.slug));
  const unmanaged = livePosts.filter((p) => !managed.has(p.slug));
  if (unmanaged.length) {
    console.log(`\nnot managed here, left alone: ${unmanaged.map((p) => p.slug).join(", ")}`);
  }

  console.log(`\n${toWrite} to write, ${plan.length - toWrite} unchanged. Nothing is ever deleted.`);
  if (!APPLY) {
    if (toWrite) console.log("Dry run: nothing was written. Re-run with --apply to write.");
    return;
  }

  let failed = 0;
  // Areas before notes, so a note never names an area that does not exist yet.
  for (const item of plan) {
    if (item.existing && !item.diff.length) continue;
    const path = `/${item.kind === "collection" ? "collections" : "posts"}/${encodeURIComponent(item.slug)}`;
    const body = item.existing?._rev ? { ...item.draft, _rev: item.existing._rev } : item.draft;
    try {
      await api("PUT", path, body);
      console.log(`ok   ${item.kind} ${item.slug}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${item.kind} ${item.slug}: ${e.message}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} write(s) failed; the rest were applied. Re-running is safe.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
