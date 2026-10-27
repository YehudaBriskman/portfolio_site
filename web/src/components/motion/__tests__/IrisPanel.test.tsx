import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import IrisPanel from "@/components/motion/IrisPanel";

/*
 * The shutter is entirely declarative, so the only thing left to get wrong is
 * the wrapper: the element it chooses, and whether the content it was given
 * still exists inside it.
 */
describe("IrisPanel", () => {
  it("wraps its children in the element it was asked for", () => {
    const { container } = render(
      <IrisPanel as="figure">
        <img src="/plates/plate-night-800.jpg" alt="Still water" />
      </IrisPanel>
    );

    expect(container.firstElementChild?.tagName).toBe("FIGURE");
    expect(screen.getByAltText("Still water")).toBeInTheDocument();
  });

  it("defaults to a div and keeps any class it is handed", () => {
    const { container } = render(<IrisPanel className="mt-8">Panel</IrisPanel>);
    const panel = container.firstElementChild;

    expect(panel?.tagName).toBe("DIV");
    expect(panel?.className).toContain("mt-8");
  });
});
