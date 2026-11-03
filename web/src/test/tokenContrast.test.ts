import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Colour pairs measured from the tokens themselves, in each theme (#247).
 *
 * axe measures what a route renders, and the routes it can reach do not
 * render everything: the admin's danger buttons sit behind a login, and the
 * Light value of --destructive-ink shipped at 2.31:1 on paper because no
 * page axe opens prints it. This reads the values out of index.css — the
 * light :root, the dark block, and `.on-panel` — resolves `var()` chains the
 * way the cascade would for an element in that context, and holds each pair
 * to its WCAG floor.
 *
 * Adding a pair here is how a token used only on an unaudited screen gets
 * measured at all.
 */

const CSS = readFileSync(resolve(__dirname, "../index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every declaration in every block whose selector is exactly `selector`. */
function decls(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`(^|[}\\s])${selector.replace(/[\\^$.*+?()[\]{}|']/g, "\\$&")}\\s*\\{`, "g");
  for (const m of CSS.matchAll(re)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    const start = i;
    while (depth > 0 && i < CSS.length) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}") depth--;
      i++;
    }
    const body = CSS.slice(start, i - 1);
    for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) out.set(d[1], d[2].trim());
  }
  return out;
}

const LIGHT = decls(":root");
const DARK = decls(":root[data-theme='dark']");
const PANEL = decls(".on-panel");

type Theme = Map<string, string>[];
/* A context is its own declarations over everything it inherits. */
const light: Theme = [LIGHT];
const dark: Theme = [DARK, LIGHT];
const panelOnLight: Theme = [PANEL, LIGHT];
const panelOnDark: Theme = [PANEL, DARK, LIGHT];

function rgbOf(name: string, theme: Theme, seen = new Set<string>()): number[] {
  if (seen.has(name)) throw new Error(`cycle at ${name}`);
  seen.add(name);
  const raw = theme.map((m) => m.get(name)).find((v) => v !== undefined);
  if (raw === undefined) throw new Error(`${name} is not declared`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  if (ref) return rgbOf(ref[1], theme, seen);
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`${name}: ${raw} is not an rgb triple`);
  return parts;
}

function luminance([r, g, b]: number[]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(fg: string, bg: string, theme: Theme) {
  const a = luminance(rgbOf(fg, theme));
  const b = luminance(rgbOf(bg, theme));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT = 4.5;

describe("danger buttons and error text (the admin's .a-btn-danger, .a-error, StatusPill)", () => {
  const grounds = ["--paper", "--paper-2", "--paper-3"];

  for (const [label, theme] of [["Light", light], ["Dark", dark]] as const) {
    for (const ground of grounds) {
      it(`${label}: --destructive-ink on ${ground} clears ${TEXT}:1`, () => {
        expect(ratio("--destructive-ink", ground, theme)).toBeGreaterThanOrEqual(TEXT);
      });
    }
    it(`${label}: the pressed danger button, --destructive-foreground on --destructive, clears ${TEXT}:1`, () => {
      expect(ratio("--destructive-foreground", "--destructive", theme)).toBeGreaterThanOrEqual(TEXT);
    });
  }

  for (const [label, theme] of [["Light", panelOnLight], ["Dark", panelOnDark]] as const) {
    for (const ground of ["--panel", "--panel-2"]) {
      it(`inside a dark act under ${label}: --destructive-ink on ${ground} clears ${TEXT}:1`, () => {
        expect(ratio("--destructive-ink", ground, theme)).toBeGreaterThanOrEqual(TEXT);
      });
    }
  }
});

describe("the reader's text, the same way", () => {
  for (const [label, theme] of [["Light", light], ["Dark", dark]] as const) {
    for (const fg of ["--ink", "--ink-soft"]) {
      for (const ground of ["--paper", "--paper-2"]) {
        it(`${label}: ${fg} on ${ground} clears ${TEXT}:1`, () => {
          expect(ratio(fg, ground, theme)).toBeGreaterThanOrEqual(TEXT);
        });
      }
    }
    it(`${label}: --signal-ink on --signal clears ${TEXT}:1`, () => {
      expect(ratio("--signal-ink", "--signal", theme)).toBeGreaterThanOrEqual(TEXT);
    });
  }
});

describe("the measuring itself", () => {
  it("fails the value that shipped, so it would have caught it", () => {
    const shipped: Theme = [new Map([["--destructive-ink", "232 122 108"]]), LIGHT];
    expect(ratio("--destructive-ink", "--paper", shipped)).toBeLessThan(TEXT);
  });
});
