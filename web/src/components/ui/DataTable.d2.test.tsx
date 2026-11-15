import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/RowActions";
import { FilterBar } from "@/components/ui/FilterBar";
import { MemoryRouter } from "react-router-dom";
import { readPrefs } from "@/components/ui/useTablePrefs";

/* D2 (#860): tiers, toolbar, columns, customise actions, folding groups, saved views. */

const css = readCss(resolve(__dirname, "DataTable.module.css"));
const Glyph = ({ className }: { className?: string }) => <svg className={className} />;

type Row = { id: string; title: string; status: "published" | "draft"; views: number };
const rows: Row[] = [
  { id: "a", title: "Alpha note", status: "published", views: 1200 },
  { id: "b", title: "Bravo note", status: "draft", views: 30 },
  { id: "c", title: "Charlie note", status: "published", views: 450 },
];
const words: DataTableWords = { selectAll: "Select all", selectRow: (t) => `Select ${t}`, actions: "Actions", loading: "Loading", bulkLabel: "Bulk", count: (n) => `${n} selected`, cancel: "Cancel", more: "More" };
const columns: Column<Row>[] = [
  { id: "title", header: "Title", cell: (r) => r.title, primary: true },
  { id: "status", header: "Status", cell: (r) => r.status },
  { id: "views", header: "Views", cell: (r) => r.views, align: "num" },
];
const base = { label: "Posts", rows, columns, rowKey: (r: Row) => r.id, words, rowLabel: (r: Row) => r.title, tableId: "d2" };
const act = (id: string, label: string, tone?: "danger") => ({ id, icon: Glyph, label, onSelect: vi.fn(), tone });
const rowActions = (r: Row) => (
  <RowActions label={`Actions for ${r.title}`} moreLabel="More" primary={act("edit", "Edit")} actions={[act("dup", "Duplicate"), act("pub", "Publish"), act("share", "Share"), act("del", "Delete", "danger")]} />
);

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  vi.unstubAllGlobals();
});

describe("row tiers", () => {
  it("has three tiers, 28 / 36 / 44, and the header row matches", () => {
    for (const [t, px] of [["compact", 28], ["cozy", 36], ["comfy", 44]] as const) expect(css).toMatch(new RegExp(`data-tier="${t}"\\][^}]*--row-h:\\s*${px}px`));
    expect(css).toMatch(/\.table td,\s*\.table th\s*\{[^}]*block-size:\s*var\(--row-h\)/);
  });

  it("the switch is three pressed-state buttons; choosing one sets the tier and saves it for this table only", async () => {
    const { container } = render(<DataTable {...base} />);
    const group = screen.getByRole("group", { name: "Row height" });
    expect(within(group).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Compact", "Cozy", "Comfy"]);
    await userEvent.click(within(group).getByRole("button", { name: "Compact" }));
    expect(container.querySelector('[data-tier="compact"]')).toBeTruthy();
    expect(within(group).getByRole("button", { name: "Compact" })).toHaveAttribute("aria-pressed", "true");
    expect(readPrefs("d2").density).toBe("compact");
    expect(readPrefs("other").density).toBeNull();
  });

  it("a saved tier is restored on the next visit", () => {
    window.localStorage.setItem("a-table:d2", JSON.stringify({ density: "comfy", pinned: null, hidden: [] }));
    const { container } = render(<DataTable {...base} />);
    expect(container.querySelector('[data-tier="comfy"]')).toBeTruthy();
  });

  it("derives its id from the route and the label when none is given, so an old screen gets the switch with no edit", async () => {
    const { tableId: _drop, ...bare } = base;
    void _drop;
    render(<DataTable {...bare} />);
    await userEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(Object.keys(window.localStorage).some((k) => k.startsWith("a-table:") && k.endsWith(":posts"))).toBe(true);
  });

  it("text never drops under 12px and the title clamps to one line only when compact", () => {
    expect(css).toMatch(/font-size:\s*max\(0\.75rem/);
    expect(css).not.toMatch(/font-size:\s*(0\.[0-6]\d*|0\.7[0-4]\d*)rem/);
    expect(css).toMatch(/data-tier="compact"\]\s*\.title\s*\{[^}]*line-clamp:\s*1/);
  });

  it("every toolbar control keeps a 24px target (WCAG 2.5.8): 28px icon buttons, 24px group toggles", () => {
    const group = css.match(/\.groupBtn\s*\{[^}]*\}/)?.[0] ?? "";
    expect(group).toMatch(/min-block-size:\s*1\.5rem/);
  });

  it("toolbar={false} leaves the table bare", () => {
    render(<DataTable {...base} toolbar={false} />);
    expect(screen.queryByRole("group", { name: "Row height" })).toBeNull();
  });
});

