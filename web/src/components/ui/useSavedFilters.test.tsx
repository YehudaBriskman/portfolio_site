import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { FiltersRestoredNote } from "@/components/ui/FilterChips";
import { defs } from "@/components/ui/filters.fixtures";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import type { Filters } from "@/components/ui/filters";

const KEY = "admin.filters.audience";

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

let last: { set: (f: Filters) => void; clear: () => void } = { set: () => {}, clear: () => {} };

function Screen({ id = "audience" }: { id?: string }) {
  const [filters, set, state] = useSavedFilters(id, defs);
  last = { set, clear: state.clear };
  return (
    <>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <FiltersRestoredNote restored={state.restored} onUndo={state.undoRestore} onDismiss={state.dismissRestored} />
      <Probe />
    </>
  );
}

const at = (url: string, id?: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Screen id={id} />
    </MemoryRouter>,
  );
const filters = () => JSON.parse(screen.getByTestId("filters").textContent ?? "null") as Filters;
const search = () => screen.getByTestId("search").textContent;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  document.documentElement.lang = "en";
  vi.restoreAllMocks();
});

describe("useSavedFilters: the URL is the truth", () => {
  it("reads the filters from the address, and shows no restore note for them", () => {
    at("/?tab=audience&status=pending&group=a&group=b");
    expect(filters()).toEqual({ status: "pending", group: ["a", "b"] });
    expect(screen.queryByText("Filters restored")).toBeNull();
  });

  it("writes a change to the address and leaves the other params", () => {
    at("/?tab=audience");
    act(() => last.set({ status: "bounced", group: ["c"] }));
    expect(new URLSearchParams(search() ?? "").get("tab")).toBe("audience");
    expect(new URLSearchParams(search() ?? "").get("status")).toBe("bounced");
    expect(filters()).toEqual({ status: "bounced", group: ["c"] });
  });

  it("never writes a default to the address", () => {
    at("/");
    act(() => last.set({ sort: "new", group: [] }));
    expect(search()).toBe("");
  });

  it("round-trips through the address: a reload with the same URL gives the same filters", () => {
    const first = at("/");
    act(() => last.set({ status: "pending", group: ["a", "b"], created: { from: "2026-01-01", to: "2026-02-01" }, sort: "name" }));
    const url = `/${search()}`;
    const before = filters();
    first.unmount();
    at(url);
    expect(filters()).toEqual(before);
  });

  it("keeps screens apart", () => {
    at("/?status=pending", "audience");
    expect(window.localStorage.getItem("admin.filters.posts")).toBeNull();
  });
});

describe("useSavedFilters: remembered per viewer", () => {
  it("remembers the last set in localStorage", () => {
    at("/");
    act(() => last.set({ status: "pending" }));
    expect(window.localStorage.getItem(KEY)).toContain("status=pending");
  });

  it("restores it on an empty address, with a note that can be undone", () => {
    window.localStorage.setItem(KEY, "status=pending&group=a");
    at("/?tab=audience");
    expect(filters()).toEqual({ status: "pending", group: ["a"] });
    expect(new URLSearchParams(search() ?? "").get("status")).toBe("pending");
    expect(new URLSearchParams(search() ?? "").get("tab")).toBe("audience");
    expect(screen.getByRole("status").textContent).toContain("Filters restored");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(filters()).toEqual({});
    expect(search()).toBe("?tab=audience");
    expect(window.localStorage.getItem(KEY)).toBeFalsy();
    expect(screen.queryByText("Filters restored")).toBeNull();
  });

  it("lets the address win: filters in it are not replaced by the remembered set", () => {
    window.localStorage.setItem(KEY, "status=pending");
    at("/?status=bounced");
    expect(filters()).toEqual({ status: "bounced" });
    expect(screen.queryByText("Filters restored")).toBeNull();
  });

  it("drops the note when the viewer changes a filter themselves", () => {
    window.localStorage.setItem(KEY, "status=pending");
    at("/");
    expect(screen.getByText("Filters restored")).toBeTruthy();
    act(() => last.set({ status: "active" }));
    expect(screen.queryByText("Filters restored")).toBeNull();
  });

  it("can dismiss the note and keep the filters", () => {
    window.localStorage.setItem(KEY, "status=pending");
    at("/");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Filters restored")).toBeNull();
    expect(filters()).toEqual({ status: "pending" });
  });

  it("clears the address and the memory together", () => {
    at("/?tab=audience&status=pending");
    act(() => last.clear());
    expect(filters()).toEqual({});
    expect(search()).toBe("?tab=audience");
    expect(window.localStorage.getItem(KEY)).toBeFalsy();
  });

  it("ignores a remembered value it no longer understands", () => {
    window.localStorage.setItem(KEY, "status=gone&group=zzz");
    at("/");
    expect(filters()).toEqual({});
    expect(screen.queryByText("Filters restored")).toBeNull();
  });

  it("still renders and filters when storage throws on every access", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    at("/?status=pending");
    expect(filters()).toEqual({ status: "pending" });
    act(() => last.set({ status: "active" }));
    expect(filters()).toEqual({ status: "active" });
    act(() => last.clear());
    expect(filters()).toEqual({});
  });

  it("still renders when reading window.localStorage itself throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    at("/?status=pending");
    expect(filters()).toEqual({ status: "pending" });
  });
});

describe("FiltersRestoredNote", () => {
  it("says it in Hebrew on a Hebrew page", () => {
    document.documentElement.lang = "he";
    window.localStorage.setItem(KEY, "status=pending");
    at("/");
    expect(screen.getByRole("status").textContent).toContain("המסננים שוחזרו");
    expect(screen.getByRole("button", { name: "ביטול פעולה" })).toBeTruthy();
  });

  it("renders nothing when nothing was restored", () => {
    const { container } = render(<FiltersRestoredNote restored={false} onUndo={() => {}} onDismiss={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
