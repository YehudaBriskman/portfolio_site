import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { PULL_IDLE, PULL_MAX, PULL_THRESHOLD, damp, overscrollOffset, popupOpen, pullEnd, pullMove, pullStart } from "@/components/ui/pullReveal";
import { PullTitle } from "@/components/ui/PullTitle";

const top = { atTop: true, blocked: false };

describe("pull state machine", () => {
  it("arms only when the touch starts at the top and nothing else owns the screen", () => {
    expect(pullStart(100, top).phase).toBe("armed");
    expect(pullStart(100, { atTop: false, blocked: false })).toEqual(PULL_IDLE);
    expect(pullStart(100, { atTop: true, blocked: true })).toEqual(PULL_IDLE);
  });

  it("does nothing under the threshold, then grows monotonically, damped and capped", () => {
    const a = pullStart(100, top);
    expect(pullMove(a, 100 + PULL_THRESHOLD, top).offset).toBe(0);
    let prev = 0;
    for (const d of [20, 40, 80, 160, 320, 2000]) {
      const o = pullMove(a, 100 + d, top).offset;
      expect(o).toBeGreaterThan(prev);
      expect(o).toBeLessThanOrEqual(PULL_MAX);
      prev = o;
    }
    expect(damp(40)).toBeLessThan(40);
  });

  it("is cancelled by an upward move, by scrolling away from the top and by a popup", () => {
    const a = pullStart(100, top);
    expect(pullMove(a, 90, top)).toEqual(PULL_IDLE);
    expect(pullMove(a, 160, { atTop: false, blocked: false })).toEqual(PULL_IDLE);
    expect(pullMove(a, 160, { atTop: true, blocked: true })).toEqual(PULL_IDLE);
    expect(pullMove(PULL_IDLE, 500, top)).toEqual(PULL_IDLE);
  });

  it("release returns to rest", () => {
    expect(pullEnd()).toEqual(PULL_IDLE);
  });

  it("reads a rubber-banding browser's negative scrollY", () => {
    expect(overscrollOffset(0)).toBe(0);
    expect(overscrollOffset(10)).toBe(0);
    expect(overscrollOffset(-30)).toBeGreaterThan(0);
    expect(overscrollOffset(-5000)).toBeLessThanOrEqual(PULL_MAX);
  });

  it("sees an open dialog as a popup", () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(popupOpen()).toBe(true);
    document.body.innerHTML = '<div role="dialog" hidden></div>';
    expect(popupOpen()).toBe(false);
    document.body.innerHTML = "";
  });
});

function touch(type: string, y: number) {
  const e = new Event(type, { bubbles: true }) as Event & { touches: unknown[] };
  e.touches = type === "touchend" || type === "touchcancel" ? [] : [{ clientY: y }];
  window.dispatchEvent(e);
}
const reduce = (on: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ media: q, matches: /reduced-motion/.test(q) ? on : false, addEventListener() {}, removeEventListener() {} }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

const pull = () => document.querySelector<HTMLElement>("[data-pull-title]")!;
const p = () => Number(pull().style.getPropertyValue("--pull"));

describe("PullTitle", () => {
  it("is hidden to assistive tech, hidden at rest, follows the finger, and returns on release", () => {
    vi.useFakeTimers();
    reduce(false);
    render(<PullTitle title="Posts" enabled />);
    expect(pull().getAttribute("aria-hidden")).toBe("true");
    expect(pull().dataset.state).toBe("rest");
    act(() => touch("touchstart", 100));
    act(() => touch("touchmove", 140));
    const a = p();
    act(() => touch("touchmove", 220));
    const b = p();
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
    expect(pull().dataset.state).toBe("pull");
    act(() => touch("touchend", 220));
    expect(p()).toBe(0);
    expect(pull().dataset.state).toBe("release");
    act(() => void vi.advanceTimersByTime(300));
    expect(pull().dataset.state).toBe("rest");
  });

  it("with reduced motion it steps between 0 and 1, never in between", () => {
    reduce(true);
    render(<PullTitle title="Posts" enabled />);
    act(() => touch("touchstart", 100));
    act(() => touch("touchmove", 106));
    expect(p()).toBe(0);
    act(() => touch("touchmove", 150));
    expect(p()).toBe(1);
    act(() => touch("touchend", 150));
    expect(p()).toBe(0);
  });

  it("ignores a gesture that starts below the top and one made while a popup is open", () => {
    reduce(false);
    render(<PullTitle title="Posts" enabled />);
    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    act(() => touch("touchstart", 100));
    act(() => touch("touchmove", 220));
    expect(p()).toBe(0);
    act(() => touch("touchend", 220));
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    document.body.insertAdjacentHTML("beforeend", '<div role="dialog" id="d"></div>');
    act(() => touch("touchstart", 100));
    act(() => touch("touchmove", 220));
    expect(p()).toBe(0);
    document.getElementById("d")!.remove();
  });

  it("is not drawn and listens to nothing when not enabled (desktop, tablet)", () => {
    const add = vi.spyOn(window, "addEventListener");
    render(<PullTitle title="Posts" enabled={false} />);
    expect(document.querySelector("[data-pull-title]")).toBeNull();
    expect(add.mock.calls.filter(([t]) => ["touchstart", "touchmove", "scroll"].includes(t as string))).toHaveLength(0);
  });

  it("removes its listeners when it becomes disabled", () => {
    const off = vi.spyOn(window, "removeEventListener");
    const { rerender } = render(<PullTitle title="Posts" enabled />);
    rerender(<PullTitle title="Posts" enabled={false} />);
    expect(off.mock.calls.map(([t]) => t)).toEqual(expect.arrayContaining(["touchstart", "touchmove", "touchend", "touchcancel", "scroll"]));
    expect(document.querySelector("[data-pull-title]")).toBeNull();
  });
});
