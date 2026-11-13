import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UndoToast, useUndoable, UNDO_MIN_MS } from "@/components/ui/UndoToast";
import { useMobileWords } from "@/i18n/mobile";

const css = readFileSync(resolve(__dirname, "UndoToast.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute("lang");
});

type Handle = ReturnType<typeof useUndoable>;
let handle: Handle;
function Harness() {
  handle = useUndoable();
  return <UndoToast undoable={handle} />;
}
const show = (commit = vi.fn(), onUndo = vi.fn(), message = "Archived 3 posts", duration?: number) => {
  act(() => handle.schedule({ message, commit, onUndo, duration }));
  return { commit, onUndo };
};

describe("UndoToast", () => {
  it("keeps one polite live region mounted before any toast, so the message is announced", () => {
    render(<Harness />);
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    show();
    expect(screen.getByRole("status").textContent).toContain("Archived 3 posts");
    expect(screen.getByRole("status")).toBe(live);
  });

  it("holds the action back, then commits when the timer ends", () => {
    render(<Harness />);
    const { commit } = show();
    act(() => vi.advanceTimersByTime(UNDO_MIN_MS - 1));
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("never lets the Undo window be shorter than 8 seconds", () => {
    expect(UNDO_MIN_MS).toBe(8000);
    render(<Harness />);
    const { commit } = show(vi.fn(), vi.fn(), "x", 1000);
    act(() => vi.advanceTimersByTime(7999));
    expect(commit).not.toHaveBeenCalled();
  });

  it("Undo restores: the action is never committed and onUndo runs", () => {
    render(<Harness />);
    const { commit, onUndo } = show();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("pauses while the pointer is over it", () => {
    render(<Harness />);
    const { commit } = show();
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.pointerEnter(screen.getByTestId("undo-toast"));
    act(() => vi.advanceTimersByTime(30_000));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerLeave(screen.getByTestId("undo-toast"));
    act(() => vi.advanceTimersByTime(2999));
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("pauses while focus is inside it", () => {
    render(<Harness />);
    const { commit } = show();
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.focusIn(undo);
    act(() => vi.advanceTimersByTime(60_000));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.focusOut(undo);
    act(() => vi.advanceTimersByTime(4000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("commits at once when the page is hidden, so a closing tab does not lose the action", () => {
    render(<Harness />);
    const { commit } = show();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(commit).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a second action commits the first right away: a queue of one", () => {
    render(<Harness />);
    const first = show(vi.fn(), vi.fn(), "First");
    const second = show(vi.fn(), vi.fn(), "Second");
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(second.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Second");
  });

  it("commits on unmount instead of dropping the action", () => {
    const { unmount } = render(<Harness />);
    const { commit } = show();
    unmount();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("the Undo button is a 44px native button named in the page language", () => {
    for (const lang of ["en", "he"] as const) {
      document.documentElement.lang = lang;
      const { unmount } = render(<Harness />);
      show();
      const btn = screen.getByRole("button", { name: useMobileWords.of(lang).undo.action });
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("type")).toBe("button");
      unmount();
    }
    expect(css).toMatch(/\.undo\s*\{[^}]*min-block-size:\s*2\.75rem/);
  });

  it("moves only where motion is allowed, with tokens, and sits clear of the editor bar and safe area", () => {
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside).not.toMatch(/transition|animation/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(css).not.toMatch(/\b\d+ms\b|cubic-bezier\(/);
    expect(css).toMatch(/--a-bar-h/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).not.toMatch(/\b(left|right)\s*:/);
  });
});