describe("columns", () => {
  it("offers every column but the identifier; hiding one removes its header and cells and is saved", async () => {
    render(<DataTable {...base} />);
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitemcheckbox").map((m) => m.textContent)).toEqual(["Status", "Views"]);
    await userEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "Views" }));
    expect(screen.queryByRole("columnheader", { name: "Views", hidden: true })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Title", hidden: true })).toBeInTheDocument();
    expect(readPrefs("d2").hidden).toEqual(["views"]);
  });

  it("Show all brings them back", async () => {
    window.localStorage.setItem("a-table:d2", JSON.stringify({ density: null, pinned: null, hidden: ["views", "status"] }));
    render(<DataTable {...base} />);
    expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Columns/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show all" }));
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Views" })).toBeInTheDocument();
  });

  it("a column marked hideable={false} is not offered", async () => {
    render(<DataTable {...base} columns={columns.map((c) => (c.id === "status" ? { ...c, hideable: false } : c))} />);
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitemcheckbox").map((m) => m.textContent)).toEqual(["Views"]);
  });
});

describe("row actions inside the table", () => {
  it("draws two icons per row and the rest in More; a destructive action is never an icon", () => {
    render(<DataTable {...base} rowActions={rowActions} />);
    const row = screen.getAllByRole("row").find((r) => r.hasAttribute("data-row"))!;
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Edit", "Duplicate", "More"]);
  });

  it("Customise actions lists the pinnable ones, lets the person pin up to four, and saves it", async () => {
    render(<DataTable {...base} rowActions={rowActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Customise actions" }));
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.map((b) => b.closest("label")?.textContent)).toEqual(["Edit", "Duplicate", "Publish", "Share"]);
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true, false, false]);
    await userEvent.click(boxes[2]);
    await userEvent.click(boxes[3]);
    expect(readPrefs("d2").pinned).toEqual(["edit", "dup", "pub", "share"]);
    const row = screen.getAllByRole("row").find((r) => r.hasAttribute("data-row"))!;
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Edit", "Duplicate", "Publish", "Share", "More"]);
  });

  it("a fifth cannot be pinned: once four are, the rest are disabled", async () => {
    window.localStorage.setItem("a-table:d2", JSON.stringify({ density: null, pinned: ["edit", "dup", "pub", "share"], hidden: [] }));
    const five = (r: Row) => (
      <RowActions label={`Actions for ${r.title}`} moreLabel="More" primary={act("edit", "Edit")} actions={[act("dup", "Duplicate"), act("pub", "Publish"), act("share", "Share"), act("tag", "Tag")]} />
    );
    render(<DataTable {...base} rowActions={five} />);
    await userEvent.click(screen.getByRole("button", { name: "Customise actions" }));
    const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
    expect(boxes.map((b) => b.disabled)).toEqual([false, false, false, false, true]);
  });

  it("row actions are off in select mode", () => {
    const selection = { on: true, has: () => false, toggle: vi.fn(), enter: vi.fn(), exit: vi.fn(), all: vi.fn(), none: vi.fn(), count: 0, allSelected: false, ids: [] as string[] };
    render(<DataTable {...base} rowActions={rowActions} selection={selection} />);
    expect(screen.getAllByRole("toolbar", { name: /Actions for/, hidden: true })[0].closest("[inert]")).not.toBeNull();
  });
});

