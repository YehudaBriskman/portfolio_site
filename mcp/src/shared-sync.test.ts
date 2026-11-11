import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The backend's copy of the shared tool module is generated from this
 * package. If this fails, run `node mcp/scripts/sync-shared.mjs`.
 * backend/src/mcp/shared-sync.test.ts is the same check from the other side,
 * so a change to either package alone is caught by its own CI job.
 */
const SRC = path.resolve(__dirname);
const DEST = path.resolve(__dirname, "../../backend/src/mcp/shared");

describe("backend/src/mcp/shared is in sync with mcp/src", () => {
  it.each(["api.ts", "diff.ts", "tools.ts"])("%s", (f) => {
    const banner = `// GENERATED from mcp/src/${f} by mcp/scripts/sync-shared.mjs. Edit that file and rerun the script.\n`;
    const want = banner + fs.readFileSync(path.join(SRC, f), "utf8");
    const have = fs.readFileSync(path.join(DEST, f), "utf8");
    // toBe prints the differing text; a boolean compare would only say "false".
    expect(have, "stale copy: run node mcp/scripts/sync-shared.mjs").toBe(want);
  });
});
