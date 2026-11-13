import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { FilterChips } from "@/components/ui/FilterChips";
import { defs } from "@/components/ui/filters.fixtures";
import type { Filters } from "@/components/ui/filters";

const css = readCss(resolve(__dirname, "FilterChips.module.css"));

afterEach(() => {
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

function setup(value: Filters = {}, extra: Partial<Parameters<typeof FilterChips>[0]> = {}) {
  const onChange = vi.fn();
  const onOpenSheet = vi.fn();
  const utils = render(
    <FilterChips defs={defs} value={value} onChange={onChange} common={["status", "lang"]} onOpenSheet={onOpenSheet} {...extra} />,
  );
  return { onChange, onOpenSheet, ...utils };
}

describe("FilterChips", () => {
  it("is a toolbar of toggle chips, each with aria-pressed", () => {
    setup({ status: "pending" });
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeTruthy();
    const pending = screen.getByRole("button", { name: "Pending" });
    expect(pending.getAttribute("aria-pressed")).toBe("true");
    for (const n of ["Active", "Bounced", "EN", "עב"]) {
      expect(screen.getByRole("button", { name: n }).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("groups each filter's chips under its label", () => {
    setup();
    expect(within(screen.getByRole("group", { name: "Status" })).getAllByRole("button")).toHaveLength(3);
    expect(within(screen.getByRole("group", { name: "Language" })).getAllByRole("button")).toHaveLength(2);
  });

  it("one tap sets a segmented chip, a second tap on it clears it", () => {
    const { onChange, rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "pending" });
    rerender(<FilterChips defs={defs} value={{ status: "pending" }} onChange={onChange} common={["status", "lang"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(onChange).toHaveBeenLastCalledWith({});
    fireEvent.click(screen.getByRole("button", { name: "Bounced" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "bounced" });
  });

  it("toggles a multi chip in and out of its list", () => {
    const multiDefs = defs.filter((d) => d.id === "group");
    const onChange = vi.fn();
    render(<FilterChips defs={multiDefs} value={{ group: ["a"] }} onChange={onChange} common={["group"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenLastCalledWith({ group: ["a", "b"] });
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("shows the count of active filters on the Filters button, a multi counting once", () => {
    setup({ status: "pending", group: ["a", "b"], sort: "name" });
    const btn = screen.getByRole("button", { name: /^Filters/ });
    expect(within(btn).getByText("2")).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBe("Filters, 2 active");
  });

  it("has no badge at zero and opens the sheet on the button", () => {
    const { onOpenSheet } = setup();
    const btn = screen.getByRole("button", { name: "Filters" });
    expect(btn.querySelector("[data-badge]")).toBeNull();
    fireEvent.click(btn);
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it("offers Clear all only while a filter is on, and clears the filters but keeps the sort", () => {
    const { onChange, rerender } = setup();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    rerender(<FilterChips defs={defs} value={{ status: "pending", sort: "name" }} onChange={onChange} common={["status"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenLastCalledWith({ sort: "name" });
  });

  it("shows an active filter that has no chip as a removable chip", () => {
    const { onChange } = setup({ group: ["a", "b"] });
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Group: Alpha, Beta" }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("announces the result count when it is given and a filter is on", () => {
    setup({ status: "pending" }, { resultCount: 12 });
    expect(screen.getByRole("status").textContent).toBe("12 results");
  });

  it("moves between the chips with the arrow keys, one tab stop for the row", () => {
    setup();
    const buttons = within(screen.getByRole("toolbar")).getAllByRole("button");
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: "End" });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    fireEvent.keyDown(buttons[buttons.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("reverses the arrows in a right-to-left page", () => {
    document.documentElement.dir = "rtl";
    setup();
    const buttons = within(screen.getByRole("toolbar")).getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("speaks Hebrew on a Hebrew page", () => {
    document.documentElement.lang = "he";
    setup({ status: "pending" });
    expect(screen.getByRole("toolbar", { name: "מסננים" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ניקוי הכול" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "סינון, 1 פעיל" })).toBeTruthy();
  });
});

describe("FilterChips stylesheet", () => {
  it("makes every chip and button at least 44px high, with 8px gaps", () => {
    expect(css).toMatch(/\.chip[^{]*\{[^}]*min-block-size:\s*2\.75rem/);
    expect(css).toMatch(/\.row[^{]*\{[^}]*gap:\s*(0\.5rem|var\(--a-s-2)/);
  });
  it("scrolls the row sideways, never the page, with an edge fade", () => {
    expect(css).toMatch(/\.row[^{]*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/mask-image:\s*linear-gradient/);
  });
  it("uses tabular figures on the badge and logical properties only", () => {
    expect(css).toMatch(/tabular-nums/);
    expect(css).not.toMatch(/(margin|padding)-(left|right)|\b(left|right):/);
  });
  it("moves nothing for a reader who asked for reduced motion", () => {
    expect(outsideNoPreference(css)).not.toMatch(/transition|animation|scroll-behavior:\s*smooth/);
  });
});
