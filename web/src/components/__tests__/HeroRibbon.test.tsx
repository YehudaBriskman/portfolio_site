import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Hero from "@/components/Hero";
import { heroRibbon } from "@/components/heroRibbon";

/*
 * The aurora ribbon round the figure. jsdom cannot see it go behind the
 * head — `scripts/shoot-hero-aurora.mjs` shoots that in a browser — so what
 * is pinned here is what makes the depth possible: two layers either side
 * of the photograph in one stacking context, one line split between them
 * with no gap, and motion only behind the three switches.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(
  resolve(HERE, "../HeroRibbon.module.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

describe("the hero's aurora ribbon", () => {
  it("puts one half under the photograph and the other over it", () => {
    const { container } = render(<Hero />);
    const portrait = container.querySelector("[data-portrait]")!;
    const parts = [...portrait.children].map((el) =>
      el.matches("[data-hero-ribbon]")
        ? `ribbon-${el.getAttribute("data-hero-ribbon")}`
        : el.tagName.toLowerCase(),
    );
    expect(parts[0]).toBe("ribbon-back");
    expect(parts.indexOf("picture")).toBeGreaterThan(0);
    expect(parts[parts.length - 1]).toBe("ribbon-front");
    /* Order alone is not depth: the z-indexes, inside the portrait's own
       stacking context, are. */
    expect(CSS).toMatch(/\.back \{\s*z-index: -1;/);
    expect(CSS).toMatch(/\.front \{\s*z-index: 1;/);
    for (const layer of portrait.querySelectorAll("[data-hero-ribbon]")) {
      expect(layer.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("splits one line, so the front half starts where the back half ends", () => {
    const { back, front, spineBack, spineFront } = heroRibbon();
    const last = (d: string) =>
      d
        .match(/[ML]([-\d.]+) ([-\d.]+)$/)!
        .slice(1)
        .join(" ");
    const first = (d: string) =>
      d
        .match(/^M([-\d.]+) ([-\d.]+)/)!
        .slice(1)
        .join(" ");
    expect(back).toHaveLength(front.length);
    back.forEach((d, i) => expect(first(front[i])).toBe(last(d)));
    expect(first(spineFront)).toBe(last(spineBack));
    /* The split is clear of the photograph, to its left. */
    expect(Number(first(spineFront).split(" ")[0])).toBeLessThan(0);
    /* And the tail leaves below the screen's floor, under the next act. */
    expect(Number(last(spineFront).split(" ")[1])).toBeGreaterThan(845);
  });

  it("drifts only on the hero's scroll, behind the three switches", () => {
    const gate = CSS.slice(
      CSS.indexOf("@supports (animation-timeline: view())"),
    );
    expect(gate).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(gate).toMatch(
      /body:not\(\.motion-paused\)\) \.back \{[^}]*animation-timeline: --hero/,
    );
    expect(gate).toMatch(
      /body:not\(\.motion-paused\)\) \.front \{[^}]*animation-timeline: --hero/,
    );
    /* Transforms only: no layout, no paint while it drifts. */
    for (const name of ["ribbon-back", "ribbon-front"]) {
      const frames =
        CSS.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ??
        "";
      expect(frames).toMatch(/from \{ transform: none; \}/);
      expect(frames.replace(/transform:[^;]*;/g, "")).not.toMatch(/:\s/);
    }
  });
});
