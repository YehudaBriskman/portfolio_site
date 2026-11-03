import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRAST_KEY,
  TEXT_SIZE_KEY,
  setContrast,
  setTextSize,
  syncViewerPrefs,
  useViewerPrefs,
} from "../viewerPrefs";

/*
 * The viewer controls (#99): text size and contrast persist, Contrast's
 * System follows `prefers-contrast: more` at load and while open, and the
 * boot script gives the first paint the same answer the store does.
 */

const WEB = resolve(__dirname, "../../..");
const BOOT = readFileSync(resolve(WEB, "public/theme-boot.js"), "utf8");
const CSS = readFileSync(resolve(WEB, "src/index.css"), "utf8");
const runBoot = () => new Function(BOOT)();

let systemMore = false;
const listeners = new Set<(e: MediaQueryListEvent) => void>();
function fakeMatchMedia(query: string): MediaQueryList {
  return {
    media: query,
    get matches() {
      return query.includes("contrast") ? systemMore : false;
    },
    onchange: null,
    addEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

const attr = (n: string) => document.documentElement.getAttribute(n);

beforeEach(() => {
  systemMore = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", fakeMatchMedia);
  localStorage.clear();
  document.documentElement.removeAttribute("data-text-size");
  document.documentElement.removeAttribute("data-contrast");
  syncViewerPrefs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("text size", () => {
  it("defaults, then persists a choice and writes it to <html>", () => {
    expect(attr("data-text-size")).toBe("default");
    setTextSize("larger");
    expect(attr("data-text-size")).toBe("larger");
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe("larger");
    document.documentElement.removeAttribute("data-text-size");
    expect(syncViewerPrefs().textSize).toBe("larger");
    expect(attr("data-text-size")).toBe("larger");
  });

  it("ignores a stored value it does not know", () => {
    localStorage.setItem(TEXT_SIZE_KEY, "huge");
    expect(syncViewerPrefs().textSize).toBe("default");
  });

  it("scales the root size, on both rungs, in index.css", () => {
    expect(CSS).toMatch(/:root\[data-text-size='larger'\] \{ --text-scale: 1\.25; \}/);
    expect(CSS).toMatch(/html \{ font-size: calc\(100% \* var\(--text-scale\)\); \}/);
    expect(CSS).toMatch(/html \{ font-size: calc\(106\.25% \* var\(--text-scale\)\); \}/);
  });
});

describe("contrast", () => {
  it("System follows prefers-contrast at load and while open", () => {
    expect(attr("data-contrast")).toBe("standard");
    systemMore = true;
    syncViewerPrefs();
    expect(attr("data-contrast")).toBe("more");

    const { result } = renderHook(() => useViewerPrefs());
    expect(result.current.contrast).toBe("system");
    act(() => {
      systemMore = false;
      for (const l of [...listeners]) l({ matches: false } as MediaQueryListEvent);
    });
    expect(attr("data-contrast")).toBe("standard");
    expect(result.current.resolvedContrast).toBe("standard");
  });

  it("an explicit choice wins over the OS, and persists", () => {
    systemMore = true;
    setContrast("standard");
    expect(attr("data-contrast")).toBe("standard");
    expect(localStorage.getItem(CONTRAST_KEY)).toBe("standard");
    setContrast("more");
    systemMore = false;
    expect(syncViewerPrefs().contrast).toBe("more");
  });

  it("has one block in index.css, which also beats the dark theme's", () => {
    expect(CSS).toContain(":root[data-contrast='more'][data-contrast='more'] {");
    expect(CSS).toContain(":root[data-theme='dark'][data-contrast='more'] {");
  });
});

describe("the boot script", () => {
  it("writes the same two attributes as the store, before React", () => {
    for (const [size, contrast, more] of [
      [null, null, false],
      [null, null, true],
      ["large", "standard", true],
      ["larger", "more", false],
      ["bogus", "system", true],
    ] as const) {
      localStorage.clear();
      if (size) localStorage.setItem(TEXT_SIZE_KEY, size);
      if (contrast) localStorage.setItem(CONTRAST_KEY, contrast);
      systemMore = more;
      document.documentElement.removeAttribute("data-text-size");
      document.documentElement.removeAttribute("data-contrast");
      runBoot();
      const boot = [attr("data-text-size"), attr("data-contrast")];
      const store = syncViewerPrefs();
      expect(boot).toEqual([store.textSize, store.contrast]);
    }
  });
});
