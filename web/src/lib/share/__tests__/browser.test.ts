import { describe, expect, it, vi } from "vitest";
import { shareLink } from "@/lib/share";

describe("shareLink", () => {
  const data = { url: "https://example.test/blog/a", title: "A" };

  it("falls back where there is no Web Share", async () => {
    expect(await shareLink(data, {} as Navigator)).toBe("fallback");
    expect(await shareLink(data, undefined)).toBe("fallback");
  });

  it("falls back when the browser says it cannot share this", async () => {
    const share = vi.fn();
    expect(await shareLink(data, { share, canShare: () => false })).toBe("fallback");
    expect(share).not.toHaveBeenCalled();
  });

  it("uses the system sheet, and treats closing it as done, not as a failure", async () => {
    expect(await shareLink(data, { share: vi.fn(async () => {}), canShare: () => true })).toBe("shared");
    const abort = Object.assign(new Error("closed"), { name: "AbortError" });
    expect(await shareLink(data, { share: vi.fn(async () => Promise.reject(abort)), canShare: undefined as never })).toBe("cancelled");
    expect(await shareLink(data, { share: vi.fn(async () => Promise.reject(new Error("denied"))), canShare: undefined as never })).toBe("fallback");
  });
});
