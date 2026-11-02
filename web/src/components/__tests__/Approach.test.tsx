import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Approach from "@/components/Approach";
import { about } from "@/data/site";

/*
 * jsdom runs no scroll timeline and draws nothing, so what is asserted here is
 * what can rot without anyone noticing: every line of copy on the page as its
 * own pen-written paragraph, the coupling between a claim and the figure drawn
 * for it, the figures out of the accessibility tree, the employer rule, and
 * the stylesheet's three off-switches landing on the drawn state. What the
 * figures look like mid-scroll is in `docs/approach/`.
 */

const css = readFileSync(resolve(__dirname, "../Approach.module.css"), "utf8");

function principleFor(claim: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: claim, level: 3 });
  const item = heading.parentElement?.parentElement;
  if (!item) throw new Error(`no item around ${claim}`);
  return item;
}

/* `Written` sets each word as its own span, so a paragraph is found by its
   whole textContent — what a reader and the clipboard get. */
const paragraph = (text: string) =>
  screen.getByText((_, el) => el?.hasAttribute("data-written") === true && el.textContent === text);

afterEach(() => {
  vi.doUnmock("@/data/site");
  vi.resetModules();
});

describe("Approach", () => {
  it("puts every line on the page as its own written paragraph", () => {
    render(<Approach />);
    expect(screen.getByRole("heading", { name: about.heading, level: 2 })).toBeInTheDocument();
    for (const section of about.intro) {
      expect(screen.getByText((_, el) => el?.tagName === "P" && !el.hasAttribute("data-written") && el.textContent === section.label)).toBeInTheDocument();
      for (const line of section.lines) expect(paragraph(line).tagName).toBe("P");
    }
    for (const p of about.principles) {
      expect(screen.getByRole("heading", { name: p.claim, level: 3 })).toBeInTheDocument();
      for (const line of p.lines) expect(paragraph(line)).toBeInTheDocument();
    }
  });

  it("keeps every paragraph short, so it reads as a beat and not a wall", () => {
    const lines = [...about.intro.flatMap((s) => s.lines), ...about.principles.flatMap((p) => p.lines)];
    for (const line of lines) {
      expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(45);
    }
  });

  it("draws a different figure for each principle, out of the accessibility tree", () => {
    render(<Approach />);
    const names = about.principles.map((p) => {
      const svg = principleFor(p.claim).querySelector("svg");
      expect(svg, p.claim).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      /* Every mark is on the clock and normalised to one unit long. */
      const marks = svg?.querySelectorAll("[data-step]") ?? [];
      expect(marks.length).toBeGreaterThan(3);
      for (const m of marks) expect(m.getAttribute("pathLength")).toBe("1");
      return svg?.getAttribute("data-figure");
    });
    expect(new Set(names).size).toBe(about.principles.length);
  });

  it("draws no figure for a claim nobody drew one for", async () => {
    vi.resetModules();
    vi.doMock("@/data/site", () => ({
      about: {
        heading: "How I work",
        intro: [{ label: "Now", lines: ["One line of voice."] }],
        principles: [{ claim: "A claim nobody drew", lines: ["Its line."] }],
      },
    }));
    const { default: Fresh } = await import("@/components/Approach");
    render(<Fresh />);
    expect(principleFor("A claim nobody drew").querySelector("svg")).toBeNull();
  });

  it("runs one line behind the section, swinging between the sections and looping round each figure", () => {
    const { container } = render(<Approach />);
    const line = container.querySelectorAll("[data-living-line]");
    expect(line).toHaveLength(1);
    expect(line[0].querySelectorAll(":scope > svg path")).toHaveLength(1);
    const sides = [...container.querySelectorAll<HTMLElement>("[data-line='start'], [data-line='end']")].map((el) => el.dataset.line);
    /* The head, then each short section on the other side from the last. */
    expect(sides).toHaveLength(about.intro.length + 1);
    sides.forEach((s, i) => i && expect(s).not.toBe(sides[i - 1]));
    for (const p of about.principles) {
      const item = principleFor(p.claim);
      expect(item).toHaveAttribute("data-line-hold");
      expect(item.querySelector("[data-line='loop'] svg[data-figure]")).not.toBeNull();
    }
  });

  it("calls the role a technical team lead and names no employer", () => {
    const { container } = render(<Approach />);
    const text = container.textContent ?? "";
    expect(text).toContain("Technical team lead");
    expect(text).toContain("technical team lead");
    expect(text).not.toMatch(/Technical lead\b/);
  });

  it("scrubs every stroke by scroll and nothing by time", () => {
    expect(css).toMatch(/animation-timeline:\s*--approach-fig/);
    expect(css).not.toMatch(/animation-duration|animation-delay|transition/);
    expect(css).not.toMatch(/\d+ms/);
  });

  it("lands all three off-switches, and print, on the drawn figure", () => {
    const exits = [
      /@supports not \(animation-timeline: view\(\)\)\s*\{\s*\.figure \[data-step\]\s*\{([^}]*)\}/,
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.figure \[data-step\]\s*\{([^}]*)\}/,
      /:global\(body\.motion-paused\) \.figure \[data-step\]\s*\{([^}]*)\}/,
      /@media print\s*\{\s*\.figure \[data-step\]\s*\{([^}]*)\}/,
    ];
    for (const exit of exits) {
      const body = css.match(exit)?.[1] ?? "";
      expect(body, String(exit)).toMatch(/animation:\s*none/);
      expect(body).toMatch(/stroke-dashoffset:\s*0/);
      expect(body).toMatch(/stroke-opacity:\s*1/);
    }
  });
});
