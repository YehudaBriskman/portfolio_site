import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PinnedAction from "@/components/phone/PinnedAction";

/* The pinned Dock leaves when the footer reaches it and returns when it is
   scrolled back; while gone it is inert and aria-hidden, so it cannot be tabbed
   to. The observer is a stub the test drives (no layout in jsdom). */
let callback: ((e: Array<{ isIntersecting: boolean }>) => void) | null = null;
let options: IntersectionObserverInit | undefined;

beforeEach(() => {
  callback = null;
  class StubIO {
    constructor(cb: typeof callback, o?: IntersectionObserverInit) {
      callback = cb;
      options = o;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal("IntersectionObserver", StubIO);
  const f = document.createElement("footer");
  f.setAttribute("data-ph-foot", "");
  document.body.append(f);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelector("footer")?.remove();
});

describe("PinnedAction near the footer", () => {
  it("hides when the footer reaches it (inert, aria-hidden) and returns when it leaves", () => {
    render(<PinnedAction href="https://example.com" label="Windom">Source</PinnedAction>);
    const dock = document.querySelector("[data-phone-pinned]") as HTMLElement;
    expect(dock.hasAttribute("data-away")).toBe(false);
    expect(dock.hasAttribute("inert")).toBe(false);
    /* the observer shrinks the window from the bottom by the dock's reach */
    expect(options?.rootMargin).toMatch(/^0px 0px -\d+px 0px$/);
    expect(options?.threshold).toBe(0);

    act(() => callback?.([{ isIntersecting: true }]));
    expect(dock.hasAttribute("data-away")).toBe(true);
    expect(dock.hasAttribute("inert")).toBe(true);
    expect(dock.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("link", { name: "Source" })).toBeNull();

    act(() => callback?.([{ isIntersecting: false }]));
    expect(dock.hasAttribute("data-away")).toBe(false);
    expect(dock.hasAttribute("inert")).toBe(false);
    expect(dock.hasAttribute("aria-hidden")).toBe(false);
  });
});
