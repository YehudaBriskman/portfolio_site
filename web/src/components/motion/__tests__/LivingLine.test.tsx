import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LivingLine, { LINE_STRANDS } from "@/components/motion/LivingLine";
import { STOPS } from "@/components/motion/lineMoves";

/*
 * jsdom has no layout, so this holds the component's contract and the
 * stylesheet as text: a ribbon of strands, no glow, out of the
 * accessibility tree, each normalised to one unit; a keyframe stop per
 * value the composer computes; scroll as the only clock; and every exit on
 * the drawn line. The geometry is held in `lineMoves.test.ts`, the look in
 * `docs/line/`.
 */

const CSS = readFileSync(resolve(process.cwd(), "src/components/motion/LivingLine.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("LivingLine", () => {
  it("renders an aria-hidden ribbon of strands behind its children, every path normalised to one unit", () => {
    const { container, getByText } = render(
      <LivingLine>
        <p data-line='[{"move":"line-to","lane":"start"}]'>Words</p>
      </LivingLine>,
    );
    const root = container.querySelector("[data-living-line]")!;
    const svg = root.firstElementChild!;
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("[data-strand]")).toHaveLength(LINE_STRANDS);
    expect(svg.querySelectorAll("[data-line-glow]")).toHaveLength(0);
    for (const p of svg.querySelectorAll("path")) expect(p).toHaveAttribute("pathLength", "1");
    /* One gradient, and every stroke reads it. */
    const id = svg.querySelector("linearGradient")!.id;
    expect(svg.querySelector("[data-strands]")).toHaveAttribute("stroke", `url(#${id})`);
    expect(getByText("Words").closest("[data-living-line]")).toBe(root);
  });

  it("has a keyframe stop for every value the composer computes, each read from its own property", () => {
    const stops = [...CSS.matchAll(/(\d+)% \{ stroke-dashoffset: var\(--l(\d+), 0\); \}/g)];
    expect(stops).toHaveLength(STOPS + 1);
    stops.forEach((m, i) => {
      expect(Number(m[1])).toBe(i);
      expect(Number(m[2])).toBe(i);
    });
  });

  it("is drawn by scroll alone, at rest drawn, on a clock owned by the drawing", () => {
    expect(CSS).not.toMatch(/transition|animation-(duration|delay)|\d+m?s\b/);
    const rule = CSS.match(/\.ink\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/animation:\s*living-line linear both/);
    expect(rule).toMatch(/animation-timeline:\s*--living-line/);
    expect(rule).toMatch(/stroke-dashoffset:\s*0/);
    const svg = CSS.match(/\.svg\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(svg).toMatch(/view-timeline:\s*--living-line block/);
    expect(svg).toMatch(/view-timeline-inset:\s*50%/);
  });

  it("lands all three off-switches, and print, on the line fully drawn", () => {
    const exits = [
      /@supports not \(animation-timeline: view\(\)\)\s*\{\s*\.ink\s*\{([^}]*)\}/,
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.ink\s*\{([^}]*)\}/,
      /:global\(body\.motion-paused\) \.ink\s*\{([^}]*)\}/,
      /@media print\s*\{\s*\.ink\s*\{([^}]*)\}/,
    ];
    for (const exit of exits) {
      const body = CSS.match(exit)?.[1] ?? "";
      expect(body, String(exit)).toMatch(/animation:\s*none/);
      expect(body).toMatch(/stroke-dashoffset:\s*0/);
    }
  });
});
