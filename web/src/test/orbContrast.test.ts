import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The page's colour orbs sit behind text (`ground/AmbientOrbs`). They are a
 * tint at `--orb-alpha`, so the worst background any text can meet is the
 * ground blended toward the strongest soft hue at the orb's centre (the
 * four orbs sit in the four corners, 40+ vmax apart, so their 70% gradients
 * only touch at their faint edges: a second orb adds a fraction of its
 * alpha there, never a second full one). Body text (--ink-soft, the weakest
 * text token) must still clear 4.5:1 on that, and --ink 7:1.
 */
const CSS = readFileSync(resolve(__dirname, "../index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const at = CSS.search(new RegExp(`(^|[}\\s])${selector.replace(/[\\^$.*+?()[\]{}|']/g, "\\$&")}\\s*\\{`));
  let i = CSS.indexOf("{", at) + 1;
  const start = i;
  for (let depth = 1; depth > 0 && i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    else if (CSS[i] === "}") depth -= 1;
  }
  for (const d of CSS.slice(start, i - 1).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) out.set(d[1], d[2].trim());
  return out;
}

const LIGHT = block(":root");
const DARK = new Map([...LIGHT, ...block(":root[data-theme='dark']")]);

const rgb = (m: Map<string, string>, k: string) => {
  const v = m.get(k);
  if (!v) throw new Error(`${k} missing`);
  return v.split(/\s+/).map(Number);
};
const lum = ([r, g, b]: number[]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const mix = (bg: number[], fg: number[], a: number) => bg.map((v, i) => v * (1 - a) + fg[i] * a);

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("orbs on the %s ground", (_name, t) => {
  const paper = rgb(t, "--paper");
  const a = Number(t.get("--orb-alpha"));
  const hues = ["--soft-sage", "--soft-blue", "--soft-sand", "--soft-lilac"].map((k) => rgb(t, k));

  it("declares an alpha that is a tint, not a fill", () => {
    expect(a).toBeGreaterThan(0.05);
    expect(a).toBeLessThanOrEqual(0.22);
  });

  it("keeps --ink-soft at 4.5:1 and --ink at 7:1 under the strongest orb at its centre", () => {
    for (const h of hues) {
      const bg = mix(paper, h, a);
      expect(ratio(rgb(t, "--ink-soft"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(rgb(t, "--ink"), bg)).toBeGreaterThanOrEqual(7);
    }
  });
});
