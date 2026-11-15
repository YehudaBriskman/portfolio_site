import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { deriveTableId, readPrefs, useTablePrefs, MAX_PINNED, TIER_PX } from "@/components/ui/useTablePrefs";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useTablePrefs", () => {
  it("starts empty: the pointer decides, the table's own pins, nothing hidden", () => {
    const { result } = renderHook(() => useTablePrefs("Posts", "t1"));
    expect(result.current).toMatchObject({ density: null, pinned: null, hidden: [] });
  });

  it("remembers the tier, the pins and the hidden columns per table id, across mounts", () => {
    const a = renderHook(() => useTablePrefs("Posts", "t1"));
    act(() => {
      a.result.current.setDensity("compact");
      a.result.current.setPinned(["edit", "dup"]);
      a.result.current.setHidden(["views"]);
    });
    a.unmount();
    const again = renderHook(() => useTablePrefs("Posts", "t1"));
    expect(again.result.current).toMatchObject({ density: "compact", pinned: ["edit", "dup"], hidden: ["views"] });
    expect(renderHook(() => useTablePrefs("Posts", "t2")).result.current.density).toBeNull();
  });

  it("allows at most four pinned actions", () => {
    const { result } = renderHook(() => useTablePrefs("Posts", "t1"));
    act(() => result.current.setPinned(["a", "b", "c", "d", "e", "f"]));
    expect(result.current.pinned).toHaveLength(MAX_PINNED);
  });

  it("reset forgets everything and removes the record", () => {
    const { result } = renderHook(() => useTablePrefs("Posts", "t1"));
    act(() => result.current.setDensity("comfy"));
    expect(window.localStorage.getItem("a-table:t1")).not.toBeNull();
    act(() => result.current.reset());
    expect(window.localStorage.getItem("a-table:t1")).toBeNull();
    expect(result.current.density).toBeNull();
  });

  it("ignores a bad record instead of trusting it", () => {
    window.localStorage.setItem("a-table:t1", '{"density":"huge","pinned":[1],"hidden":"x"}');
    expect(readPrefs("t1")).toEqual({ density: null, pinned: null, hidden: [] });
    window.localStorage.setItem("a-table:t1", "not json");
    expect(readPrefs("t1").density).toBeNull();
  });

  it("works with storage blocked: the choice lasts for the visit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useTablePrefs("Posts", "t1"));
    act(() => result.current.setDensity("compact"));
    expect(result.current.density).toBe("compact");
  });

  it("derives the id from the route and the label; the language prefix does not split it", () => {
    expect(deriveTableId("Posts", "/admin/posts")).toBe("admin/posts:posts");
    expect(deriveTableId("Posts", "/he/admin/posts/")).toBe("admin/posts:posts");
    expect(deriveTableId("Send log", "/admin/marketing")).toBe("admin/marketing:send-log");
  });

  it("has the three tiers at 28, 36 and 44", () => {
    expect(TIER_PX).toEqual({ compact: 28, cozy: 36, comfy: 44 });
  });
});
