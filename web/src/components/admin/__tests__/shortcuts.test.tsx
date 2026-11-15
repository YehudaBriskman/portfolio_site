import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { comboOf, listShortcuts, registerShortcut, shortcutMatches, useShortcut, type Shortcut } from "@/components/admin/keyboard";

/* The shortcut registry (A32, M12): one table, no two owners of a combo, Ctrl+K and Ctrl+B side by side. */

const offs: Array<() => void> = [];
afterEach(() => {
  while (offs.length) offs.pop()!();
});
const reg = (s: Shortcut) => {
  const off = registerShortcut(s);
  offs.push(off);
  return off;
};
const key = (init: KeyboardEventInit, target: Element | Document = document) => fireEvent.keyDown(target, init);

describe("shortcut registry", () => {
  it("runs Ctrl+K and Ctrl+B each for its own keys, and Cmd counts as Ctrl", () => {
    const k = vi.fn();
    const b = vi.fn();
    reg({ id: "palette", key: "k", mod: true, fields: "plain", run: k });
    reg({ id: "sidebar", key: "b", mod: true, fields: "none", run: b });
    key({ key: "k", ctrlKey: true });
    key({ key: "b", metaKey: true });
    expect(k).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("refuses a second owner of the same combo, and lets one id re-register", () => {
    reg({ id: "palette", key: "k", mod: true, fields: "plain", run: () => {} });
    expect(() => registerShortcut({ id: "other", key: "K", mod: true, fields: "none", run: () => {} })).toThrow(/mod\+k/);
    expect(() => reg({ id: "palette", key: "k", mod: true, fields: "plain", run: () => {} })).not.toThrow();
    expect(listShortcuts().map((s) => comboOf(s))).toEqual(["mod+k"]);
  });

  it("matches a Hebrew layout by the physical key", () => {
    const s: Shortcut = { id: "p", key: "k", mod: true, fields: "plain", run: () => {} };
    expect(shortcutMatches(s, new KeyboardEvent("keydown", { key: "ל", code: "KeyK", ctrlKey: true }))).toBe(true);
    expect(shortcutMatches(s, new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(shortcutMatches(s, new KeyboardEvent("keydown", { key: "k", code: "KeyK" }))).toBe(false);
  });

  it("fields none: silent in an input; plain: live in an input, silent in a rich-text field", () => {
    const none = vi.fn();
    const plain = vi.fn();
    reg({ id: "sidebar", key: "b", mod: true, fields: "none", run: none });
    reg({ id: "palette", key: "k", mod: true, fields: "plain", run: plain });
    const input = document.body.appendChild(document.createElement("input"));
    const rich = document.body.appendChild(document.createElement("div"));
    rich.setAttribute("contenteditable", "true");
    key({ key: "b", ctrlKey: true }, input);
    key({ key: "k", ctrlKey: true }, input);
    key({ key: "k", ctrlKey: true }, rich);
    expect(none).not.toHaveBeenCalled();
    expect(plain).toHaveBeenCalledTimes(1);
    input.remove();
    rich.remove();
  });

  it("does not take an event something else already handled, and honours enabled()", () => {
    const run = vi.fn();
    let on = false;
    reg({ id: "palette", key: "k", mod: true, fields: "plain", run, enabled: () => on });
    key({ key: "k", ctrlKey: true });
    expect(run).not.toHaveBeenCalled();
    on = true;
    const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    e.preventDefault();
    document.dispatchEvent(e);
    expect(run).not.toHaveBeenCalled();
    key({ key: "k", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("useShortcut registers while mounted, calls the latest run, and lets go on unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    function Probe({ run }: { run: () => void }) {
      useShortcut({ id: "palette", key: "k", mod: true, fields: "plain", run });
      return null;
    }
    const { rerender, unmount } = render(<Probe run={first} />);
    rerender(<Probe run={second} />);
    key({ key: "k", ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    key({ key: "k", ctrlKey: true });
    expect(second).toHaveBeenCalledTimes(1);
    expect(listShortcuts()).toEqual([]);
  });
});