describe("groups", () => {
  const grouped = { ...base, groupBy: (r: Row) => r.status, groupLabel: (k: string, l: Row[]) => `${k} ${l.length}`, groupAggregate: (_k: string, l: Row[]) => `${l.reduce((n, r) => n + r.views, 0)} views` };

  it("a header is a button with aria-expanded, a count in its label and one aggregate", () => {
    render(<DataTable {...grouped} />);
    const head = screen.getByRole("button", { name: "published 2" });
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1650 views")).toBeInTheDocument();
  });

  it("folding hides that group's rows only, keeps the header and the aggregate, and unfolds again", async () => {
    render(<DataTable {...grouped} />);
    const rowsNow = () => screen.getAllByRole("row").filter((r) => r.hasAttribute("data-row")).length;
    expect(rowsNow()).toBe(3);
    await userEvent.click(screen.getByRole("button", { name: "published 2" }));
    expect(rowsNow()).toBe(1);
    expect(screen.getByRole("button", { name: "published 2" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1650 views")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "published 2" }));
    expect(rowsNow()).toBe(3);
  });

  it("the table keeps one tab stop when the group holding it folds", async () => {
    render(<DataTable {...grouped} rows={[rows[1], rows[0]]} />);
    await userEvent.click(screen.getByRole("button", { name: "draft 1" }));
    const stops = screen.getAllByRole("row").filter((r) => r.hasAttribute("data-row") && r.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it("the chevron turns by transform only inside no-preference, and points the other way in RTL", () => {
    expect(outsideNoPreference(css)).not.toMatch(/\b(transition|animation)\s*:/);
    expect(css).toMatch(/\[dir="rtl"\]\s*\.groupBtn\[aria-expanded="false"\]\s*\.chev/);
  });
});

describe("a field inside a row", () => {
  it("owns its arrow keys: the grid does not steal them", async () => {
    render(
      <DataTable
        {...base}
        columns={[columns[0], { id: "status", header: "Status", cell: (r) => <input aria-label={`status ${r.id}`} defaultValue="abc" /> }]}
      />,
    );
    const field = screen.getByLabelText("status a") as HTMLInputElement;
    field.focus();
    const ev = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    field.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe("saved views on the FilterBar", () => {
  const props = { defs: [], value: {}, onChange: vi.fn(), query: "", onQueryChange: vi.fn(), words: { search: "Search", clearSearch: "Clear", results: (n: number) => `${n}`, clearAll: "Clear all", views: "Views", saveView: "Save view" } };
  it("draws chips with counts, one pressed, and reports the choice", async () => {
    const onViewChange = vi.fn();
    render(
      <MemoryRouter>
        <FilterBar {...props} views={[{ id: "all", label: "All", count: 10 }, { id: "me", label: "Needs me", count: 3 }]} activeView="all" onViewChange={onViewChange} />
      </MemoryRouter>,
    );
    const group = screen.getByRole("group", { name: "Views" });
    expect(within(group).getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(group).getByRole("button", { name: /Needs me/ }));
    expect(onViewChange).toHaveBeenCalledWith("me");
  });

  it("offers Save view only when something is on", () => {
    const onSaveView = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <FilterBar {...props} views={[{ id: "all", label: "All" }]} onSaveView={onSaveView} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Save view" })).toBeNull();
    rerender(
      <MemoryRouter>
        <FilterBar {...props} query="x" views={[{ id: "all", label: "All" }]} onSaveView={onSaveView} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();
  });

  it("draws no chips without views: the bar is unchanged", () => {
    render(
      <MemoryRouter>
        <FilterBar {...props} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("group", { name: "Views" })).toBeNull();
  });
});

describe("Hebrew", () => {
  it("the toolbar speaks Hebrew", async () => {
    document.documentElement.setAttribute("lang", "he");
    document.documentElement.setAttribute("dir", "rtl");
    render(<DataTable {...base} rowActions={rowActions} />);
    expect(screen.getByRole("group", { name: "גובה שורה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עמודות" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "התאמת פעולות" })).toBeInTheDocument();
  });
});
