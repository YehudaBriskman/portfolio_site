import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Disclosure, DisclosureButton } from "@/components/ui/Disclosure";

const css = readFileSync(resolve(__dirname, "Disclosure.module.css"), "utf8");

describe("Disclosure", () => {
  it("puts an aria-hidden svg chevron first in the summary", () => {
    const { container } = render(<Disclosure summary="Advanced">body</Disclosure>);
    const summary = container.querySelector("summary")!;
    const first = summary.firstElementChild!;
    expect(first.tagName.toLowerCase()).toBe("svg");
    expect(first.getAttribute("aria-hidden")).toBe("true");
    expect(summary.textContent).toContain("Advanced");
  });

  it("renders the meta slot and reports open state changes", () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Disclosure summary="S" meta={<span>unsaved</span>} onOpenChange={onOpenChange} testid="d">
        body
      </Disclosure>,
    );
    expect(screen.getByText("unsaved")).toBeTruthy();
    const details = container.querySelector("details")!;
    expect(details.getAttribute("data-testid")).toBe("d");
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("honours the controlled open prop", () => {
    const { container, rerender } = render(<Disclosure summary="S" open>b</Disclosure>);
    expect(container.querySelector("details")!.open).toBe(true);
    rerender(<Disclosure summary="S" open={false}>b</Disclosure>);
    expect(container.querySelector("details")!.open).toBe(false);
  });
});

describe("DisclosureButton", () => {
  it("flips aria-expanded and aria-controls resolves", () => {
    const onToggle = vi.fn();
    render(
      <>
        <DisclosureButton expanded={false} controls="panel-1" onToggle={onToggle}>More</DisclosureButton>
        <div id="panel-1" />
      </>,
    );
    const btn = screen.getByRole("button", { name: "More" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(btn.getAttribute("aria-controls")!)).toBeTruthy();
    expect(btn.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects expanded=true", () => {
    render(<DisclosureButton expanded controls="x" onToggle={() => {}}>L</DisclosureButton>);
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Disclosure.module.css", () => {
  it("has a :dir(rtl) chevron rule", () => {
    expect(css).toMatch(/:dir\(rtl\)/);
  });

  it("keeps every transition inside prefers-reduced-motion: no-preference", () => {
    const marker = "@media (prefers-reduced-motion: no-preference)";
    const outside = css.split(marker)[0];
    expect(css).toContain(marker);
    expect(outside).not.toMatch(/transition/);
    expect(css).toMatch(/transition/);
  });

  it("gives the summary and button a 44px minimum height and 14px+ text", () => {
    expect(css).toMatch(/min-block-size:\s*2\.75rem/);
    expect(css).not.toMatch(/font-size:\s*(0?\.(?:[0-7]\d*|8[0-6]\d*)rem|1[0-3]px)/);
  });

  it("uses no physical left/right properties", () => {
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:/m);
  });
});
