import { afterEach, describe, expect, it, vi } from "vitest";
import { motionOff, motionPaused, prefersReducedMotion } from "../motionOff";

function mockReduced(matches: boolean | "throws" | "missing") {
  if (matches === "missing") {
    vi.stubGlobal("matchMedia", undefined);
    return;
  }
  vi.stubGlobal(
    "matchMedia",
    matches === "throws"
      ? () => {
          throw new Error("no");
        }
      : () => ({ matches }),
  );
}

afterEach(() => {
  document.body.classList.remove("motion-paused");
  vi.unstubAllGlobals();
});

describe("motionOff", () => {
  it("is on when neither switch is set", () => {
    mockReduced(false);
    expect(motionOff()).toBe(false);
  });
  it("is off under the OS setting alone", () => {
    mockReduced(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionOff()).toBe(true);
  });
  it("is off under Pause alone", () => {
    mockReduced(false);
    document.body.classList.add("motion-paused");
    expect(motionPaused()).toBe(true);
    expect(motionOff()).toBe(true);
  });
  it("treats a missing or throwing matchMedia as no preference", () => {
    mockReduced("missing");
    expect(motionOff()).toBe(false);
    mockReduced("throws");
    expect(prefersReducedMotion()).toBe(false);
  });
});
