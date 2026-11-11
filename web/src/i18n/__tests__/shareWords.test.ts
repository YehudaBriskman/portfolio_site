import { describe, expect, it } from "vitest";
import { useShareWords } from "../share";
import { hasHebrew } from "../words";

describe("the share menu's words (#470)", () => {
  const { en, he } = useShareWords.table;

  it("has the same keys in both languages", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it("says every string in Hebrew", () => {
    for (const [k, v] of Object.entries(he)) {
      const text = typeof v === "function" ? (v as (s: string) => string)("X") : String(v);
      expect(hasHebrew(text), k).toBe(true);
    }
  });
});
