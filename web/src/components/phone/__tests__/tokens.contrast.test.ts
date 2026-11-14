import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The tint tokens of direction A (phone/tokens.css) against the palette they
 * are derived from (src/index.css): a circle's glyph on its tinted disc must
 * reach 3:1 (non-text, WCAG 1.4.11) and a pill's word on its wash 4.5:1
 * (1.4.3), in light and dark, for every tone. Computed here with the same
 * mixing the CSS does (sRGB `color-mix`), so a palette change that breaks a
 * tone fails here, not on a phone.
 */

const SRC = resolve(__dirname, "../../..");
const css = readFileSync(resolve(SRC, "index.css"), "utf8");
const tokens = readFileSync(resolve(SRC, "components/phone/tokens.css"), "utf8");

type RGB = [number, number, number];

/** `--name: r g b;` inside the first block matching `scope` (a selector prefix). */
function triple(name: string, scope: RegExp): RGB {
  const start = css.search(scope);
  expect(start, `scope ${scope}`).toBeGreaterThan(-1);
  const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(css.slice(start));
  expect(m, `--${name} after ${scope}`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

const mix = (a: RGB, b: RGB, pct: number): RGB => a.map((v, i) => v * (1 - pct) + b[i] * pct) as RGB;
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const pct = (name: string, block: "light" | "dark") => {
  const re = block === "dark" ? new RegExp(`:root\\[data-theme="dark"\\][^{]*\\{[^}]*--${name}:\\s*(\\d+)%`) : new RegExp(`:root\\s*\\{[^}]*--${name}:\\s*(\\d+)%`);
  const m = re.exec(tokens);
  expect(m, `--${name} (${block}) in tokens.css`).not.toBeNull();
  return Number(m![1]) / 100;
};

const HUES = ["blue", "green", "purple", "yellow", "red"] as const;
const WHITE: RGB = [255, 255, 255];

const themes = {
  light: () => {
    const scope = /:root\s*\{[^}]*--hue-red/;
    const canvas = triple("paper", /--paper:/);
    return {
      card: mix(canvas, WHITE, 0.38),
      toward: triple("ink", /--ink:\s/) as RGB,
      hue: (h: string) => triple(`hue-${h}`, scope),
      wash: (h: string) => triple(`wash-${h}`, /--wash-red:/),
    };
  },
  dark: () => {
    const scope = /:root\[data-theme='dark'\]\s*\{\s*--paper:/;
    return {
      card: mix(triple("paper", scope), triple("paper-2", scope), 0.62),
      toward: WHITE,
      hue: (h: string) => triple(`hue-${h}`, /:root\s*\{[^}]*--hue-red/),
      wash: (h: string) => triple(`wash-${h}`, /:root\[data-theme='dark'\]\s*\{\s*--paper:/),
    };
  },
};

describe("direction A tone tokens: contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    const t = themes[mode]();
    for (const h of HUES) {
      it(`${mode} ${h}: glyph on its circle is at least 3:1`, () => {
        const disc = mix(t.card, t.hue(h), 0.17);
        const glyph = mix(t.hue(h), t.toward, pct("ph-glyph-pct", mode));
        expect(ratio(glyph, disc)).toBeGreaterThanOrEqual(3);
      });
      it(`${mode} ${h}: pill word on its wash is at least 4.5:1`, () => {
        const wash = mix(t.card, t.wash(h), 0.9);
        const word = mix(t.hue(h), t.toward, pct("ph-text-pct", mode));
        expect(ratio(word, wash)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
