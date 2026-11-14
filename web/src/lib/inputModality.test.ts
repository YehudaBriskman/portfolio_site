import { afterEach, describe, expect, it } from "vitest";
import { getModality, installInputModality, isNavigationKey } from "./inputModality";

let off: (() => void) | undefined;
afterEach(() => {
  off?.();
  document.documentElement.removeAttribute("data-input");
});

describe("input modality", () => {
  it("starts as pointer and follows the last real input", () => {
    off = installInputModality();
    expect(getModality()).toBe("pointer");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(getModality()).toBe("keyboard");
    expect(document.documentElement.getAttribute("data-input")).toBe("keyboard");
    document.dispatchEvent(new Event("pointerdown"));
    expect(getModality()).toBe("pointer");
    document.dispatchEvent(new Event("touchstart"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(getModality()).toBe("keyboard");
    document.dispatchEvent(new Event("mousedown"));
    expect(getModality()).toBe("pointer");
  });

  it("ignores modifier-only presses and shortcuts", () => {
    off = installInputModality();
    for (const key of ["Shift", "Control", "Alt", "Meta"]) document.dispatchEvent(new KeyboardEvent("keydown", { key }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "r", metaKey: true }));
    expect(getModality()).toBe("pointer");
    expect(isNavigationKey({ key: "Tab", ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
  });

  it("stops listening once disposed", () => {
    off = installInputModality();
    off();
    off = undefined;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(getModality()).toBe("pointer");
  });
});
