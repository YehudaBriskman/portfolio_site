import { describe, expect, it } from "vitest";
import { useFilterWords } from "../pages";

describe("filter option counts are read out in the page language", () => {
  it("says match/matches in English", () => {
    const w = useFilterWords.of("en");
    expect(w.matches(1)).toBe(" match");
    expect(w.matches(3)).toBe(" matches");
  });
  it("says it in Hebrew, with no English left for a screen reader", () => {
    const w = useFilterWords.of("he");
    expect(w.matches(1)).toBe(" התאמה");
    expect(w.matches(3)).toBe(" התאמות");
  });
});
