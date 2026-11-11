import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/*
 * ./shared is generated from mcp/src (the tools both MCP transports use).
 * If this fails, run `node mcp/scripts/sync-shared.mjs` and commit the copy.
 * mcp/src/shared-sync.test.ts is the same check from the other side.
 */
const SRC = path.resolve(__dirname, "../../../mcp/src");
const DEST = path.resolve(__dirname, "shared");

describe("src/mcp/shared is in sync with mcp/src", () => {
  it.each(["api.ts", "diff.ts", "tools.ts"])("%s", (f) => {
    const banner = `// GENERATED from mcp/src/${f} by mcp/scripts/sync-shared.mjs. Edit that file and rerun the script.\n`;
    const want = banner + fs.readFileSync(path.join(SRC, f), "utf8");
    const have = fs.readFileSync(path.join(DEST, f), "utf8");
    // toBe prints the differing text; a boolean compare would only say "false".
    expect(have, "stale copy: run node mcp/scripts/sync-shared.mjs").toBe(want);
  });
});
