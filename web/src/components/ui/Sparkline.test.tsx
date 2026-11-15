import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkline, sparkPath } from "@/components/ui/Sparkline";

describe("sparkPath", () => {
  it("draws nothing for fewer than two points (never a trend from one number)", () => {
    expect(sparkPath([], 100, 20)).toBe("");
    expect(sparkPath([5], 100, 20)).toBe("");
  });
  it("puts the first point at the left and the last at the right, the maximum on top", () => {
    const d = sparkPath([0, 10], 100, 20, 0);
    expect(d).toBe("M0,20 L100,0");
  });
  it("draws a flat series as a line in the middle, never NaN", () => {
    const d = sparkPath([3, 3, 3], 100, 20, 0);
    expect(d).not.toContain("NaN");
    expect(d).toBe("M0,10 L50,10 L100,10");
  });
  it("ignores non-finite values", () => {
    expect(sparkPath([1, Number.NaN, 2], 100, 20, 0)).not.toContain("NaN");
  });
});

describe("Sparkline", () => {
  it("is one named image", () => {
    render(<Sparkline values={[1, 2, 4]} label="Posts per week: 1, 2, 4" />);
    expect(screen.getByRole("img", { name: "Posts per week: 1, 2, 4" })).toBeTruthy();
  });
  it("renders nothing when there is nothing to draw", () => {
    const { container } = render(<Sparkline values={[7]} label="x" />);
    expect(container.querySelector("svg")).toBeNull();
  });
  it("does not mirror in a right-to-left page: time runs left to right", () => {
    document.documentElement.setAttribute("dir", "rtl");
    const { container } = render(<Sparkline values={[1, 2]} label="x" />);
    expect(container.querySelector("svg")!.getAttribute("direction")).toBe("ltr");
    document.documentElement.removeAttribute("dir");
  });
});
