import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import RouteFallback, { FALLBACK_DELAY_MS } from "@/components/RouteFallback";

afterEach(() => vi.useRealTimers());

describe("RouteFallback", () => {
  it("shows nothing but a polite 'Loading' for the first 200ms, so a fast route never flashes it", () => {
    vi.useFakeTimers();
    const { container } = render(<RouteFallback />);
    expect(container.querySelector("[role=status]")?.textContent).toBe("Loading");
    expect(container.querySelector("[data-route-fallback]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(FALLBACK_DELAY_MS - 1);
    });
    expect(container.querySelector("[data-route-fallback]")).toBeNull();
  });

  it("then shows the skeleton, hidden from the accessibility tree", () => {
    vi.useFakeTimers();
    const { container } = render(<RouteFallback />);
    act(() => {
      vi.advanceTimersByTime(FALLBACK_DELAY_MS);
    });
    const bars = container.querySelector("[data-route-fallback]")!;
    expect(bars.getAttribute("aria-hidden")).toBe("true");
    expect(bars.querySelectorAll(".scrub-pulse").length).toBeGreaterThanOrEqual(3);
  });

  it("cancels its timer when the route arrives first", () => {
    vi.useFakeTimers();
    const { unmount } = render(<RouteFallback />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
