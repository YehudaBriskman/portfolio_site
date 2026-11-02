import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LivingLine from "@/components/motion/LivingLine";
import { STOPS } from "@/components/motion/lineTrace";

/*
 * jsdom has no layout, so this holds the component's contract and the
 * stylesheet as text: one path, out of the accessibility tree, normalised
 * to one unit; a keyframe stop per value the trace computes; scroll as the
 * only clock; and every exit on the drawn line. The geometry is held in
 * `lineTrace.test.ts`, the look in `docs/line/`.
 */

const CSS = readFileSync(resolve(process.cwd(), "src/components/motion/LivingLine.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("LivingLine", () => {
  it("renders one aria-hidden path behind its children, normalised to one unit", () => {
    const { container, getByText } = render(
      <LivingLine>
        <p data-line="start">Words</p>
      </LivingLine>,
    );
    const root = container.querySelector("[data-living-line]")!;
    const svg = root.firstElementChild!;
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("path")).toHaveLength(1);
    expect(svg.querySelector("path")).toHaveAttribute("pathLength", "1");
    expect(getByText("Words").closest("[data-living-line]")).toBe(root);
  });

  it("has a keyframe stop for every value the trace computes, each read from its own property", () => {
    const stops = [...CSS.matchAll(/(\d+)% \{ stroke-dashoffset: var\(--l(\d+), 0\); \}/g)];
    expect(stops).toHaveLength(STOPS + 1);
    stops.forEach((m, i) => {
      expect(Number(m[1])).toBe(i);
      expect(Number(m[2])).toBe(i);
    });
  });

  it("is drawn by scroll alone, at rest drawn", () => {
    expect(CSS).not.toMatch(/transition|animation-(duration|delay)|\d+m?s\b/);
    const rule = CSS.match(/\.path\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/animation:\s*living-line linear both/);
    expect(rule).toMatch(/animation-timeline:\s*--living-line/);
    expect(rule).toMatch(/stroke-dashoffset:\s*0/);
    expect(CSS).toMatch(/view-timeline:\s*--living-line block/);
  });

  it("lands all three off-switches, and print, on the line fully drawn", () => {
    const exits = [
      /@supports not \(animation-timeline: view\(\)\)\s*\{\s*\.path\s*\{([^}]*)\}/,
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.path\s*\{([^}]*)\}/,
      /:global\(body\.motion-paused\) \.path\s*\{([^}]*)\}/,
      /@media print\s*\{\s*\.path\s*\{([^}]*)\}/,
    ];
    for (const exit of exits) {
      const body = CSS.match(exit)?.[1] ?? "";
      expect(body, String(exit)).toMatch(/animation:\s*none/);
      expect(body).toMatch(/stroke-dashoffset:\s*0/);
    }
  });
});
