import { describe, expect, it } from "vitest";
import { added, weeklyTotals } from "@/components/admin/overview/series";

const NOW = Date.UTC(2026, 10, 15, 12);
const day = 86_400_000;
const ago = (d: number) => new Date(NOW - d * day).toISOString();

describe("weeklyTotals", () => {
  it("counts what existed at the end of each of the last N weeks, oldest first", () => {
    const v = weeklyTotals([ago(100), ago(20), ago(3), ago(1)], NOW, 4);
    expect(v).toEqual([1, 2, 2, 4]);
  });
  it("is empty when there is nothing, so nothing is drawn", () => {
    expect(weeklyTotals([], NOW, 4)).toEqual([]);
  });
  it("is empty when the line would be flat (no change to show)", () => {
    expect(weeklyTotals([ago(100), ago(90)], NOW, 4)).toEqual([]);
  });
  it("ignores dates that do not parse and dates in the future", () => {
    expect(weeklyTotals(["nope", ago(-5), ago(1), ago(30)], NOW, 4)).toEqual([1, 1, 1, 2]);
  });
});

describe("added", () => {
  it("counts items from the last N days", () => {
    expect(added([ago(1), ago(29), ago(31), "bad"], NOW, 30)).toBe(2);
  });
});
