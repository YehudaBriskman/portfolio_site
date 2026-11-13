import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { MiniBar, segmentWidths } from "@/components/ui/MiniBar";

const css = readCss(resolve(__dirname, "MiniBar.module.css"));
afterEach(() => {
  document.documentElement.lang = "en";
});

describe("segmentWidths", () => {
  it("sums to 100 when the parts fill the total", () => {
    expect(segmentWidths([120, 3, 17], 140).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });
  it("leaves the rest empty when the parts are under the total", () => {
    expect(segmentWidths([25, 25], 100)).toEqual([25, 25]);
  });
  it("scales down when the parts exceed the total", () => {
    expect(segmentWidths([80, 80], 100).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });
  it("is never NaN for a zero, negative or NaN total", () => {
    for (const total of [0, -5, Number.NaN]) {
      expect(segmentWidths([1, 2], total).every((n) => n === 0)).toBe(true);
    }
  });
});

describe("MiniBar", () => {
  it("is one image with the given text as its name", () => {
    render(<MiniBar parts={[{ value: 120, tone: "ok", label: "sent" }]} total={140} label="120 of 140 sent" />);
    expect(screen.getByRole("img", { name: "120 of 140 sent" })).toBeTruthy();
  });

  it("builds a name from value and max when none is given, in both languages", () => {
    const { rerender } = render(<MiniBar value={3} max={10} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("3 of 10");
    document.documentElement.lang = "he";
    rerender(<MiniBar value={3} max={10} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("3 מתוך 10");
  });

  it("renders an empty track and no NaN for a zero total", () => {
    const { container } = render(<MiniBar value={0} max={0} />);
    expect(container.innerHTML).not.toMatch(/NaN/);
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(0);
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("draws one segment per part with its share of the total", () => {
    const { container } = render(
      <MiniBar parts={[{ value: 120, tone: "ok" }, { value: 3, tone: "danger" }, { value: 8, tone: "muted" }]} total={140} label="x" />,
    );
    const widths = [...container.querySelectorAll<HTMLElement>("[data-segment]")].map((s) => parseFloat(s.style.inlineSize));
    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(93.571, 2);
  });

  it("gives danger a pattern so colour is not alone", () => {
    const { container } = render(<MiniBar parts={[{ value: 1, tone: "danger" }]} total={2} label="x" />);
    expect(container.querySelector('[data-segment][data-tone="danger"]')).toBeTruthy();
    expect(css).toMatch(/\[data-tone="danger"\][^{]*\{[^}]*repeating-linear-gradient/);
  });

  it("shows a tabular, left-to-right number only on request", () => {
    const { container, rerender } = render(<MiniBar value={3} max={10} />);
    expect(container.querySelector("[data-number]")).toBeNull();
    rerender(<MiniBar value={3} max={10} showNumber />);
    const n = container.querySelector("[data-number]")!;
    expect(n.getAttribute("dir")).toBe("ltr");
    expect(n.textContent).toBe("3/10");
    expect(css).toMatch(/tabular-nums/);
  });

  it("does not animate outside no-preference, and uses logical properties", () => {
    const outside = outsideNoPreference(css);
    expect(outside).not.toMatch(/\b(transition|animation)\s*:/);
    expect(css).not.toMatch(/animation-timeline|animation-delay|animation-play-state/);
    expect(css).not.toMatch(/(^|[\s;{])(left|right|margin-left|margin-right)\s*:/);
  });
});
