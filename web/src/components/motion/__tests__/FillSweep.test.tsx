import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FillSweep from "@/components/motion/FillSweep";

/*
 * The sweep itself is four declarations and a keyframe, so there is nothing
 * here worth asserting about how it looks. What can regress is the part that
 * is this component's actual job: putting the text inside the element the
 * page asked for, so the document outline survives the decoration.
 */
describe("FillSweep", () => {
  it("renders a real heading when asked for one", () => {
    render(<FillSweep as="h1">Field notes</FillSweep>);

    expect(
      screen.getByRole("heading", { level: 1, name: "Field notes" })
    ).toBeInTheDocument();
  });

  it("defaults to an h2 rather than a div", () => {
    const { container } = render(<FillSweep>Field notes</FillSweep>);

    expect(container.firstElementChild?.tagName).toBe("H2");
  });

  it("passes the two inks through as custom properties", () => {
    const { container } = render(
      <FillSweep as="p" on="rgb(220 204 194)" off="rgb(85 98 98)">
        Field notes
      </FillSweep>
    );

    const style = container.firstElementChild?.getAttribute("style") ?? "";
    expect(style).toContain("--sweep-on: rgb(220 204 194)");
    expect(style).toContain("--sweep-off: rgb(85 98 98)");
  });
});
