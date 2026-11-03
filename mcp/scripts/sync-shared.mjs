#!/usr/bin/env node
/*
 * Copies the tool module both MCP transports use into the backend.
 *
 * The backend image is built from backend/ alone (its Dockerfile's context),
 * so it cannot import ../mcp/src. It carries a generated copy instead, with a
 * banner, and a test on each side (mcp/src/shared-sync.test.ts,
 * backend/src/mcp/shared-sync.test.ts) fails while the copy differs.
 *
 *   node mcp/scripts/sync-shared.mjs          write the copy
 *   node mcp/scripts/sync-shared.mjs --check  exit 1 if it differs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../src");
const DEST = path.resolve(here, "../../backend/src/mcp/shared");
const FILES = ["api.ts", "diff.ts", "tools.ts"];
const banner = (f) =>
  `// GENERATED from mcp/src/${f} by mcp/scripts/sync-shared.mjs. Edit that file and rerun the script.\n`;

const check = process.argv.includes("--check");
let stale = 0;
fs.mkdirSync(DEST, { recursive: true });
for (const f of FILES) {
  const want = banner(f) + fs.readFileSync(path.join(SRC, f), "utf8");
  const file = path.join(DEST, f);
  // Read and catch, not exists-then-read: one operation, no window between.
  let have = null;
  try {
    have = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (have === want) continue;
  stale++;
  if (check) console.error(`stale: backend/src/mcp/shared/${f}`);
  else fs.writeFileSync(file, want);
}
if (check && stale) process.exit(1);
if (!check) console.log(stale ? `updated ${stale} file(s)` : "already in sync");
