import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "@/components/ui/BottomSheet";

/*
 * A header drag arms a flag that swallows the click which follows it (a mouse
 * drag ends in one). A touch drag ends in none, so the flag must not outlive
 * the gesture: the next genuine tap on Close or the handle has to land.
 */

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  vi.restoreAllMocks();
});

const header = (c: HTMLElement) => c.querySelector("[data-sheet-header]") as HTMLElement;
const touchDrag = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { clientY: 500, pointerId: 1, button: 0 });
  fireEvent.pointerMove(el, { clientY: 350, pointerId: 1 });
  fireEvent.pointerMove(el, { clientY: 200, pointerId: 1 });
  fireEvent.pointerUp(el, { clientY: 200, pointerId: 1 });
};

describe("BottomSheet: a drag does not eat the next tap", () => {
  it("a touch drag (no click follows) then a tap on Close closes", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    touchDrag(header(container));
    act(() => {
      vi.advanceTimersByTime(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("a touch drag then an immediate tap on the handle cycles the snap", () => {
    const { container } = render(<BottomSheet open onClose={() => {}} title="T">x</BottomSheet>);
    touchDrag(header(container));
    const before = container.querySelector("dialog")!.getAttribute("data-snap");
    // the tap begins a new pointer sequence before any timer has run
    fireEvent.pointerDown(header(container), { clientY: 100, pointerId: 2, button: 0 });
    fireEvent.pointerUp(header(container), { clientY: 100, pointerId: 2 });
    fireEvent.click(screen.getByRole("button", { name: /resize/i }));
    expect(container.querySelector("dialog")!.getAttribute("data-snap")).not.toBe(before);
  });

  it("a mouse drag still swallows the click that ends it", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    const close = screen.getByRole("button", { name: /close/i });
    fireEvent.pointerDown(header(container), { clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(header(container), { clientY: 350, pointerId: 1 });
    fireEvent.pointerMove(header(container), { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(close, { clientY: 200, pointerId: 1 });
    fireEvent.click(close); // same task, as a browser dispatches it
    expect(onClose).not.toHaveBeenCalled();
  });
});
