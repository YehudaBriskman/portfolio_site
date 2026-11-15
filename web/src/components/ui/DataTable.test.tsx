import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { useSelection } from "@/components/ui/useSelection";

const css = readCss(resolve(__dirname, "DataTable.module.css"));

type Row = { id: string; title: string; status: "published" | "draft"; views: number };
const rows: Row[] = [
  { id: "a", title: "Alpha note", status: "published", views: 1200 },
  { id: "b", title: "Bravo note", status: "draft", views: 30 },
  { id: "c", title: "Charlie note", status: "published", views: 450 },
];
const words: DataTableWords = {
  selectAll: "Select all",
  selectRow: (t) => `Select ${t}`,
  actions: "Actions",
  loading: "Loading",
  bulkLabel: "Bulk actions",
  count: (n) => `${n} selected`,
  cancel: "Cancel",
  more: "More",
};
const columns: Column<Row>[] = [
  { id: "title", header: "Title", cell: (r) => r.title, sort: (a, b) => a.title.localeCompare(b.title), primary: true },
  { id: "status", header: "Status", cell: (r) => r.status },
  { id: "views", header: "Views", cell: (r) => r.views, align: "num", sort: (a, b) => a.views - b.views },
];
const base = { label: "Posts", rows, columns, rowKey: (r: Row) => r.id, words, rowLabel: (r: Row) => r.title };

afterEach(() => {
  document.documentElement.removeAttribute("dir");
  vi.unstubAllGlobals();
});

const dataRows = () => screen.getAllByRole("row").filter((r) => r.hasAttribute("data-row"));
const bodyTitles = () => dataRows().map((r) => within(r).getAllByRole("gridcell")[0]?.textContent);

