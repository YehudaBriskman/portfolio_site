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

  it("does not arm the count until the plate has been seen", () => {
    const { container } = render(<SpecPlate />);

    /* `IntersectionObserver` is a no-op stub in this suite, so the plate is
       in its un-entered state — which has to be the true figures and not four
       noughts, because that state is also what a browser without the API, a
       paused page and a reduced-motion reader all land on. */
    expect(container.querySelector("[data-counting]")).toBeNull();
    expect(screen.getByText(String(specFigures[0].value))).toBeInTheDocument();
  });

  it("counts on a clock, which is the one place in this tree that is allowed", () => {
    /* A view timeline would run the count backwards on the way back up the
       page, so the figure would count down to zero every time the plate left
       the screen. "Once, on entry" is an event, and an event needs a clock. */
    expect(CSS).toContain("animation-duration: var(--dur-slow)");
    expect(CSS).not.toMatch(/animation-timeline/);
    /* And no delay, because `fill-mode: both` fills backwards through one —
       a staggered plate would hold noughts on screen for its length, and
       under reduced motion the duration collapses while the delay does not. */
    expect(CSS).not.toMatch(/animation-delay/);
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
