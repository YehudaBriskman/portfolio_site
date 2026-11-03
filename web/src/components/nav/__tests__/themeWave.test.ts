import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getResolvedTheme, syncTheme } from "@/lib/theme";
import { THEME_KEY } from "@/lib/themeDefault";
import { canWave, changeTheme, coverRadius } from "../themeWave";

/*
 * The theme wave (#266). jsdom has no view transitions and paints nothing,
 * so what is held here is the contract around the paint: when a transition
 * is started and when it is not, that the theme is switched inside it, that
 * the geometry reaches the farthest corner, and that <html> is left clean.
 * The paint itself is checked in Chromium (docs/theme-wave/).
 */

const CSS = readFileSync(resolve(__dirname, "../theme-wave.css"), "utf8");

let reduced = false;
let systemDark = false;
function fakeMatchMedia(query: string) {
  return {
    media: query,
    get matches() {
      if (query.includes("reduced-motion")) return reduced;
      if (query.includes("color-scheme: dark")) return systemDark;
      return false;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

type Doc = { startViewTransition?: unknown };
const doc = () => document as unknown as Doc;
let resolveFinished: () => void;
let seenInside: { theme: string | null; wave: boolean; r: string } | null;
const start = vi.fn((update: () => void) => {
  update();
  const root = document.documentElement;
  seenInside = {
    theme: root.getAttribute("data-theme"),
    wave: root.hasAttribute("data-theme-wave"),
    r: root.style.getPropertyValue("--wave-r"),
  };
  return { finished: new Promise<void>((r) => (resolveFinished = r)) };
});

beforeEach(() => {
  reduced = false;
  systemDark = false;
  seenInside = null;
  start.mockClear();
  vi.stubGlobal("matchMedia", fakeMatchMedia);
  doc().startViewTransition = start;
  document.body.classList.remove("motion-paused");
  localStorage.clear();
  localStorage.setItem(THEME_KEY, "light");
  syncTheme();
});
afterEach(() => {
  delete doc().startViewTransition;
  vi.unstubAllGlobals();
});

const ORIGIN = { x: 1300, y: 28 };

describe("the geometry", () => {
  it("reaches the farthest corner of the window", () => {
    expect(coverRadius({ x: 1300, y: 28 }, 1440, 900)).toBe(Math.ceil(Math.hypot(1300, 872)));
    expect(coverRadius({ x: 0, y: 0 }, 300, 400)).toBe(500);
    /* From the middle, every corner is equally far. */
    expect(coverRadius({ x: 150, y: 200 }, 300, 400)).toBe(250);
  });
});

describe("when it plays", () => {
  it("plays when supported and nothing has switched motion off", () => {
    expect(canWave()).toBe(true);
  });

  it("does not under reduced motion, under Pause, or without view transitions", () => {
    reduced = true;
    expect(canWave()).toBe(false);
    reduced = false;
    document.body.classList.add("motion-paused");
    expect(canWave()).toBe(false);
    document.body.classList.remove("motion-paused");
    delete doc().startViewTransition;
    expect(canWave()).toBe(false);
  });
});

describe("changing the theme", () => {
  it("switches the theme inside the transition, with the circle set on <html>", async () => {
    changeTheme("dark", ORIGIN);
    expect(start).toHaveBeenCalledTimes(1);
    expect(seenInside).toEqual({
      theme: "dark",
      wave: true,
      r: `${coverRadius(ORIGIN, window.innerWidth, window.innerHeight)}px`,
    });
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    resolveFinished();
    await Promise.resolve();
    await Promise.resolve();
    const root = document.documentElement;
    expect(root.hasAttribute("data-theme-wave")).toBe(false);
    expect(root.style.getPropertyValue("--wave-x")).toBe("");
    expect(root.style.getPropertyValue("--wave-r")).toBe("");
  });

  it("is instant under an off-switch, and still stores and applies the choice", () => {
    reduced = true;
    changeTheme("dark", ORIGIN);
    expect(start).not.toHaveBeenCalled();
    expect(getResolvedTheme()).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme-wave")).toBe(false);
  });

  it("is instant with nothing to show: System when the OS already agrees", () => {
    changeTheme("system", ORIGIN);
    expect(start).not.toHaveBeenCalled();
    expect(localStorage.getItem(THEME_KEY)).toBe("system");
  });

  it("is instant with no origin to grow from", () => {
    changeTheme("dark");
    expect(start).not.toHaveBeenCalled();
    expect(getResolvedTheme()).toBe("dark");
  });

  it("agrees with a reload: the stored choice resolves to the theme the wave revealed", () => {
    changeTheme("dark", ORIGIN);
    const shown = getResolvedTheme();
    expect(syncTheme()).toBe(shown);
  });
});

describe("the stylesheet", () => {
  it("cancels the default cross-fade on both snapshots and grows a circle on the new one", () => {
    expect(CSS).toMatch(/::view-transition-old\(root\),\s*:root\[data-theme-wave\]::view-transition-new\(root\)\s*\{\s*animation: none;/);
    expect(CSS).toMatch(/::view-transition-new\(root\)\s*\{\s*animation: theme-wave 600ms/);
    expect(CSS).toMatch(/from\s*\{\s*clip-path: circle\(0 at var\(--wave-x/);
    expect(CSS).toMatch(/to\s*\{\s*clip-path: circle\(var\(--wave-r/);
  });

  it("keeps the whole page in one snapshot for the wave", () => {
    expect(CSS).toMatch(/:root\[data-theme-wave\] \*\s*\{\s*view-transition-name: none !important;/);
  });
});
