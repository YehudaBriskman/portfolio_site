import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ListPresence } from "@/components/ui/ListPresence";
import { EXIT_KEEP_MS } from "@/hooks/usePhoneMotion";

type Row = { id: string; name: string };
const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id, name: `row ${id}` }));

function stubPhone(on: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("no-preference") && q.includes("max-width: 599px"),
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}

const List = ({ items }: { items: Row[] }) => (
  <ListPresence as="ul" items={items} itemKey={(r) => r.id} aria-label="rows">
    {(r) => <span>{r.name}</span>}
  </ListPresence>
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ListPresence on a phone with motion allowed", () => {
  beforeEach(() => stubPhone(true));

  it("draws the first list with no entrance (nothing is fresh on first render)", () => {
    render(<List items={rows("a", "b")} />);
    const li = screen.getAllByRole("listitem");
    expect(li).toHaveLength(2);
    for (const l of li) expect(l.hasAttribute("data-fresh")).toBe(false);
  });

  it("keeps a removed row, closed and inert, then drops it on a timer (never on animationend)", () => {
    const { rerender } = render(<List items={rows("a", "b", "c")} />);
    rerender(<List items={rows("a", "c")} />);
    const gone = screen.getByText("row b").closest("li")!;
    expect(gone.getAttribute("data-state")).toBe("closed");
    expect(gone.hasAttribute("inert")).toBe(true);
    expect(gone.getAttribute("aria-hidden")).toBe("true");
    // order is kept: the leaving row sits where it was
    expect(screen.getAllByRole("listitem", { hidden: true }).map((l) => l.textContent)).toEqual(["row a", "row b", "row c"]);
    act(() => void vi.advanceTimersByTime(EXIT_KEEP_MS + 1));
    expect(screen.queryByText("row b")).toBeNull();
  });

  it("marks an inserted row fresh and open at once", () => {
    const { rerender } = render(<List items={rows("a")} />);
    rerender(<List items={rows("a", "b")} />);
    const added = screen.getByText("row b").closest("li")!;
    expect(added.getAttribute("data-state")).toBe("open");
    expect(added.hasAttribute("data-fresh")).toBe(true);
    expect(added.hasAttribute("inert")).toBe(false);
  });

  it("does not animate the first rows that arrive after an empty list (a load, not an insert)", () => {
    const { rerender } = render(<List items={[]} />);
    rerender(<List items={rows("a", "b")} />);
    for (const l of screen.getAllByRole("listitem")) expect(l.hasAttribute("data-fresh")).toBe(false);
  });

  it("Undo: a row removed and put back is open again, not stuck leaving", () => {
    const { rerender } = render(<List items={rows("a", "b")} />);
    rerender(<List items={rows("a")} />);
    rerender(<List items={rows("a", "b")} />);
    const back = screen.getByText("row b").closest("li")!;
    expect(back.getAttribute("data-state")).toBe("open");
    act(() => void vi.advanceTimersByTime(EXIT_KEEP_MS * 2));
    expect(screen.getByText("row b")).toBeTruthy();
  });

  it("a row that leaves still shows its last content (the item is gone from props)", () => {
    const { rerender } = render(<List items={rows("a", "b")} />);
    rerender(<List items={rows("a")} />);
    expect(screen.getByText("row b")).toBeTruthy();
  });
});

describe("ListPresence where the stylesheet will not animate (desktop, reduced motion)", () => {
  it("a removed row goes at once and nothing is fresh", () => {
    stubPhone(false);
    const { rerender } = render(<List items={rows("a", "b")} />);
    rerender(<List items={rows("a", "b", "c")} />);
    expect(screen.getByText("row c").closest("li")!.hasAttribute("data-fresh")).toBe(false);
    rerender(<List items={rows("a", "c")} />);
    expect(screen.queryByText("row b")).toBeNull();
  });
});
