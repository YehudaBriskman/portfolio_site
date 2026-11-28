import { timingSafeEqual } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeEqual } from "./safeEqual.js";

vi.mock("node:crypto", async (original) => {
  const real = await original<typeof import("node:crypto")>();
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});

afterEach(() => vi.clearAllMocks());

describe("safeEqual", () => {
  it("is true for equal strings only", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "a")).toBe(false);
  });

  it("compares two buffers of one length whatever the lengths of the inputs", () => {
    safeEqual("a", "a much longer secret value");
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    const [a, b] = vi.mocked(timingSafeEqual).mock.calls[0];
    expect(a.byteLength).toBe(b.byteLength);
  });
});
