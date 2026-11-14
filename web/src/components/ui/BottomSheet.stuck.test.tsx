/*
 * Bottom sheet stuck states: one test per fault the phone audit proved
 * (a sheet that "does not rise", a dead Back press, a lost open state).
 * jsdom has no <dialog>.showModal; it is stood in for as BottomSheet.test.tsx does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SelectionBar, type SelectionAction } from "@/components/ui/SelectionBar";
import { useSelection } from "@/components/ui/useSelection";
import { keyboardOpen } from "@/components/admin/keyboard";

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    // Like the browser: showModal on an open dialog throws, close on a closed one is a no-op.
    showModal: vi.fn(function (this: HTMLDialogElement) {
      if (this.hasAttribute("open")) throw new DOMException("already open", "InvalidStateError");
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    }),
  });
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  window.history.replaceState(null, "");
});

const dialogOf = (c: HTMLElement) => c.querySelector("dialog") as HTMLDialogElement;
const header = (c: HTMLElement) => c.querySelector("[data-sheet-header]") as HTMLElement;
function drag(el: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(el, { clientY: from, pointerId: 1, button: 0 });
  fireEvent.pointerMove(el, { clientY: (from + to) / 2, pointerId: 1 });
  fireEvent.pointerMove(el, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(el, { clientY: to, pointerId: 1 });
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const geometry = (d: HTMLDialogElement) => ({ t: d.style.transform, b: d.style.blockSize, drag: d.dataset.dragging, snap: d.dataset.snap });

function Toggle({ snaps }: { snaps?: Array<"peek" | "half" | "full"> }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="T" snaps={snaps}>body</BottomSheet>
    </>
  );
}

describe("a drag-dismissed sheet reopens exactly as the first time", () => {
  it("leaves no inline transform, size or data-dragging after a dismiss", async () => {
    const { container } = render(<Toggle />);
    drag(header(container), 400, 700);
    await settle();
    expect(dialogOf(container).hasAttribute("open")).toBe(false);
    expect(geometry(dialogOf(container))).toEqual({ t: "", b: "", drag: undefined, snap: "half" });
  });

  it("opens at the same geometry on each of 20 dismiss and reopen rounds", async () => {
    const { container } = render(<Toggle />);
    const first = geometry(dialogOf(container));
    expect(dialogOf(container).hasAttribute("open")).toBe(true);
    for (let i = 0; i < 20; i++) {
      drag(header(container), 400, 700);
      await settle();
      expect(dialogOf(container).hasAttribute("open")).toBe(false);
      fireEvent.click(screen.getByText("opener"));
      await settle();
      expect(dialogOf(container).hasAttribute("open")).toBe(true);
      expect(geometry(dialogOf(container))).toEqual(first);
    }
    expect(window.history.length).toBeLessThan(40);
  });

  it("clears a drag that is cancelled, and one cut short by Escape", async () => {
    const { container } = render(<Toggle />);
    const h = header(container);
    fireEvent.pointerDown(h, { clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(h, { clientY: 450, pointerId: 1 });
    expect(dialogOf(container).dataset.dragging).toBe("true");
    fireEvent.pointerCancel(h, { pointerId: 1 });
    expect(geometry(dialogOf(container)).drag).toBeUndefined();
    expect(dialogOf(container).style.blockSize).toBe("");

    fireEvent.pointerDown(h, { clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(h, { clientY: 450, pointerId: 1 });
    fireEvent(dialogOf(container), new Event("cancel", { cancelable: true }));
    await settle();
    expect(dialogOf(container).hasAttribute("open")).toBe(false);
    expect(geometry(dialogOf(container))).toEqual({ t: "", b: "", drag: undefined, snap: "half" });
  });

  it("clears a drag when the sheet is closed from code mid-drag", async () => {
    const { container, rerender } = render(<BottomSheet open onClose={() => {}} title="T">body</BottomSheet>);
    const h = header(container);
    fireEvent.pointerDown(h, { clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(h, { clientY: 450, pointerId: 1 });
    rerender(<BottomSheet open={false} onClose={() => {}} title="T">body</BottomSheet>);
    expect(geometry(dialogOf(container)).drag).toBeUndefined();
    expect(dialogOf(container).style.blockSize).toBe("");
  });
});

describe("a native close reaches the component", () => {
  it("calls onClose when the dialog is closed natively (close event)", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T">body</BottomSheet>);
    const d = dialogOf(container);
    d.removeAttribute("open"); // a non-cancelable `cancel`, or <form method=dialog>
    fireEvent(d, new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("the opener works again after dialog.close()", async () => {
    const { container } = render(<Toggle />);
    act(() => dialogOf(container).close());
    await settle();
    fireEvent.click(screen.getByText("opener"));
    await settle();
    expect(dialogOf(container).hasAttribute("open")).toBe(true);
  });

  it("opening a sheet whose dialog is already open does not throw", () => {
    const { container, rerender } = render(<BottomSheet open={false} onClose={() => {}} title="T">body</BottomSheet>);
    dialogOf(container).setAttribute("open", "");
    expect(() => rerender(<BottomSheet open onClose={() => {}} title="T">body</BottomSheet>)).not.toThrow();
    expect(dialogOf(container).hasAttribute("open")).toBe(true);
  });
});

describe("a quick flick down dismisses by velocity", () => {
  it("dismisses a quick 90px flick on a single-snap sheet", async () => {
    const now = vi.spyOn(performance, "now");
    let t = 1000;
    now.mockImplementation(() => (t += 12));
    const { container } = render(<Toggle snaps={["half"]} />);
    drag(header(container), 400, 490);
    await settle();
    expect(dialogOf(container).hasAttribute("open")).toBe(false);
    now.mockRestore();
  });

  it("a slow short drag on a single-snap sheet springs back", async () => {
    const now = vi.spyOn(performance, "now");
    let t = 1000;
    now.mockImplementation(() => (t += 400));
    const { container } = render(<Toggle snaps={["half"]} />);
    drag(header(container), 400, 440);
    await settle();
    expect(dialogOf(container).hasAttribute("open")).toBe(true);
    now.mockRestore();
  });
});

describe("select mode + sheet: one Back is never dead", () => {
  function Demo() {
    const sel = useSelection([1, 2, 3]);
    const actions: SelectionAction<number>[] = [
      { id: "a", icon: Archive, label: "Archive", run: () => {} },
      { id: "m", icon: Trash2, label: "Mark read", run: () => {} },
    ];
    return (
      <>
        <button onClick={() => sel.enter(1)}>enter</button>
        <SelectionBar selection={sel} actions={actions} />
      </>
    );
  }
  it("after Mark read (via More) no `selection` state is left as the current entry", async () => {
    render(<Demo />);
    fireEvent.click(screen.getByText("enter"));
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    await act(async () => { fireEvent.click(screen.getAllByText("Mark read")[0].closest("button")!); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect((window.history.state as { selection?: string } | null)?.selection).toBeUndefined();
    expect((window.history.state as { sheet?: string } | null)?.sheet).toBeUndefined();
  });
});

describe("pinch zoom is not a keyboard", () => {
  it("a 2x pinch-zoomed visual viewport with a text field focused is not a keyboard", () => {
    expect(keyboardOpen({ height: 400, offsetTop: 0, scale: 2 }, 800, true)).toBe(false);
  });
  it("a real keyboard at scale 1 still is", () => {
    expect(keyboardOpen({ height: 480, offsetTop: 0, scale: 1 }, 800, true)).toBe(true);
  });
  it("a viewport without a scale reading keeps the height rule", () => {
    expect(keyboardOpen({ height: 480, offsetTop: 0 }, 800, true)).toBe(true);
  });
});