describe("DataTable", () => {
  it("is a grid with a header row and one row per record", () => {
    render(<DataTable {...base} />);
    const grid = screen.getByRole("grid", { name: "Posts" });
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Title", "Status", "Views"]);
    expect(bodyTitles()).toEqual(["Alpha note", "Bravo note", "Charlie note"]);
  });

  it("right-aligns and tabulates a numeric column, start-aligns text", () => {
    render(<DataTable {...base} />);
    expect(screen.getByRole("columnheader", { name: "Views" }).getAttribute("data-align")).toBe("num");
    expect(screen.getByRole("columnheader", { name: "Title" }).getAttribute("data-align")).toBe("start");
    expect(css).toMatch(/\[data-align=["']?num["']?\][^}]*text-align:\s*right/);
    expect(css).toMatch(/tabular-nums/);
  });

  it("sorts locally: ascending, descending, off; aria-sort on that column only", () => {
    render(<DataTable {...base} />);
    const views = () => screen.getByRole("columnheader", { name: /Views/ });
    fireEvent.click(within(views()).getByRole("button"));
    expect(views().getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("columnheader", { name: "Title" }).getAttribute("aria-sort")).toBeNull();
    expect(bodyTitles()).toEqual(["Bravo note", "Charlie note", "Alpha note"]);
    fireEvent.click(within(views()).getByRole("button"));
    expect(views().getAttribute("aria-sort")).toBe("descending");
    expect(bodyTitles()).toEqual(["Alpha note", "Charlie note", "Bravo note"]);
    fireEvent.click(within(views()).getByRole("button"));
    expect(views().getAttribute("aria-sort")).toBeNull();
    expect(bodyTitles()).toEqual(["Alpha note", "Bravo note", "Charlie note"]);
  });

  it("reports a sort change and leaves the order to the caller when onSortChange is given", () => {
    const onSortChange = vi.fn();
    render(<DataTable {...base} onSortChange={onSortChange} sort={{ id: "title", dir: "asc" }} />);
    expect(bodyTitles()).toEqual(["Alpha note", "Bravo note", "Charlie note"]);
    fireEvent.click(within(screen.getByRole("columnheader", { name: /Title/ })).getByRole("button"));
    expect(onSortChange).toHaveBeenCalledWith({ id: "title", dir: "desc" });
  });

  it("a header with no sort has no button", () => {
    render(<DataTable {...base} />);
    expect(within(screen.getByRole("columnheader", { name: "Status" })).queryByRole("button")).toBeNull();
  });

  it("a row opens on click and on Enter", () => {
    const onOpen = vi.fn();
    render(<DataTable {...base} onOpen={onOpen} />);
    const row = dataRows()[1];
    fireEvent.click(within(row).getByText("Bravo note"));
    expect(onOpen).toHaveBeenLastCalledWith(rows[1]);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("is one tab stop: rows move with the arrows, Home and End", () => {
    render(<DataTable {...base} onOpen={() => {}} />);
    const r = dataRows();
    expect(r.map((x) => x.tabIndex)).toEqual([0, -1, -1]);
    r[0].focus();
    fireEvent.keyDown(r[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(r[1]);
    expect(r.map((x) => x.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(r[1], { key: "End" });
    expect(document.activeElement).toBe(r[2]);
    fireEvent.keyDown(r[2], { key: "ArrowDown" });
    expect(document.activeElement).toBe(r[2]);
    fireEvent.keyDown(r[2], { key: "Home" });
    expect(document.activeElement).toBe(r[0]);
    fireEvent.keyDown(r[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(r[0]);
  });

  it("ArrowRight enters the row's controls, ArrowLeft comes back (mirrored in RTL)", () => {
    const actions = (r: Row) => <button type="button">act-{r.id}</button>;
    const { rerender } = render(<DataTable {...base} rowActions={actions} />);
    const row = dataRows()[0];
    const btn = within(row).getByRole("button", { name: "act-a" });
    expect(btn.tabIndex).toBe(-1);
    row.focus();
    fireEvent.keyDown(row, { key: "ArrowRight" });
    expect(document.activeElement).toBe(btn);
    fireEvent.keyDown(btn, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(row);
    document.documentElement.setAttribute("dir", "rtl");
    rerender(<DataTable {...base} rowActions={actions} />);
    fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(btn);
  });

  it("in select mode Space toggles and a click toggles; nothing opens", () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useSelection(rows.map((r) => r.id)));
    act(() => result.current.enter());
    const { rerender } = render(<DataTable {...base} onOpen={onOpen} selection={result.current} />);
    fireEvent.keyDown(dataRows()[0], { key: " " });
    rerender(<DataTable {...base} onOpen={onOpen} selection={result.current} />);
    expect(result.current.ids).toEqual(["a"]);
    fireEvent.click(within(dataRows()[1]).getByText("Bravo note"));
    expect(result.current.ids).toEqual(["a", "b"]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("checkboxes and the bulk bar appear only in select mode; the bar carries the count and the first action", () => {
    const { result } = renderHook(() => useSelection(rows.map((r) => r.id)));
    const run = vi.fn();
    const bulk = [
      { id: "arch", label: "Archive", onRun: run },
      { id: "del", label: "Delete", onRun: vi.fn(), tone: "danger" as const },
    ];
    const { rerender } = render(<DataTable {...base} selection={result.current} bulkActions={bulk} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull();
    act(() => result.current.enter("b"));
    rerender(<DataTable {...base} selection={result.current} bulkActions={bulk} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: "Select Bravo note" })).toBeChecked();
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("1 selected");
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Bulk actions" })).getByRole("button", { name: "Archive" }));
    expect(run).toHaveBeenCalledWith(["b"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(result.current.count).toBe(3);
  });

  it("row actions are inert in select mode (A12)", () => {
    const { result } = renderHook(() => useSelection(rows.map((r) => r.id)));
    act(() => result.current.enter());
    render(<DataTable {...base} selection={result.current} rowActions={(r) => <button type="button">act-{r.id}</button>} />);
    expect(screen.getByRole("button", { name: "act-a", hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("loading draws a skeleton with the real column headers, not rows", () => {
    render(<DataTable {...base} rows={[]} loading />);
    expect(screen.getByRole("grid").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(document.querySelectorAll("[data-skeleton-row]").length).toBeGreaterThan(2);
  });

  it("empty shows the caller's empty state in place of rows, headers kept", () => {
    render(<DataTable {...base} rows={[]} empty={<p>Nothing yet</p>} />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("error says what failed, offers Retry, and keeps the rows it has", () => {
    const onRetry = vi.fn();
    render(<DataTable {...base} error={{ title: "Could not load posts", retry: "Retry", onRetry }} />);
    expect(screen.getByRole("alert").textContent).toContain("Could not load posts");
    expect(bodyTitles()).toEqual(["Alpha note", "Bravo note", "Charlie note"]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("groups rows under a header so a status is said once, not on every row", () => {
    render(
      <DataTable
        {...base}
        columns={columns.filter((c) => c.id !== "status")}
        groupBy={(r) => r.status}
        groupLabel={(key, list) => `${key} (${list.length})`}
      />,
    );
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["published (2)", "draft (1)"]);
    expect(bodyTitles()).toEqual(["Alpha note", "Charlie note", "Bravo note"]);
  });

  it("the pointer decides the tier in CSS (36 fine, 44 touch); a saved or given tier sets data-tier", () => {
    const { container, rerender } = render(<DataTable {...base} tableId="t-dens" />);
    expect(container.querySelector("[data-tier]")).toBeNull();
    rerender(<DataTable {...base} tableId="t-dens" density="compact" />);
    expect(container.querySelector('[data-tier="cozy"]')).toBeTruthy();
    rerender(<DataTable {...base} tableId="t-dens" density="comfortable" />);
    expect(container.querySelector('[data-tier="comfy"]')).toBeTruthy();
    expect(css).toMatch(/@media \(pointer: fine\)/);
    for (const [tier, px] of [["compact", 28], ["cozy", 36], ["comfy", 44]] as const) expect(css).toMatch(new RegExp(`data-tier="${tier}"\\][^}]*--row-h:\\s*${px}px`));
  });

  it("the header sticks, with a quiet shadow when stuck", () => {
    expect(css).toMatch(/position:\s*sticky/);
    expect(css).toMatch(/data-stuck/);
  });

  it("labels never break mid-word: the title wraps two lines, the rest end with an ellipsis", () => {
    expect(css).toMatch(/line-clamp:\s*2/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).not.toMatch(/word-break:\s*break-all/);
  });

  it("holds no transition or animation outside no-preference, and no left/right but the numeric alignment", () => {
    const rest = outsideNoPreference(css);
    expect(rest).not.toMatch(/\b(transition|animation)\s*:/);
    expect(rest.replace(/text-align:\s*right/g, "")).not.toMatch(/\b(margin|padding|inset|border)-(left|right)\b|(^|[;{\s])(left|right)\s*:/);
  });
});

describe("DataTable on a phone", () => {
  const phone = () =>
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("max-width: 599px"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  const phoneRow = (r: Row) => ({
    icon: <span />,
    title: r.title,
    facts: [{ text: String(r.views) }] as [{ text: string }],
    openLabel: `Open ${r.title}`,
  });

  it("is a list of rows, never a table", () => {
    phone();
    const onOpen = vi.fn();
    render(<DataTable {...base} phoneRow={phoneRow} onOpen={onOpen} />);
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Posts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Bravo note" }));
    expect(onOpen).toHaveBeenCalledWith(rows[1]);
  });

  it("loading and empty still show on a phone", () => {
    phone();
    const { rerender } = render(<DataTable {...base} phoneRow={phoneRow} rows={[]} loading />);
    expect(screen.getByRole("status").textContent).toBe("Loading");
    rerender(<DataTable {...base} phoneRow={phoneRow} rows={[]} empty={<p>Nothing yet</p>} />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });

  it("selection turns the rows into checkboxes", () => {
    phone();
    const { result } = renderHook(() => useSelection(rows.map((r) => r.id)));
    act(() => result.current.enter());
    render(<DataTable {...base} phoneRow={phoneRow} selection={result.current} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Open Alpha note" }));
    expect(result.current.ids).toEqual(["a"]);
  });
});
