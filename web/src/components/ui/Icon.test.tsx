import { render } from "@testing-library/react";
import { Mail } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Icon, STROKE_FOR_SIZE, iconOf } from "@/components/ui/Icon";

const svg = (c: HTMLElement) => c.querySelector("svg")!;

describe("Icon wrapper", () => {
  it.each([
    [16, "2"],
    [20, "1.75"],
    [24, "1.5"],
  ] as const)("size %i draws a %s stroke", (size, stroke) => {
    const { container } = render(<Icon icon={Mail} size={size} />);
    expect(svg(container).getAttribute("stroke-width")).toBe(stroke);
    expect(svg(container).getAttribute("width")).toBe(String(size));
    expect(STROKE_FOR_SIZE[size]).toBe(Number(stroke));
  });

  it("defaults to 20 and is aria-hidden", () => {
    const { container } = render(<Icon icon={Mail} />);
    expect(svg(container).getAttribute("width")).toBe("20");
    expect(svg(container).getAttribute("aria-hidden")).toBe("true");
  });

  it("is exposed when given a label", () => {
    const { container } = render(<Icon icon={Mail} aria-label="Mail" />);
    expect(svg(container).getAttribute("aria-hidden")).toBeNull();
  });

  it("mirrorInRtl marks the svg so it flips in a right-to-left page", () => {
    const { container } = render(<Icon icon={Mail} mirrorInRtl />);
    expect(svg(container).getAttribute("data-mirror-rtl")).toBe("true");
    const plain = render(<Icon icon={Mail} />);
    expect(svg(plain.container).getAttribute("data-mirror-rtl")).toBeNull();
  });

  it("iconOf makes a component usable where a lucide icon is expected", () => {
    const Wrapped = iconOf(Mail);
    const { container } = render(<Wrapped />);
    expect(svg(container).getAttribute("stroke-width")).toBe("1.75");
  });
});
