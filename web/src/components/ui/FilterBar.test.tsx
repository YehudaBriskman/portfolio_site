import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { FilterBar, useFilterBar, type FilterBarWords } from "@/components/ui/FilterBar";
import { defs } from "@/components/ui/filters.fixtures";

const words: FilterBarWords = { search: "Search contacts", clearSearch: "Clear search", results: (n) => `${n} results`, clearAll: "Clear all" };

function setup(props: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const onChange = vi.fn();
  const onQuery = vi.fn();
  render(
    <MemoryRouter>
      <FilterBar defs={defs} value={{}} onChange={onChange} common={["status"]} query="" onQueryChange={onQuery} resultCount={12} words={words} {...props} />
    </MemoryRouter>,
  );
  return { onChange, onQuery };
}

describe("FilterBar", () => {
  it("puts search first, then the chips", () => {
    setup();
    const search = screen.getByRole("searchbox", { name: "Search contacts" });
    const chip = screen.getByRole("button", { name: "Pending" });
    expect(search.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("types into search and clears with one tap", () => {
    const { onQuery } = setup({ query: "abc" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "abcd" } });
    expect(onQuery).toHaveBeenLastCalledWith("abcd");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onQuery).toHaveBeenLastCalledWith("");
  });

  it("Escape in the field clears it", () => {
    const { onQuery } = setup({ query: "abc" });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onQuery).toHaveBeenLastCalledWith("");
  });

  it("toggles a chip through onChange", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "pending" });
  });

  it("states the result count while a filter or a search is on, and Clear all clears both", () => {
    const { onChange, onQuery } = setup({ value: { status: "pending" }, query: "x" });
    expect(screen.getByText("12 results")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenCalled();
    expect(onQuery).toHaveBeenCalledWith("");
  });

  it("says no count when nothing is on", () => {
    setup();
    expect(screen.queryByText("12 results")).toBeNull();
  });
});

describe("useFilterBar", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={["/x?q=hello&status=pending"]}>{children}</MemoryRouter>;

  it("reads search and filters from the address and writes them back (the saved view)", () => {
    const { result } = renderHook(() => useFilterBar("test-screen", defs), { wrapper });
    expect(result.current.query).toBe("hello");
    expect(result.current.filters).toEqual({ status: "pending" });
    act(() => result.current.setQuery("bye"));
    expect(result.current.query).toBe("bye");
    act(() => result.current.setQuery(""));
    expect(result.current.query).toBe("");
    act(() => result.current.setQuery("again"));
    act(() => result.current.clearAll());
    expect(result.current.filters).toEqual({});
    expect(result.current.query).toBe("");
  });
});
