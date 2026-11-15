import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/* M10 and M8: a pressed action says it is working on the control itself and keeps its box; one press scale everywhere. */

const Glyph = (p: { className?: string; "aria-hidden"?: boolean | "true" }) => <Icon icon={Plus} {...p} />;
const indexCss = readCss(resolve(__dirname, "../../index.css"));
const buttonCss = readCss(resolve(__dirname, "IconButton.module.css"));
const actionCss = readCss(resolve(__dirname, "Action.module.css"));

describe("IconButton busy", () => {
  it("keeps its name, says aria-busy, swallows presses and stays focusable", () => {
    const onClick = vi.fn();
    render(<IconButton icon={Glyph} label="Save" busy onClick={onClick} />);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).not.toBeDisabled();
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    b.focus();
    expect(document.activeElement).toBe(b);
  });

  it("draws a spinner in the glyph's own slot, so the width does not change", () => {
    const { container, rerender } = render(<IconButton icon={Glyph} label="Save" />);
    expect(container.querySelector("[data-spinner]")).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    rerender(<IconButton icon={Glyph} label="Save" busy />);
    expect(container.querySelector("[data-spinner]")).not.toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("is a normal button again when not busy", () => {
    const onClick = vi.fn();
    render(<IconButton icon={Glyph} label="Save" busy={false} onClick={onClick} />);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).not.toHaveAttribute("aria-busy");
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("only turns while motion is allowed", () => {
    expect(outsideNoPreference(buttonCss)).not.toMatch(/animation\s*:(?!\s*none)/);
    expect(buttonCss).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*animation/);
  });
});

describe("one press scale (M8)", () => {
  it("defines --a-press-scale once, in the motion tokens", () => {
    expect(indexCss.match(/--a-press-scale\s*:/g)).toHaveLength(1);
  });
  it("IconButton, Action and .a-btn all press to that token", () => {
    expect(buttonCss).toMatch(/:active[^{]*\{[^}]*scale\(var\(--a-press-scale/);
    expect(actionCss).toMatch(/\.action:active\s*\{[^}]*scale\(var\(--a-press-scale/);
    expect(indexCss).toMatch(/\.a-btn:active[^{]*\{[^}]*scale\(var\(--a-press-scale\)\)/);
    expect(`${buttonCss}${actionCss}`).not.toMatch(/scale\(\s*0?\.9\d\s*\)/);
  });
  it("a desktop pointer gets a tint, not a movement", () => {
    expect(buttonCss).toMatch(/@media \(pointer: coarse\)[^{]*\{[\s\S]*?:active[^{]*\{[^}]*scale\(var\(--a-press-scale/);
  });
});

describe("exit tokens (M2)", () => {
  const take = (name: string) => Number(new RegExp(`${name}\\s*:\\s*(\\d+)ms`).exec(indexCss)?.[1]);
  it("each exit is shorter than its entrance, about 30 percent", () => {
    for (const [enter, exit] of [["--a-dur-fast", "--a-dur-exit-fast"], ["--a-dur-base", "--a-dur-exit-base"], ["--a-dur-sheet", "--a-dur-exit-sheet"]] as const) {
      const e = take(enter);
      const x = take(exit);
      expect(x, exit).toBeLessThan(e);
      expect(x / e, exit).toBeGreaterThan(0.55);
      expect(x / e, exit).toBeLessThan(0.85);
    }
  });
  it("the exit curve is the accelerating one, defined as a token", () => {
    expect(indexCss).toMatch(/--a-ease-exit\s*:\s*var\(--a-ease-in\)/);
  });
});
