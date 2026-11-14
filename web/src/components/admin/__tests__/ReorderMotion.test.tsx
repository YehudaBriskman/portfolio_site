import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ReorderRows } from "@/components/admin/content/Reorder";

function stubPhone(on: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("no-preference") && q.includes("max-width: 599px"),
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}

function Harness({ start }: { start: string[] }) {
  const [items, setItems] = useState(start);
  return <ReorderRows items={items} name={(s) => s} onChange={setItems} />;
}

type Call = { row: string; keyframes: Array<Record<string, string>>; cancel: ReturnType<typeof vi.fn> };
let calls: Call[];
const rects = new Map<Element, number>();

beforeEach(() => {
  calls = [];
  vi.useFakeTimers();
  // Every row is 50px tall; its top follows its position in the list.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const i = this.hasAttribute("data-i") ? Number(this.getAttribute("data-i")) : 0;
    rects.set(this, i);
    return { top: i * 50, bottom: i * 50 + 50, height: 50, left: 0, right: 100, width: 100, x: 0, y: i * 50, toJSON() {} } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, keyframes: Array<Record<string, string>>) {
      const cancel = vi.fn();
      calls.push({ row: this.getAttribute("data-i") ?? "?", keyframes, cancel });
      return { cancel, finished: Promise.resolve() };
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe("ReorderRows: the neighbours slide to their new slots (phone, motion allowed)", () => {
  beforeEach(() => stubPhone(true));

  it("the order flips at once, and the two rows that swapped glide from where they were", () => {
    render(<Harness start={["A", "B", "C"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    const names = [...document.querySelectorAll("li bdi")].map((b) => b.textContent);
    expect(names).toEqual(["B", "A", "C"]);
    expect(calls.map((c) => c.row).sort()).toEqual(["0", "1"]);
    const b = calls.find((c) => c.row === "0")!; // B moved up one slot: it starts 50px below its new place
    expect(b.keyframes[0].transform).toContain("translateY(50px)");
    const a = calls.find((c) => c.row === "1")!; // A, the one that was moved, starts 50px above and settles with a slight lift
    expect(a.keyframes[0].transform).toContain("translateY(-50px)");
    expect(a.keyframes[0].transform).toContain("scale(");
    for (const c of calls) expect(c.keyframes.at(-1)!.transform).toBe("none");
  });

  it("a hard timeout cancels the glide, so the rows are at rest whatever the animation did", () => {
    render(<Harness start={["A", "B", "C"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    act(() => void vi.advanceTimersByTime(600));
    for (const c of calls) expect(c.cancel).toHaveBeenCalled();
  });

  it("removing a row does not glide anything (only a move does)", () => {
    render(<Harness start={["A", "B", "C"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove B" }));
    expect(calls).toHaveLength(0);
  });
});

describe("ReorderRows without motion", () => {
  it("desktop or reduced motion: the order flips and nothing glides", () => {
    stubPhone(false);
    render(<Harness start={["A", "B", "C"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    expect([...document.querySelectorAll("li bdi")].map((b) => b.textContent)).toEqual(["B", "A", "C"]);
    expect(calls).toHaveLength(0);
  });

  it("a browser without Element.animate: the order flips, nothing throws", () => {
    stubPhone(true);
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
    render(<Harness start={["A", "B", "C"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    expect([...document.querySelectorAll("li bdi")].map((b) => b.textContent)).toEqual(["B", "A", "C"]);
  });
});
