import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { docHash } from "./audit.js";

/* #827: a sort says how it compares. */
describe("sort calls", () => {
  it.each(["audit.ts", "content-modified.ts"])("%s passes a compare function", (file) => {
    expect(readFileSync(join(__dirname, file), "utf8")).not.toMatch(/\.(sort|toSorted)\(\s*\)/);
  });
});

/* The audit log stores these hashes, so the key order must not move: it is
   code-unit order (every capital before every lower-case letter), which a
   locale compare would change. */
describe("docHash key order", () => {
  it("hashes keys in code-unit order, without _rev", () => {
    const expected = createHash("sha256").update('{"B":2,"_id":"x","a":1}').digest("hex");
    expect(docHash({ a: 1, _rev: "1-a", _id: "x", B: 2 })).toBe(expected);
  });
});
