import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Hero from "@/components/Hero";
import { heroRibbon } from "@/components/heroRibbon";

/*
 * The aurora ribbon across the figure. jsdom cannot see it — the shots in
 * `docs/hero-aurora-v2/` (`scripts/shoot-hero-aurora.mjs`) do — so what is
 * pinned here is what makes it right: one layer, over the photograph and
 * never under it (#272), one sweep that bends one way only, and motion only
 * behind the three switches.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(
  resolve(HERE, "../HeroRibbon.module.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const points = (d: string) =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);

describe("the hero's aurora ribbon", () => {
  it("is drawn over the photograph only, never under it", () => {
    const { container } = render(<Hero />);
    const portrait = container.querySelector("[data-portrait]")!;
    const parts = [...portrait.children].map((el) =>
      el.matches("[data-hero-ribbon]") ? "ribbon" : el.tagName.toLowerCase(),
    );
    /* Exactly one layer, and after the picture. */
    expect(parts.filter((p) => p === "ribbon")).toHaveLength(1);
    expect(parts.indexOf("ribbon")).toBeGreaterThan(parts.indexOf("picture"));
    expect(CSS).toMatch(/\.layer \{[^}]*z-index: 1;/);
    expect(CSS).not.toMatch(/z-index: -/);
    expect(
      portrait.querySelector("[data-hero-ribbon]")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  for (const tail of ["wide", "narrow"] as const) {
    it(`sweeps ${tail}: from the left, across the chest, one gentle curve down-right`, () => {
      const spine = points(heroRibbon(7, tail).spine);
      const [x0] = spine[0];
      const [xn, yn] = spine[spine.length - 1];
      /* Born left of the figure, leaving below the screen's floor. */
      expect(x0).toBeLessThan(0);
      expect(yn).toBeGreaterThan(845);
      /* At chest height (y 450–600) across the chest (x 20–400), before the far arm. */
      for (const [x, y] of spine) {
        if (x >= 20 && x <= 400) {
          expect(y).toBeGreaterThan(450);
          expect(y).toBeLessThan(600);
        }
      }
      /* Always rightward and downward: no loop, no doubling back. */
      for (let i = 1; i < spine.length; i += 1) {
        expect(spine[i][0]).toBeGreaterThanOrEqual(spine[i - 1][0] - 0.11);
        expect(spine[i][1]).toBeGreaterThanOrEqual(spine[i - 1][1] - 0.11);
      }
      /* One curve: the heading only ever turns the same way (no S-bend). */
      const heading = spine
        .slice(1)
        .map(([x, y], i) => Math.atan2(y - spine[i][1], x - spine[i][0]));
      for (let i = 2; i < heading.length; i += 1) {
        expect(heading[i]).toBeGreaterThanOrEqual(heading[i - 2] - 0.02);
      }
      expect(xn).toBeGreaterThan(tail === "wide" ? 1000 : 560);
    });
  }

  it("leaves inside the window: ~90% of 1440 wide, inside 390 on a phone", () => {
    const maxX = (d: string) => Math.max(...points(d).map(([x]) => x));
    expect(maxX(heroRibbon().spine)).toBeGreaterThan(1040);
    expect(maxX(heroRibbon(7, "narrow").spine)).toBeLessThan(680);
  });

  it("drifts only on the hero's scroll, behind the three switches, and slightly", () => {
    const gate = CSS.slice(
      CSS.indexOf("@supports (animation-timeline: view())"),
    );
    expect(gate).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(gate).toMatch(
      /body:not\(\.motion-paused\)\) \.layer \{[^}]*animation-timeline: --hero/,
    );
    const frames =
      CSS.match(/@keyframes ribbon-drift \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(frames).toMatch(/from \{ transform: none; \}/);
    /* Transforms only: no layout, no paint while it drifts. */
    expect(frames.replace(/transform:[^;]*;/g, "")).not.toMatch(/:\s/);
    /* Subtle: under a degree of turn. */
    const deg = Number(frames.match(/rotate\((-?[\d.]+)deg\)/)?.[1] ?? 0);
    expect(Math.abs(deg)).toBeLessThan(1);
  });
});
