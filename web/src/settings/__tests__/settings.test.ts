import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCENT_PRESETS, type Rgb } from "../accents";
import { ACCENTS, DEFAULT_SETTINGS, SiteSettingsSchema } from "../schema";
import { loadSettings, resetSettings, settingsSnapshot, siteMotionPaused } from "../store";

/*
 * The site settings (#254), from the web's side: the schema is the server's,
 * every accent preset is readable on every ground in both themes and is the
 * one index.css and theme-boot.js apply, and the store keeps the defaults
 * whenever the API does not answer with valid settings.
 */

const ROOT = resolve(__dirname, "../../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const MARK = "// ---- copy below ----\n";
const body = (src: string) => src.slice(src.indexOf(MARK));

describe("the settings schema", () => {
  it("is the backend's, byte for byte below the marker", () => {
    expect(body(read("web/src/settings/schema.ts"))).toBe(body(read("backend/src/schemas/site-settings.ts")));
  });

  it("accepts the defaults, and they are the site as built", () => {
    expect(SiteSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(DEFAULT_SETTINGS.home.sections.map((s) => s.id)).toEqual(["work", "approach", "city", "notes", "stack", "contact"]);
  });
});

describe("the sharing group", () => {
  const { sharing: _omit, ...old } = DEFAULT_SETTINGS;
  const withSharing = (patch: object) => SiteSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, sharing: { ...DEFAULT_SETTINGS.sharing, ...patch } });

  it("fills in the defaults for a document saved before it existed", () => {
    const parsed = SiteSettingsSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sharing).toEqual(DEFAULT_SETTINGS.sharing);
    expect(DEFAULT_SETTINGS.sharing).toMatchObject({ enabled: true, utm: { enabled: true, source: "share" }, templates: { en: {}, he: {} } });
  });

  it("refuses duplicates, unknown entries and unknown keys", () => {
    expect(withSharing({ channels: ["copy", "copy"] }).success).toBe(false);
    expect(withSharing({ surfaces: ["post", "post"] }).success).toBe(false);
    expect(withSharing({ channels: ["tiktok"] }).success).toBe(false);
    expect(withSharing({ extra: 1 }).success).toBe(false);
    expect(withSharing({ templates: { en: { tiktok: "x" }, he: {} } }).success).toBe(false);
  });

  it("limits templates to 1000 characters of plain text", () => {
    const tpl = (t: string) => withSharing({ templates: { en: { linkedin: t }, he: {} } }).success;
    expect(tpl("a".repeat(1000))).toBe(true);
    expect(tpl("a".repeat(1001))).toBe(false);
    expect(tpl("<script>alert(1)</script>")).toBe(false);
    expect(tpl("<b>x</b>")).toBe(false);
    expect(tpl("{title} < 5 and > 3 {url}")).toBe(true);
  });
});

/* WCAG 2 relative luminance and contrast. */
function lum([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* The grounds a link stands on, per theme, as index.css declares them. */
const GROUNDS: Record<"light" | "dark", Rgb[]> = {
  light: [
    [236, 232, 220],
    [228, 223, 209],
    [216, 210, 194],
  ],
  dark: [
    [28, 26, 22],
    [40, 37, 32],
    [52, 48, 42],
  ],
};

describe("the accent presets", () => {
  for (const accent of ACCENTS) {
    for (const theme of ["light", "dark"] as const) {
      it(`${accent} in ${theme} is AA as text on every ground, and its own type is AA on it`, () => {
        const { signal, ink } = ACCENT_PRESETS[accent][theme];
        for (const g of GROUNDS[theme]) expect(ratio(signal, g)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ink, signal)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("are the values index.css declares, and ink is the stylesheet's own signal", () => {
    const css = read("web/src/index.css");
    const triple = (c: Rgb) => c.join(" ");
    const loose = (c: Rgb) => new RegExp(`--signal:\\s+${c.join("\\s+")};`);
    expect(css).toMatch(loose(ACCENT_PRESETS.ink.light.signal));
    expect(css).toMatch(loose(ACCENT_PRESETS.ink.dark.signal));
    for (const a of ACCENTS.filter((x) => x !== "ink")) {
      const p = ACCENT_PRESETS[a];
      expect(css).toContain(`:root[data-accent='${a}'] { --signal: ${triple(p.light.signal)}; --signal-ink: ${triple(p.light.ink)}; }`);
      expect(css).toContain(
        `:root[data-theme='dark'][data-accent='${a}'] { --signal: ${triple(p.dark.signal)}; --signal-ink: ${triple(p.dark.ink)}; }`,
      );
    }
  });

  it("are the ones theme-boot.js applies before first paint", () => {
    const boot = read("web/public/theme-boot.js");
    const listed = [...boot.matchAll(/accent === "([a-z]+)"/g)].map((m) => m[1]);
    expect(listed).toEqual(ACCENTS.filter((x) => x !== "ink"));
  });

  it("runs theme-boot.js to an attribute only for a known preset", () => {
    const run = (value: string) => {
      document.head.innerHTML = `<meta name="site-accent" content="${value}">`;
      document.documentElement.removeAttribute("data-accent");
      new Function(read("web/public/theme-boot.js"))();
      return document.documentElement.getAttribute("data-accent");
    };
    expect(run("plum")).toBe("plum");
    expect(run("ink")).toBeNull();
    expect(run("#ff00ff")).toBeNull();
    document.head.innerHTML = "";
  });
});

describe("the settings store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSettings();
    document.documentElement.removeAttribute("data-accent");
    document.head.innerHTML = "";
  });

  const answer = (status: number, json: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(json), { status })));

  it("keeps the defaults when the API is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await loadSettings();
    expect(settingsSnapshot()).toBe(DEFAULT_SETTINGS);
  });

  it("keeps the defaults over a body that fails the schema", async () => {
    answer(200, { ok: true, settings: { home: { sections: [] }, visuals: { theme: "neon" } } });
    await loadSettings();
    expect(settingsSnapshot()).toBe(DEFAULT_SETTINGS);
  });

  it("takes valid settings, and applies the accent", async () => {
    const next = structuredClone(DEFAULT_SETTINGS);
    next.home.sections[0].visible = false;
    next.visuals.accent = "rust";
    answer(200, { ok: true, settings: next });
    await loadSettings();
    expect(settingsSnapshot()).toEqual(next);
    expect(document.documentElement.getAttribute("data-accent")).toBe("rust");
  });

  it("reads the motion default from the shell's meta until the API says otherwise", () => {
    expect(siteMotionPaused()).toBe(false);
    document.head.innerHTML = `<meta name="site-motion-default" content="paused">`;
    expect(siteMotionPaused()).toBe(true);
  });
});
