import { describe, expect, it } from "vitest";
import { UNKNOWN_WHEN, formatWhen, parseWhen } from "../safeTime";

describe("parseWhen", () => {
  it("returns a Date for a real timestamp", () => {
    expect(parseWhen("2026-11-01T10:00:00Z")?.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });
  it.each(["garbage", "", "   ", null, undefined, "2026-13-45"])("returns null for %j", (v) => {
    expect(parseWhen(v as never)).toBeNull();
  });
});

describe("formatWhen", () => {
  it("formats a valid timestamp", () => {
    expect(formatWhen("2026-11-01T10:00:00Z", "en", { dateStyle: "medium" })).toMatch(/Nov/);
  });
  it("never throws and says 'unknown' in the reader's language", () => {
    expect(formatWhen("garbage", "en", { dateStyle: "medium" })).toBe(UNKNOWN_WHEN.en);
    expect(formatWhen("garbage", "he", { dateStyle: "medium" })).toBe(UNKNOWN_WHEN.he);
  });
  it("gives an empty string for an absent value", () => {
    expect(formatWhen(undefined, "en", { dateStyle: "medium" })).toBe("");
    expect(formatWhen(null, "en", { dateStyle: "medium" })).toBe("");
  });
});
