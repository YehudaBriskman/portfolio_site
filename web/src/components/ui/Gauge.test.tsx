import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { Gauge, gaugeLevel } from "@/components/ui/Gauge";

const css = readCss(resolve(__dirname, "Gauge.module.css"));
afterEach(() => {
  document.documentElement.lang = "en";
});

describe("gaugeLevel", () => {
  it("steps at the 70 and 90 percent thresholds", () => {
    expect(gaugeLevel(69, 100)).toBe("ok");
    expect(gaugeLevel(70, 100)).toBe("warn");
    expect(gaugeLevel(89, 100)).toBe("warn");
    expect(gaugeLevel(90, 100)).toBe("danger");
    expect(gaugeLevel(250, 100)).toBe("danger");
  });
  it("takes custom thresholds and survives a zero max", () => {
    expect(gaugeLevel(50, 100, [0.5, 0.8])).toBe("warn");
    expect(gaugeLevel(5, 0)).toBe("ok");
    expect(gaugeLevel(-3, 100)).toBe("ok");
  });
  it("is exact on a fractional boundary", () => {
    expect(gaugeLevel(0.7 * 300, 300)).toBe("warn");
  });
});

describe("Gauge", () => {
  it("exposes the real value to assistive tech as a meter", () => {
    render(<Gauge value={310} max={500} label="Today: 310 of 500" />);
    const m = screen.getByRole("meter", { name: "Today: 310 of 500" }) as HTMLMeterElement;
    expect(m.value).toBe(310);
    expect(m.max).toBe(500);
    expect(m.getAttribute("aria-valuetext")).toContain("within the limit");
  });

  it("says the level in words in Hebrew too", () => {
    document.documentElement.lang = "he";
    render(<Gauge value={400} max={500} label="היום" />);
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toContain("מתקרב");
  });

  it("keeps the true number when over the limit and never prints NaN", () => {
    const { container } = render(<Gauge value={900} max={500} label="x" />);
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toContain("at or over");
    expect(container.innerHTML).not.toMatch(/NaN/);
    const zero = render(<Gauge value={0} max={0} label="x" />);
    expect(zero.container.innerHTML).not.toMatch(/NaN/);
  });

  it("carries the level in a shape: a different glyph per level, colour never alone", () => {
    const read = (v: number) => {
      const { container, unmount } = render(<Gauge value={v} max={100} label="x" />);
      const out = {
        tone: container.firstElementChild!.getAttribute("data-tone"),
        glyph: container.querySelector("[data-gauge-glyph]")?.getAttribute("data-gauge-glyph"),
      };
      unmount();
      return out;
    };
    const ok = read(10), warn = read(75), danger = read(95);
    expect([ok.tone, warn.tone, danger.tone]).toEqual(["ok", "warn", "danger"]);
    expect(new Set([ok.glyph, warn.glyph, danger.glyph]).size).toBe(3);
  });

  it("shows the level as visible text only when asked", () => {
    const { container, rerender } = render(<Gauge value={95} max={100} label="x" />);
    expect(container.querySelector("[data-gauge-level]")).toBeNull();
    rerender(<Gauge value={95} max={100} label="x" showLevel />);
    expect(container.querySelector("[data-gauge-level]")!.textContent).toBe("at or over the limit");
  });

  it("draws decoration aria-hidden and the centre as real text", () => {
    const { container } = render(<Gauge value={62} max={100} label="x" center={<b>62%</b>} />);
    for (const svg of container.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("62%")).toBeTruthy();
  });

  it("animates only under no-preference and uses no scroll timelines", () => {
    const outside = outsideNoPreference(css);
    expect(outside).not.toMatch(/\b(transition|animation)\s*:/);
    expect(css).not.toMatch(/animation-timeline|animation-delay|animation-play-state/);
  });
});
