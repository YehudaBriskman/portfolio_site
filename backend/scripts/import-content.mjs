#!/usr/bin/env node
/*
 * Upserts the reviewed drafts in backend/content/ through the admin API,
 * English and Hebrew.
 *
 *   CONTENT_API_BASE=http://localhost:8080 \
 *   CONTENT_ADMIN_TOKEN=... \
 *   node backend/scripts/import-content.mjs                  # dry run: prints the diff
 *   node backend/scripts/import-content.mjs --apply          # writes it
 *   node backend/scripts/import-content.mjs --overwrite-he   # dry run, as if replacing differing Hebrew
 *   node backend/scripts/import-content.mjs --apply --overwrite-he
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
 *   - Writes through the same routes the admin UI uses, carrying the current
 *     `_rev`, so the API's own validation and optimistic lock apply.
 *   - `publishedAt` is stamped once by the API and never moved; for a post
 *     that is already published, a different date in the draft is reported
 *     and not sent as a change.
 *   - Hebrew (`<slug>.he.md`, an area's `he`) fills only what the store does
 *     not already hold. Hebrew in the store that differs from the repo's is
 *     kept and reported, unless `--overwrite-he` is given. A note with an
 *     unpublished draft in the admin gets no Hebrew written. The rules, and
 *     how the Hebrew is written, are in import-plan.mjs.
 */
import { loadContent } from "./content-files.mjs";
import { applyPlan, buildPlan, describePlan, needsWrite } from "./import-plan.mjs";

const FLAGS = ["--apply", "--overwrite-he"];
const args = new Set(process.argv.slice(2));
for (const a of args) {
  if (!FLAGS.includes(a)) {
    console.error(`unknown argument ${a}. Usage: import-content.mjs [--apply] [--overwrite-he]`);
    process.exit(2);
  }
}
const APPLY = args.has("--apply");
const OVERWRITE_HE = args.has("--overwrite-he");

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

async function main() {
  const content = loadContent();
  const withHe = content.posts.filter((p) => p.he).length;
  console.log(
    `${APPLY ? "APPLY" : "dry run"} against ${BASE}: ${content.areas.length} areas, ${content.posts.length} notes (${withHe} with Hebrew) in backend/content` +
      `${OVERWRITE_HE ? ", replacing differing Hebrew" : ""}\n`
  );

  const [{ items: liveAreas }, { items: livePosts }] = await Promise.all([api("GET", "/collections"), api("GET", "/posts")]);
  const plan = buildPlan(content, { liveAreas, livePosts }, { overwriteHe: OVERWRITE_HE });
  for (const line of describePlan(plan, { overwriteHe: OVERWRITE_HE })) console.log(line);

  const managed = new Set(content.posts.map((p) => p.meta.slug));
  const unmanaged = livePosts.filter((p) => !managed.has(p.slug));
  if (unmanaged.length) {
    console.log(`\nnot managed here, left alone: ${unmanaged.map((p) => p.slug).join(", ")}`);
  }

  const toWrite = plan.filter(needsWrite).length;
  console.log(`\n${toWrite} to write, ${plan.length - toWrite} unchanged. Nothing is ever deleted.`);
  if (!APPLY) {
    if (toWrite) console.log("Dry run: nothing was written. Re-run with --apply to write.");
    return;
  }

  const failed = await applyPlan(plan, api, (line) => (line.startsWith("FAIL") ? console.error(line) : console.log(line)));
  if (failed) {
    console.error(`\n${failed} write(s) failed; the rest were applied. Re-running is safe.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
