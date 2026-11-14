import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { SkeletonSwap } from "@/components/ui/SkeletonSwap";
import { EXIT_KEEP_MS } from "@/hooks/usePhoneMotion";

function stubPhone(on: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("no-preference") && q.includes("max-width: 599px"),
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}

const View = ({ loading }: { loading: boolean }) => (
  <SkeletonSwap loading={loading} skeleton={<p>skeleton</p>}>
    {loading ? null : <p>content</p>}
  </SkeletonSwap>
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SkeletonSwap on a phone with motion allowed", () => {
  beforeEach(() => stubPhone(true));

  it("shows the skeleton while loading and nothing else", () => {
    const { container } = render(<View loading />);
    expect(screen.getByText("skeleton")).toBeTruthy();
    expect(container.querySelector("[data-phase]")!.getAttribute("data-phase")).toBe("loading");
  });

  it("when loading ends the content is there at once and the skeleton stays as a closed, inert ghost", () => {
    const { container, rerender } = render(<View loading />);
    rerender(<View loading={false} />);
    expect(screen.getByText("content")).toBeTruthy();
    const ghost = screen.getByText("skeleton").closest("[data-state]")!;
    expect(ghost.getAttribute("data-state")).toBe("closed");
    expect(ghost.hasAttribute("inert")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-phase]")!.getAttribute("data-phase")).toBe("swap");
  });

  it("a timer drops the ghost, never an animation event", () => {
    const { container, rerender } = render(<View loading />);
    rerender(<View loading={false} />);
    act(() => void vi.advanceTimersByTime(EXIT_KEEP_MS + 1));
    expect(screen.queryByText("skeleton")).toBeNull();
    expect(container.querySelector("[data-phase]")!.getAttribute("data-phase")).toBe("ready");
  });

  it("the content does not remount when the ghost goes (state in it survives)", () => {
    const { rerender } = render(<View loading />);
    rerender(<View loading={false} />);
    const before = screen.getByText("content");
    act(() => void vi.advanceTimersByTime(EXIT_KEEP_MS + 1));
    expect(screen.getByText("content")).toBe(before);
  });

  it("data that was there from the start draws no cross-fade", () => {
    const { container } = render(<View loading={false} />);
    expect(container.querySelector("[data-phase]")!.getAttribute("data-phase")).toBe("ready");
    expect(screen.queryByText("skeleton")).toBeNull();
  });
});

describe("SkeletonSwap where the stylesheet will not animate", () => {
  it("drops the skeleton at once", () => {
    stubPhone(false);
    const { rerender } = render(<View loading />);
    rerender(<View loading={false} />);
    expect(screen.queryByText("skeleton")).toBeNull();
    expect(screen.getByText("content")).toBeTruthy();
  });
});
