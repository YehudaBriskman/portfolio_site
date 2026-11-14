import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseList, unreadableCount } from "../tolerant";

const Item = z.object({ id: z.string(), kind: z.enum(["a", "b"]) });

describe("parseList", () => {
  it("keeps every readable item and drops the one that does not parse", () => {
    const list = parseList(Item, [{ id: "1", kind: "a" }, { id: "2", kind: "zzz" }, { id: "3", kind: "b" }, null]);
    expect(list.map((x) => x.id)).toEqual(["1", "3"]);
    expect(unreadableCount(list)).toBe(2);
  });
  it("reports zero when everything parses", () => {
    expect(unreadableCount(parseList(Item, [{ id: "1", kind: "a" }]))).toBe(0);
  });
  it("counts nothing for an array it did not make", () => {
    expect(unreadableCount([])).toBe(0);
  });
  it("treats a body that is not a list as a sentence-sized failure, never zod JSON", () => {
    expect(() => parseList(Item, { nope: true })).toThrow(/could not be read/);
    try {
      parseList(Item, "x");
    } catch (e) {
      expect((e as Error).message).not.toMatch(/\[|\{|invalid_type/);
    }
  });
});

/* A list parser that calls `.parse` on the whole array rejects every record for the
   sake of one. Services read lists through parseList. */
describe("guard: service list parsers are tolerant", () => {
  const dir = join(__dirname, "..");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  it("no service parses a whole array with z.array(...).parse", () => {
    const offenders = files.filter((f) => /z\.array\([^)]*\)\s*\.parse\(/.test(readFileSync(join(dir, f), "utf8")));
    expect(offenders, `use parseList from ./tolerant in: ${offenders.join(", ")}`).toEqual([]);
  });
});
