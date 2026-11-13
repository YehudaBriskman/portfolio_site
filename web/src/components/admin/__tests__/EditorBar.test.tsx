import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import EditorBar from "@/components/admin/EditorBar";
import { isTextControl, keyboardOpen } from "@/components/admin/keyboard";

/*
 * The editor's fixed bottom bar is one row (#657). jsdom cannot measure a
 * row, so the geometry is held two ways: the stylesheet's own numbers here,
 * and the real height in a browser by `CHECK_BAR=1 node scripts/shoot-admin.mjs`
 * (320x568, 360x740, 844x390; a bar over 64px, a focused control under it, or
 * the end of the page under it fails the run).
 */

const css = readFileSync(resolve(__dirname, "../../../index.css"), "utf8");
const rule = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} is in index.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};
const px = (text: string, prop: string): number => Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(text)?.[1]);

afterEach(() => {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  vi.unstubAllGlobals();
});

describe("the bar's stylesheet", () => {
  it("is one row of at most 64px, with room for a 44px control", () => {
    const row = rule(".a-bar-row");
    const padding = Number(/padding:\s*(\d+)px/.exec(row)?.[1]);
    expect(px(row, "min-height")).toBeGreaterThanOrEqual(44 + 2 * padding);
    expect(px(row, "min-height") + 1).toBeLessThanOrEqual(64);
    expect(px(rule(".a-bottom .a-btn"), "min-height")).toBe(44);
    expect(px(rule(".a-bar-more"), "width")).toBe(44);
  });

  it("pads for the home indicator and the notch", () => {
    const bar = rule(".a-bottom");
    expect(bar).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)/);
    expect(bar).toMatch(/padding-inline:\s*env\(safe-area-inset-left\)\s*env\(safe-area-inset-right\)/);
  });

  it("steps aside while a keyboard is up", () => {
    expect(rule(".a-bottom[data-keyboard]")).toMatch(/display:\s*none/);
  });

  it("keeps the page's end clear of the bar by its measured height", () => {
    expect(rule(".a-main")).toMatch(/var\(--a-bar-h/);
  });
});

describe("EditorBar", () => {
  const bar = (over: Partial<Parameters<typeof EditorBar>[0]> = {}) =>
    render(
      <EditorBar
        tone="ok"
        status="Draft saved 12:00"
        primary={<button type="button" className="a-btn a-btn-primary">Review</button>}
        more={[
          { key: "save", label: "Save draft", onSelect: vi.fn() },
          { key: "discard", label: "Discard", onSelect: vi.fn() },
        ]}
        {...over}
      />,
    );

  it("is a status, a menu trigger and one primary button, nothing else", () => {
    bar();
    expect(screen.getAllByRole("button").map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual(["More actions", "Review"]);
    expect(document.querySelectorAll(".a-btn-primary")).toHaveLength(1);
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("reads the status out whatever the width, and politely unless it failed", () => {
    const { unmount } = bar();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Draft saved 12:00");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.querySelector(".a-dot")?.getAttribute("aria-hidden")).toBe("true");
    unmount();
    bar({ tone: "bad", status: "The draft was not saved" });
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("assertive");
    expect(screen.getByText("The draft was not saved").hasAttribute("data-problem")).toBe(true);
  });

  it("puts the secondary actions in the menu and runs the one chosen", () => {
    const onSelect = vi.fn();
    bar({ more: [{ key: "save", label: "Save draft", onSelect }] });
    const trigger = screen.getByRole("button", { name: "More actions" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Save draft" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("draws no menu when there is nothing to put in it", () => {
    bar({ more: [] });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("names the menu in Hebrew, and the row follows the reading direction", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    bar();
    expect(screen.getByRole("button", { name: "פעולות נוספות" })).toBeTruthy();
    // Only logical properties: nothing in the row's rules names a side.
    const row = rule(".a-bar-row") + rule(".a-bar-status") + rule(".a-bar-more");
    expect(row).not.toMatch(/(margin|padding)-(left|right)|\b(left|right):/);
  });
});

describe("keyboardOpen", () => {
  it("is a visual viewport that lost more than an address bar, with a text control focused", () => {
    expect(keyboardOpen({ height: 400, offsetTop: 0 }, 740, true)).toBe(true);
    expect(keyboardOpen({ height: 684, offsetTop: 0 }, 740, true)).toBe(false);
    expect(keyboardOpen({ height: 400, offsetTop: 0 }, 740, false)).toBe(false);
    expect(keyboardOpen(null, 740, true)).toBe(false);
  });

  it("does not count a page the visual viewport has been panned over", () => {
    expect(keyboardOpen({ height: 400, offsetTop: 340 }, 740, true)).toBe(false);
  });

  it("knows a text field from a button", () => {
    const input = document.createElement("input");
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTextControl(input)).toBe(true);
    expect(isTextControl(document.createElement("textarea"))).toBe(true);
    expect(isTextControl(box)).toBe(false);
    expect(isTextControl(document.createElement("button"))).toBe(false);
    expect(isTextControl(null)).toBe(false);
  });
});

describe("the shell's bar and the keyboard", () => {
  it("hides the bar while a field is focused under a keyboard, and brings it back", () => {
    const listeners = new Map<string, () => void>();
    const vv = {
      height: 740,
      offsetTop: 0,
      addEventListener: (t: string, f: () => void) => listeners.set(t, f),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("visualViewport", vv);
    vi.stubGlobal("innerHeight", 740);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, login: "o" }), { status: 200 })));
    render(
      <MemoryRouter initialEntries={["/admin/posts/x"]}>
        <AdminShell title="X" section="posts" bottomBar={<EditorBar tone="idle" status="" primary={<button type="button">Go</button>} />}>
          <input aria-label="Title" />
        </AdminShell>
      </MemoryRouter>,
    );
    const wrap = () => document.querySelector(".a-bottom") as HTMLElement;
    expect(wrap().hasAttribute("data-keyboard")).toBe(false);

    act(() => {
      screen.getByLabelText("Title").focus();
      vv.height = 400;
      listeners.get("resize")?.();
    });
    expect(wrap().hasAttribute("data-keyboard")).toBe(true);

    act(() => {
      vv.height = 740;
      listeners.get("resize")?.();
    });
    expect(wrap().hasAttribute("data-keyboard")).toBe(false);
  });
});
