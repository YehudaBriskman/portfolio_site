import { describe, expect, it } from "vitest";
import { barStatus } from "./saveReadout";

/* The one-row editor bar's save text speaks the page's language, from the same words the StatusPill uses. */
const at = new Date(Date.UTC(2026, 10, 16, 9, 5));

describe("barStatus", () => {
  it("is English in an English page", () => {
    expect(barStatus({ kind: "dirty" }, "en")).toEqual({ tone: "idle", text: "Unsaved" });
    expect(barStatus({ kind: "conflict" }, "en").text).toBe("Changed elsewhere");
  });
  it("is Hebrew in a Hebrew page", () => {
    expect(barStatus({ kind: "dirty" }, "he").text).toBe("לא נשמר");
    expect(barStatus({ kind: "saving" }, "he")).toEqual({ tone: "busy", text: "שומר" });
    expect(barStatus({ kind: "saved", at }, "he").text).toMatch(/^נשמר \d\d:\d\d$/);
    expect(barStatus({ kind: "conflict" }, "he")).toEqual({ tone: "warn", text: "שונה במקום אחר" });
  });
  it("passes a failure message through untouched", () => {
    expect(barStatus({ kind: "failed", message: "boom" }, "he")).toEqual({ tone: "bad", text: "boom" });
  });
});
