import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InkWipe from "@/components/motion/InkWipe";

/*
 * The stroke itself is a view-timeline animation in the stylesheet and jsdom
 * has no timelines, so there is nothing here to assert about the motion. What
 * is left is everything the component actually decides: which element the
 * content ends up in, whether the content survives being wrapped, and whether
 * the direction reaches the stylesheet as a second class rather than silently
 * doing nothing.
 */
describe("InkWipe", () => {
  it("wraps its children in the element it was asked for", () => {
    const { container } = render(
      <InkWipe as="article">
        <p>A check that cannot fail is not a check</p>
      </InkWipe>
    );

    expect(container.firstElementChild?.tagName).toBe("ARTICLE");
    expect(screen.getByText("A check that cannot fail is not a check")).toBeInTheDocument();
  });

  it("defaults to a div and keeps any class it is handed", () => {
    const { container } = render(<InkWipe className="max-w-3xl">Ink</InkWipe>);
    const el = container.firstElementChild;

    expect(el?.tagName).toBe("DIV");
    expect(el?.className).toContain("max-w-3xl");
  });

  it("carries one class upward and two sideways", () => {
    const up = render(<InkWipe>up</InkWipe>).container.firstElementChild;
    const right = render(<InkWipe direction="right">right</InkWipe>).container.firstElementChild;

    /* The sideways stroke is the upward one plus a modifier, not a different
       effect — so the base class has to still be there or the fallbacks,
       which are all written against it, stop applying. */
    const base = up?.className.trim() ?? "";
    expect(base).not.toBe("");
    expect(right?.className).toContain(base.split(" ")[0]);
    expect(right?.className.split(" ").filter(Boolean).length).toBeGreaterThan(
      base.split(" ").filter(Boolean).length
    );
  });
});
