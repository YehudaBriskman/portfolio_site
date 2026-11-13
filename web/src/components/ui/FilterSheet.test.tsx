import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { defs } from "@/components/ui/filters.fixtures";
import type { FilterDef, Filters } from "@/components/ui/filters";

/* jsdom has no <dialog>.showModal: stood in for, as BottomSheet.test.tsx does. */
beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});

afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.lang = "en";
  vi.restoreAllMocks();
});

/** The list behind the sheet: 40 rows, narrowed by whatever is in the draft. */
const count = (d: Filters) => 40 - (d.status ? 10 : 0) - ((d.group as string[] | undefined)?.length ?? 0) * 3;

function setup(value: Filters = {}, over: Partial<Parameters<typeof FilterSheet>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const utils = render(<FilterSheet open defs={defs} value={value} onApply={onApply} onClose={onClose} resultCount={count} {...over} />);
  return { onApply, onClose, ...utils };
}

describe("FilterSheet", () => {
  it("is a sheet titled Filters with every kind of selector", () => {
    setup();
    expect(screen.getByRole("dialog", { hidden: true, name: "Filters" })).toBeTruthy();
    const status = screen.getByRole("radiogroup", { name: "Status" });
    expect(within(status).getAllByRole("radio").map((r) => r.parentElement?.textContent)).toEqual(["All", "Active", "Pending", "Bounced"]);
    expect(within(screen.getByRole("group", { name: "Group" })).getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByLabelText("From")).toHaveProperty("type", "date");
    expect(screen.getByLabelText("To")).toHaveProperty("type", "date");
    expect(screen.getByRole("radiogroup", { name: "Sort by" })).toBeTruthy();
  });

  it("orders the sections segmented, multi-select, date range, sort", () => {
    setup();
    const labels = [...document.querySelectorAll("[data-filter-section]")].map((s) => s.getAttribute("data-filter-section"));
    expect(labels).toEqual(["status", "lang", "group", "created", "sort"]);
  });

  it("applies nothing until Show is pressed, then hands over the whole draft and closes", () => {
    const { onApply, onClose } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Pending" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Beta/ }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show 27 results" }));
    expect(onApply).toHaveBeenCalledWith({ status: "pending", group: ["b"] });
    expect(onClose).toHaveBeenCalled();
  });

  it("updates the result count live as the draft changes, in a status region", () => {
    setup();
    expect(screen.getByRole("button", { name: "Show 40 results" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    expect(screen.getByRole("button", { name: "Show 30 results" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("30 results");
  });

  it("says result in the singular", () => {
    setup({}, { resultCount: 1 });
    expect(screen.getByRole("button", { name: "Show 1 result" })).toBeTruthy();
  });

  it("falls back to a plain Show results without a count", () => {
    setup({}, { resultCount: undefined });
    expect(screen.getByRole("button", { name: "Show results" })).toBeTruthy();
  });

  it("starts from the applied value", () => {
    setup({ status: "bounced", group: ["a", "c"] });
    expect((screen.getByRole("radio", { name: "Bounced" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Alpha/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Beta/ }) as HTMLInputElement).checked).toBe(false);
  });

  it("Reset clears the draft, not the list, until Show is pressed", () => {
    const { onApply } = setup({ status: "bounced", group: ["a"], sort: "name" });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onApply).not.toHaveBeenCalled();
    expect((screen.getByRole("radio", { name: "Pending" }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith({});
  });

  it("discards the draft on Close and on Escape", () => {
    const { onApply, onClose } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Pending" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(document.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("starts the draft over from the applied value each time it opens", () => {
    const onApply = vi.fn();
    const props = { defs, onApply, onClose: vi.fn(), resultCount: count };
    const { rerender } = render(<FilterSheet open value={{}} {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Pending" }));
    rerender(<FilterSheet open={false} value={{}} {...props} />);
    rerender(<FilterSheet open value={{}} {...props} />);
    expect((screen.getByRole("radio", { name: "Pending" }) as HTMLInputElement).checked).toBe(false);
  });

  it("takes a sort as a choice among its options, the first being the default", () => {
    const { onApply } = setup();
    expect((screen.getByRole("radio", { name: "Newest" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Name" }));
    fireEvent.click(screen.getByRole("button", { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith({ sort: "name" });
  });

  it("fills a date range from a preset", () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-11-07");
    fireEvent.click(screen.getByRole("button", { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith({ created: { from: "2026-11-07", to: "2026-11-14" } });
  });

  it("rejects a range that ends before it starts: a message, and Show is off", () => {
    const { onApply } = setup();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-02-01" } });
    expect(screen.getByRole("alert").textContent).toBe("The start date is after the end date.");
    expect(screen.getByLabelText("From").getAttribute("aria-invalid")).toBe("true");
    const show = screen.getByRole("button", { name: /^Show/ }) as HTMLButtonElement;
    expect(show.disabled).toBe(true);
    fireEvent.click(show);
    expect(onApply).not.toHaveBeenCalled();
  });

  describe("a long multi-select list", () => {
    const many: FilterDef[] = [
      { id: "tag", kind: "multi", label: "Tag", options: Array.from({ length: 9 }, (_, i) => ({ value: `t${i}`, label: `Tag ${i}` })) },
    ];
    const open = () => render(<FilterSheet open defs={many} value={{}} onApply={vi.fn()} onClose={vi.fn()} />);

    it("gets a search field above eight options", () => {
      open();
      expect(screen.getByRole("searchbox", { name: "Search options" })).toBeTruthy();
    });

    it("gets none at eight options or fewer", () => {
      setup();
      expect(screen.queryAllByRole("searchbox")).toHaveLength(0);
    });

    it("narrows the list as you type and selects all or none of what is shown", () => {
      const onApply = vi.fn();
      render(<FilterSheet open defs={many} value={{}} onApply={onApply} onClose={vi.fn()} />);
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Tag 1" } });
      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "Select all" }));
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
      expect(screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked)).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "Select all" }));
      expect(screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked)).toHaveLength(9);
      fireEvent.click(screen.getByRole("button", { name: "Select none" }));
      fireEvent.click(screen.getByRole("button", { name: /^Show/ }));
      expect(onApply).toHaveBeenCalledWith({});
    });
  });

  it("speaks Hebrew on a Hebrew page", () => {
    document.documentElement.lang = "he";
    setup();
    expect(screen.getByRole("dialog", { hidden: true, name: "סינון" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "הצגת 40 תוצאות" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "איפוס" })).toBeTruthy();
    expect(screen.getByLabelText("מתאריך")).toBeTruthy();
  });
});

describe("FilterSheet stylesheet", () => {
  const css = readCss(resolve(__dirname, "FilterSheet.module.css"));
  it("gives every row, pill and button a 44px target and 16px fields", () => {
    expect(css).toMatch(/\.check[^{]*\{[^}]*min-block-size:\s*2\.75rem/);
    expect(css).toMatch(/\.pill[^{]*\{[^}]*min-block-size:\s*2\.75rem/);
    expect(css).toMatch(/font-size:\s*1rem/);
  });
  it("uses logical properties and tabular figures", () => {
    expect(css).toMatch(/tabular-nums/);
    expect(css).not.toMatch(/(margin|padding)-(left|right)|\b(left|right):/);
  });
  it("moves nothing for a reader who asked for reduced motion", () => {
    expect(outsideNoPreference(css)).not.toMatch(/transition|animation/);
  });
});
