import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SpecPlate from "@/components/Stack";
import { specFigures } from "@/data/specs";

/*
 * The figures themselves are checked in `data/__tests__/specs.test.ts`, where
 * each one is re-derived a second way. What is left here is the plate's own
 * two promises, and both of them fail quietly.
 *
 * The first is that the number a screen reader gets is the final figure and
 * not whatever the counter happens to be showing. The visible digits are drawn
 * by a CSS counter on a pseudo-element, which jsdom does not render at all —
 * so if the true value were ever removed from the DOM in favour of the
 * generated content, this page would go silent for assistive technology and
 * look perfectly fine in a browser.
 *
 * The second is that nothing is typed into the markup. The plate renders
 * whatever `specFigures` derived, in that order, and a figure added by hand to
 * the component would show up here as a cell the data did not ask for.
 */

const SOURCE = readFileSync(resolve(process.cwd(), "src/components/Stack.module.css"), "utf8");
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the spec plate", () => {
  it("prints exactly the figures the data derived, as a name-value list", () => {
    render(<SpecPlate />);

    const captions = screen.getAllByRole("term").map((dt) => dt.textContent);
    expect(captions).toEqual(specFigures.map((f) => f.caption));

    /* The value a reader of either kind gets. The `sr-only` number is the
       same integer the counter interpolates towards, so the two cannot drift:
       both read `--spec-to`. */
    /* Read the way assistive technology reads it: everything in the cell
       that is not hidden from the accessibility tree. The visible digits and
       the visible unit are both `aria-hidden`, so what is left is the one
       string that has to be the final figure. */
    const spoken = screen.getAllByRole("definition").map((dd) =>
      Array.from(dd.children)
        .filter((child) => child.getAttribute("aria-hidden") !== "true")
        .map((child) => child.textContent?.replace(/\s+/g, " ").trim())
        .join(" ")
    );
    expect(spoken).toEqual(
      specFigures.map((f) => (f.unit ? `${f.value} ${f.unit}` : String(f.value)))
    );
  });

  it("rests on the true figures, which is what every off-switch shows", () => {
    /* jsdom runs no animation, so what it renders is the resting state —
       which has to be the true figures and not four noughts, because that
       state is also what a browser without view timelines, a paused page and
       a reduced-motion reader all land on. */
    render(<SpecPlate />);
    expect(screen.getByText(String(specFigures[0].value))).toBeInTheDocument();
  });

  it("counts on the reader's scroll, both ways, and on no clock (#162)", () => {
    /* The owner's rule: reverse when scrolling up, all controllable with
       simple scrolling. A view timeline counts down on the way back up,
       which is now the point rather than the objection. */
    expect(CSS).toMatch(/view-timeline:\s*--specs/);
    expect(CSS).toMatch(/animation-timeline:\s*--specs/);
    expect(CSS).not.toMatch(/animation-duration/);
    expect(CSS).not.toMatch(/data-counting/);
    /* Declared only inside the three-condition gate, so every off-switch is
       the resting value by construction. */
    expect(CSS).toMatch(/@supports \(animation-timeline: view\(\)\)/);
    expect(CSS).toMatch(/prefers-reduced-motion: no-preference/);
    expect(CSS).toMatch(/body:not\(\.motion-paused\)/);
  });

  it("registers the properties it interpolates, and rests on the true value", () => {
    /* An unregistered custom property animates discretely: the figure would
       flip from 0 to its value half way through and never count. */
    expect(CSS).toContain("@property --spec-n");
    expect(CSS).toContain('syntax: "<integer>"');
    /* The resting declaration is the truth, so an engine that cannot
       interpolate shows the figure rather than a nought. */
    expect(CSS).toContain("--spec-n: var(--spec-to)");
    expect(CSS).toContain("font-variant-numeric: tabular-nums");
  });
});
