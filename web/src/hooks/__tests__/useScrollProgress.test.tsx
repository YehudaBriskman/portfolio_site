import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/* The figure drift is the one scroll-driven thing written from script, so no
   stylesheet can stop it: the hook itself has to honour the site's Pause. */

const vh = (el: HTMLElement) => el.style.getPropertyValue("--vh");

afterEach(() => {
  cleanup();
  document.body.classList.remove("motion-paused");
  vi.unstubAllGlobals();
});

describe("useScrollProgress", () => {
  it("writes --vh on its element", () => {
    const el = document.createElement("div");
    renderHook(() => useScrollProgress({ current: el }));
    expect(vh(el)).not.toBe("");
  });

  it("writes nothing while motion is paused, and starts when Pause is lifted", async () => {
    document.body.classList.add("motion-paused");
    const el = document.createElement("div");
    const target = { current: el };
    const listen = vi.spyOn(window, "addEventListener");
    renderHook(() => useScrollProgress(target));
    expect(vh(el)).toBe("");
    expect(listen.mock.calls.filter(([t]) => t === "scroll")).toHaveLength(0);
    act(() => void document.body.classList.remove("motion-paused"));
    await waitFor(() => expect(vh(el)).not.toBe(""));
    listen.mockRestore();
  });
});
