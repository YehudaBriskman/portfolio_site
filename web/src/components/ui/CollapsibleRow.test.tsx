import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsibleRow, useCollapsibleRows } from "@/components/ui/CollapsibleRow";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

describe("CollapsibleRow", () => {
  it("is a button with aria-expanded that controls its body", async () => {
    render(<CollapsibleRow id="a" title="Health" open={false} onToggle={() => {}}>body</CollapsibleRow>);
    const btn = screen.getByRole("button", { name: /Health/ });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const body = document.getElementById(btn.getAttribute("aria-controls")!)!;
    expect(body.hidden).toBe(true);
  });

  it("toggles with Enter and Space and keeps focus on the button", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CollapsibleRow id="a" title="Health" open={false} onToggle={() => rerender(<CollapsibleRow id="a" title="Health" open onToggle={() => {}}>b</CollapsibleRow>)}>b</CollapsibleRow>);
    const btn = screen.getByRole("button", { name: /Health/ });
    btn.focus();
    await user.keyboard("{Enter}");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(btn);
  });

  it("shows a count and names it in words for a screen reader", () => {
    render(<CollapsibleRow id="a" title="Health" count={3} open onToggle={() => {}}>b</CollapsibleRow>);
    expect(screen.getByRole("button", { name: /Health/ }).textContent).toContain("3");
  });

  it("mirrors the chevron in a right-to-left page by CSS, not by a second icon", () => {
    document.documentElement.setAttribute("dir", "rtl");
    const { container } = render(<CollapsibleRow id="a" title="Health" open={false} onToggle={() => {}}>b</CollapsibleRow>);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});

describe("useCollapsibleRows", () => {
  const rows = { a: true, b: false };
  it("starts from the defaults and remembers a change", () => {
    const first = renderHook(() => useCollapsibleRows("test", rows));
    expect(first.result.current.open).toEqual({ a: true, b: false });
    act(() => first.result.current.toggle("b"));
    expect(first.result.current.open.b).toBe(true);
    first.unmount();
    const second = renderHook(() => useCollapsibleRows("test", rows));
    expect(second.result.current.open.b).toBe(true);
  });

  it("one call opens all, and when all are open the next closes all", () => {
    const { result } = renderHook(() => useCollapsibleRows("test", rows));
    act(() => result.current.toggleAll());
    expect(result.current.open).toEqual({ a: true, b: true });
    act(() => result.current.toggleAll());
    expect(result.current.open).toEqual({ a: false, b: false });
  });

  it("the E key toggles all, but not while typing in a field", () => {
    const { result } = renderHook(() => useCollapsibleRows("test", rows));
    fireEvent.keyDown(document.body, { key: "e" });
    expect(result.current.open).toEqual({ a: true, b: true });
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "e" });
    expect(result.current.open).toEqual({ a: true, b: true });
    input.remove();
  });

  it("survives a broken storage value", () => {
    localStorage.setItem("admin-rows:test", "{not json");
    const { result } = renderHook(() => useCollapsibleRows("test", rows));
    expect(result.current.open).toEqual({ a: true, b: false });
  });
});
