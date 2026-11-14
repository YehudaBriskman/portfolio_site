import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { toast, __resetToasts, UNDO_MIN_MS } from "@/lib/toast";
import { useUndoable } from "@/lib/toast/useUndoable";
import ToastHost from "@/components/ui/ToastHost";

/*
 * The Undo window, moved from UndoToast into the toast service: the same
 * promises (held back, commit on expiry / leaving / pagehide / replaced, never
 * under 8 s, paused while hovered or focused) with the service owning the
 * clock, so they hold whether or not sonner's own timer ever runs.
 */

beforeEach(() => {
  __resetToasts();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Handle = ReturnType<typeof useUndoable>;
let handle: Handle;
function Harness() {
  // The test reaches the hook's handle from outside the tree to call schedule() in act().
  // eslint-disable-next-line react-hooks/globals
  handle = useUndoable();
  return <ToastHost />;
}
const show = (opts: { id?: string; duration?: number; message?: string } = {}) => {
  const commit = vi.fn();
  const onUndo = vi.fn();
  act(() => handle.schedule({ message: opts.message ?? "Archived 3 posts", commit, onUndo, id: opts.id, duration: opts.duration }));
  return { commit, onUndo };
};
const press = () => act(() => toast.live()[0].action!.onClick());

describe("toast.undoable timing (the 8 s Undo window)", () => {
  it("holds the action back, then commits when the window ends", () => {
    render(<Harness />);
    const { commit } = show();
    act(() => void vi.advanceTimersByTime(UNDO_MIN_MS - 1));
    expect(commit).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(toast.live()).toHaveLength(0);
  });

  it("never lets the window be shorter than 8 seconds", () => {
    expect(UNDO_MIN_MS).toBe(8000);
    render(<Harness />);
    const { commit } = show({ duration: 1000 });
    act(() => void vi.advanceTimersByTime(7999));
    expect(commit).not.toHaveBeenCalled();
  });

  it("Undo restores: the action is never committed and onUndo runs once", () => {
    render(<Harness />);
    const { commit, onUndo } = show();
    press();
    expect(onUndo).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(commit).not.toHaveBeenCalled();
    expect(toast.live()).toHaveLength(0);
  });

  it("pauses while the pointer is over the stack, and while focus is inside it", () => {
    const { container } = render(<Harness />);
    const { commit } = show();
    const host = container.ownerDocument.querySelector("[data-toast-host]") as HTMLElement;
    act(() => void vi.advanceTimersByTime(5000));
    fireEvent.pointerEnter(host);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerLeave(host);
    act(() => void vi.advanceTimersByTime(2999));
    expect(commit).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledTimes(1);

    const next = show({ message: "Again" });
    fireEvent.focusIn(host);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(next.commit).not.toHaveBeenCalled();
    fireEvent.focusOut(host);
    act(() => void vi.advanceTimersByTime(UNDO_MIN_MS));
    expect(next.commit).toHaveBeenCalledTimes(1);
  });

  it("commits at once on pagehide, so a closing tab does not lose the action", () => {
    render(<Harness />);
    const { commit } = show();
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(commit).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a second action commits the first right away: a queue of one", () => {
    render(<Harness />);
    const first = show({ message: "First" });
    const second = show({ message: "Second" });
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(second.commit).not.toHaveBeenCalled();
    expect(toast.live().map((t) => t.title)).toEqual(["Second"]);
  });

  it("one pending job per id: the same id commits the earlier one", () => {
    render(<Harness />);
    const a = show({ id: "delete:x" });
    const b = show({ id: "delete:x" });
    expect(a.commit).toHaveBeenCalledTimes(1);
    expect(b.commit).not.toHaveBeenCalled();
    expect(toast.live()).toHaveLength(1);
  });
});

describe("toast.undoable and leaving the screen", () => {
  it("commits on unmount instead of dropping the action (leaving the page)", () => {
    const { unmount } = render(<Harness />);
    const { commit } = show();
    unmount();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("regression: Undo, then navigate away, commits nothing and restores once", () => {
    const { unmount } = render(<Harness />);
    const { commit, onUndo } = show();
    press();
    unmount();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("another screen's job is not committed by this screen leaving", () => {
    const { unmount } = render(<Harness />);
    const mine = show({ message: "mine" });
    unmount();
    expect(mine.commit).toHaveBeenCalledTimes(1);
    const other = vi.fn();
    act(() => void toast.undoable({ title: "other", commit: other }));
    expect(other).toHaveBeenCalledTimes(1); // no host any more: committed at once, never lost
  });
});

describe("a host that is still loading", () => {
  it("holds the job instead of committing it, once the admin has said a host is coming", () => {
    toast.expectHost(true);
    const commit = vi.fn();
    act(() => void toast.undoable({ title: "x", commit }));
    expect(commit).not.toHaveBeenCalled();
    expect(toast.live()).toHaveLength(1);
  });
});
