import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getResolvedTheme, setThemeChoice, syncTheme, useTheme } from "../theme";
import { SITE_THEME_DEFAULT, THEME_KEY } from "../themeDefault";

/*
 * The theme (#247): a stored choice persists, System follows
 * `prefers-color-scheme` (at load and while open), and the first paint is
 * already in the right theme — which jsdom cannot paint, so it is held the
 * two ways that decide it: the boot script is executed here and must set the
 * theme synchronously, and the HTML must load it as a blocking classic script
 * in <head> under the CSP the site actually ships.
 */

const WEB = resolve(__dirname, "../../..");
const BOOT = readFileSync(resolve(WEB, "public/theme-boot.js"), "utf8");
const HTML = readFileSync(resolve(WEB, "index.html"), "utf8");
const HEADERS = readFileSync(resolve(WEB, "security-headers.conf"), "utf8");
const CSS = readFileSync(resolve(WEB, "src/index.css"), "utf8");

/* An OS colour scheme the test can flip, with real change events. */
let systemDark = false;
const listeners = new Set<(e: MediaQueryListEvent) => void>();
function fakeMatchMedia(query: string): MediaQueryList {
  return {
    media: query,
    get matches() {
      return query.includes("dark") ? systemDark : false;
    },
    onchange: null,
    addEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}
function flipSystem(dark: boolean) {
  systemDark = dark;
  for (const l of [...listeners]) l({ matches: dark } as MediaQueryListEvent);
}

function setDefaultMeta(value: string | null) {
  document.head.querySelector('meta[name="site-theme-default"]')?.remove();
  if (value === null) return;
  const m = document.createElement("meta");
  m.name = "site-theme-default";
  m.content = value;
  document.head.append(m);
}

const runBoot = () => new Function(BOOT)();

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", fakeMatchMedia);
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  setDefaultMeta(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persistence", () => {
  it("stores the choice and applies it", () => {
    setThemeChoice("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    setThemeChoice("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(getResolvedTheme()).toBe("light");
  });

  it("reads a stored choice back on the next load, over the OS", () => {
    systemDark = true;
    localStorage.setItem(THEME_KEY, "light");
    expect(syncTheme()).toBe("light");
  });

  it("stores System as System, so a later site default does not override it", () => {
    setThemeChoice("system");
    expect(localStorage.getItem(THEME_KEY)).toBe("system");
    setDefaultMeta("dark");
    expect(syncTheme()).toBe("light");
  });

  it("still applies when storage throws, and ignores a stored value it does not know", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => setThemeChoice("dark")).not.toThrow();
    expect(getResolvedTheme()).toBe("dark");
    vi.restoreAllMocks();

    localStorage.setItem(THEME_KEY, "sepia");
    systemDark = true;
    expect(syncTheme()).toBe("dark");
  });

  it("survives a getItem that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(syncTheme()).toBe("light");
  });
});

describe("System follows prefers-color-scheme", () => {
  it("resolves from the OS at load", () => {
    systemDark = true;
    expect(syncTheme()).toBe("dark");
    systemDark = false;
    expect(syncTheme()).toBe("light");
  });

  it("follows the OS while the page is open, and only while the choice is System", () => {
    syncTheme();
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("system");
    expect(result.current.resolved).toBe("light");

    act(() => flipSystem(true));
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => result.current.setChoice("light"));
    act(() => flipSystem(true));
    expect(result.current.resolved).toBe("light");
  });

  it("updates the browser chrome's theme-color with the ground", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#ECE8DC";
    document.head.append(meta);
    setThemeChoice("dark");
    expect(meta.content).toBe("#1C1A16");
    setThemeChoice("light");
    expect(meta.content).toBe("#ECE8DC");
    meta.remove();
  });
});

describe("the site default", () => {
  it("is a constant, written into the shell's meta from one place", () => {
    expect(SITE_THEME_DEFAULT).toBe("system");
    expect(HTML).toMatch(/<meta name="site-theme-default" content="%SITE_THEME_DEFAULT%" \/>/);
    expect(readFileSync(resolve(WEB, "vite.config.ts"), "utf8")).toMatch(
      /replaceAll\("%SITE_THEME_DEFAULT%", SITE_THEME_DEFAULT\)/,
    );
  });

  it("is what a reader with no choice gets, and a choice beats it", () => {
    setDefaultMeta("dark");
    expect(syncTheme()).toBe("dark");
    localStorage.setItem(THEME_KEY, "light");
    expect(syncTheme()).toBe("light");
  });
});

describe("no flash on first paint", () => {
  it("the boot script sets the stored theme synchronously, before anything else runs", () => {
    localStorage.setItem(THEME_KEY, "dark");
    runBoot();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("the boot script resolves System and the site default the way lib/theme.ts does", () => {
    for (const [stored, meta, os] of [
      [null, null, true],
      [null, "dark", false],
      [null, "light", true],
      ["system", "dark", false],
      ["light", "dark", true],
      ["bogus", null, true],
    ] as const) {
      localStorage.clear();
      if (stored) localStorage.setItem(THEME_KEY, stored);
      setDefaultMeta(meta);
      systemDark = os;
      document.documentElement.removeAttribute("data-theme");
      runBoot();
      const fromBoot = document.documentElement.getAttribute("data-theme");
      expect(syncTheme(), `${stored}/${meta}/${os}`).toBe(fromBoot);
    }
  });

  it("the boot script survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    systemDark = true;
    expect(runBoot).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("uses the same storage key as the app", () => {
    expect(BOOT).toContain(`"${THEME_KEY}"`);
  });

  it("is loaded as a blocking classic script in <head>, ahead of the stylesheet and the app", () => {
    const head = HTML.slice(0, HTML.indexOf("</head>"));
    const tag = head.match(/<script[^>]*src="\/theme-boot\.js"[^>]*>/)?.[0];
    expect(tag).toBeDefined();
    expect(tag).not.toMatch(/\b(defer|async|type="module")\b/);
    expect(HTML.indexOf("/theme-boot.js")).toBeLessThan(HTML.indexOf("/src/main.tsx"));
  });

  it("needs no CSP exception: script-src stays 'self' with no inline hash", () => {
    const csp = HEADERS.match(/^add_header Content-Security-Policy "([^"]+)"/m)?.[1] ?? "";
    expect(csp.split(";").map((d) => d.trim())).toContain("script-src 'self'");
  });
});

describe("the dark block in index.css", () => {
  const block = (sel: string) => {
    const i = CSS.indexOf(`${sel} {`);
    return CSS.slice(i, CSS.indexOf("\n  }", i));
  };
  const names = (s: string) => new Set([...s.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));

  it("is on :root, so every alias declared there re-resolves with it", () => {
    expect(CSS).toContain(":root[data-theme='dark'] {");
  });

  it("only re-points tokens the light block declares (one set of names, two values)", () => {
    const light = names(block(":root"));
    for (const n of names(block(":root[data-theme='dark']"))) expect(light.has(n), n).toBe(true);
  });

  it("declares the colour scheme with the theme", () => {
    expect(block(":root[data-theme='dark']")).toMatch(/color-scheme: dark;/);
    expect(block(":root")).toMatch(/color-scheme: light;/);
  });
});
