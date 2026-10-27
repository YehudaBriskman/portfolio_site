import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import InkRule from "@/components/motion/InkRule";

/*
 * A rule is decoration with one accessibility obligation — to stay out of the
 * way — and one rendering obligation: the two attributes that let a single
 * path work at 40px and at 1072px. Both are the kind of thing a refactor
 * removes without noticing, so both are pinned here.
 */
describe("InkRule", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<InkRule />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });

  it("stretches its geometry without stretching its ink", () => {
    const { container } = render(<InkRule className="flex-1" />);
    const svg = container.querySelector("svg");
    const path = container.querySelector("path");

    /* Without `preserveAspectRatio="none"` the path would not fill the box;
       without `non-scaling-stroke` the weight of the line would change with
       the width of the box — measured at 0.8px on a 40px tick and 4px on a
       1072px footer rule. */
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("none");
    expect(path?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(svg?.getAttribute("class")).toContain("flex-1");
  });
});
