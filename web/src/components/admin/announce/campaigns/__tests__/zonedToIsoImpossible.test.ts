import { describe, expect, it } from "vitest";
import { zonedToIso } from "../helpers";

/* A wall time that does not exist is null (the editor then says scheduleMissing), never a different time. */
describe("zonedToIso on times that do not exist", () => {
  it.each(["2026-02-30T10:00", "2026-02-29T10:00", "2026-04-31T10:00", "2026-13-01T10:00", "2026-00-10T10:00", "2026-01-00T10:00", "2026-01-01T24:00", "2026-01-01T10:60"])("%s is null", (t) => {
    expect(zonedToIso(t, "UTC")).toBeNull();
  });
  it("year 0001 is null, not 1901", () => {
    expect(zonedToIso("0001-01-01T00:00", "UTC")).toBeNull();
  });
  it("29 February of a leap year is real", () => {
    expect(zonedToIso("2028-02-29T10:00", "UTC")).toBe("2028-02-29T10:00:00.000Z");
  });
  it("the hour skipped when clocks go forward is null (Jerusalem, 2026-03-27 02:30)", () => {
    expect(zonedToIso("2026-03-27T02:30", "Asia/Jerusalem")).toBeNull();
    expect(zonedToIso("2026-03-27T03:30", "Asia/Jerusalem")).toBe("2026-03-27T00:30:00.000Z");
  });
  it("the hour skipped in New York (2026-03-08 02:30) is null", () => {
    expect(zonedToIso("2026-03-08T02:30", "America/New_York")).toBeNull();
  });
});
