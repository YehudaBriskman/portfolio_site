import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "@/components/ui/BottomSheet";

/*
 * jsdom has no <dialog>.showModal and no layout, so: showModal/close are
 * stood in for (and asserted), the viewport is jsdom's 768px, and the
 * sizes, targets and motion are read off the CSS text the way
 * admin/__tests__/touchTargets.guard.test.tsx does.
 */

const css = readFileSync(resolve(__dirname, "BottomSheet.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of the first rule whose selector list contains `sel`, outside any @media. */
function rule(sel: string): string {
  const flat = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(",").map((s) => s.trim()).includes(sel)) return m[2];
  }
  return "";
}

let showModal: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;

beforeEach(() => {
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  Object.assign(HTMLDialogElement.prototype, { showModal, close });
});

afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.removeAttribute("dir");
  vi.restoreAllMocks();
});

const dialogOf = (c: HTMLElement) => c.querySelector("dialog") as HTMLDialogElement;
const header = (c: HTMLElement) => c.querySelector("[data-sheet-header]") as HTMLElement;

function drag(el: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(el, { clientY: from, pointerId: 1, button: 0 });
  fireEvent.pointerMove(el, { clientY: (from + to) / 2, pointerId: 1 });
  fireEvent.pointerMove(el, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(el, { clientY: to, pointerId: 1 });
}

describe("BottomSheet: dialog semantics", () => {
  it("opens with showModal and is modal and labelled by its title", () => {
    const { container } = render(<BottomSheet open onClose={() => {}} title="Details">body</BottomSheet>);
    const d = dialogOf(container);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(d.getAttribute("aria-modal")).toBe("true");
    const labelled = document.getElementById(d.getAttribute("aria-labelledby")!);
    expect(labelled?.textContent).toBe("Details");
  });

  it("renders nothing inside while closed", () => {
    const { container } = render(<BottomSheet open={false} onClose={() => {}} title="Details">body</BottomSheet>);
    expect(showModal).not.toHaveBeenCalled();
    expect(container.querySelector("dialog")!.textContent).toBe("");
  });

  it("moves focus to the title, not the first field", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Details">
        <input aria-label="field" />
      </BottomSheet>,
    );
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Details" }));
  });

  it("traps Tab and Shift+Tab inside the sheet", () => {
    const { container } = render(
      <BottomSheet open onClose={() => {}} title="Details" footer={<button type="button">Save</button>}>
        <button type="button">Inside</button>
      </BottomSheet>,
    );
    const d = dialogOf(container);
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /resize/i }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it("restores focus to the opener", () => {
    function Host({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">opener</button>
          <BottomSheet open={open} onClose={() => {}} title="T">x</BottomSheet>
        </>
      );
    }
    const { rerender } = render(<Host open={false} />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    rerender(<Host open />);
    expect(document.activeElement).not.toBe(opener);
    rerender(<Host open={false} />);
    expect(document.activeElement).toBe(opener);
  });
});

describe("BottomSheet: ways to close", () => {
  it("Escape (the dialog's cancel event) calls onClose once and is not left to the browser", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    const ev = new Event("cancel", { cancelable: true });
    fireEvent(dialogOf(container), ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a tap on the backdrop closes; a tap inside does not", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T"><p>inside</p></BottomSheet>);
    fireEvent.click(screen.getByText("inside"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialogOf(container));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the Close button closes", () => {
    const onClose = vi.fn();
    render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    fireEvent.click(screen.getByRole("button", { name: /^close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a drag down past the threshold closes", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} title="T" snaps={["half", "full"]}>x</BottomSheet>);
    drag(header(container), 300, 760);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a short drag down does not close; it settles on a snap", () => {
    const onClose = vi.fn();
    const onSnap = vi.fn();
    const { container } = render(<BottomSheet open onClose={onClose} onSnap={onSnap} title="T">x</BottomSheet>);
    drag(header(container), 300, 330);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogOf(container).getAttribute("data-snap")).toBe("half");
  });

  it("a drag up pulls it to full", () => {
    const onSnap = vi.fn();
    const { container } = render(<BottomSheet open onClose={() => {}} onSnap={onSnap} title="T">x</BottomSheet>);
    drag(header(container), 500, 200);
    expect(dialogOf(container).getAttribute("data-snap")).toBe("full");
    expect(onSnap).toHaveBeenLastCalledWith("full");
  });

  it("Back: opening pushes a history entry, popstate closes", () => {
    const push = vi.spyOn(window.history, "pushState");
    const onClose = vi.fn();
    render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    expect(push).toHaveBeenCalledTimes(1);
    expect((window.history.state as { sheet?: string } | null)?.sheet).toBeTruthy();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a programmatic close pops the entry it pushed, once", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = render(<BottomSheet open onClose={() => {}} title="T">x</BottomSheet>);
    rerender(<BottomSheet open={false} onClose={() => {}} title="T">x</BottomSheet>);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("closing from Back does not pop a second time", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    function Host() {
      return <BottomSheet open onClose={() => {}} title="T">x</BottomSheet>;
    }
    const { unmount } = render(<Host />);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    unmount();
    expect(back).not.toHaveBeenCalled();
  });

  it("dismissible=false ignores Escape, backdrop and drag", () => {
    const onClose = vi.fn();
    const { container } = render(<BottomSheet open dismissible={false} onClose={onClose} title="T">x</BottomSheet>);
    fireEvent(dialogOf(container), new Event("cancel", { cancelable: true }));
    fireEvent.click(dialogOf(container));
    drag(header(container), 300, 760);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^close/i })).toBeNull();
  });

  it("onClose returning false vetoes the close", async () => {
    const onClose = vi.fn(() => false);
    const { container } = render(<BottomSheet open onClose={onClose} title="T">x</BottomSheet>);
    await act(async () => {
      fireEvent(dialogOf(container), new Event("cancel", { cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogOf(container).hasAttribute("open")).toBe(true);
  });

  it("opening a second sheet asks the first to close (never two at once)", () => {
    const first = vi.fn();
    const { rerender } = render(
      <>
        <BottomSheet open onClose={first} title="One">a</BottomSheet>
        <BottomSheet open={false} onClose={() => {}} title="Two">b</BottomSheet>
      </>,
    );
    rerender(
      <>
        <BottomSheet open onClose={first} title="One">a</BottomSheet>
        <BottomSheet open onClose={() => {}} title="Two">b</BottomSheet>
      </>,
    );
    expect(first).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheet: snap points and the keyboard path", () => {
  it("opens at half and the handle cycles half to full and back", () => {
    const onSnap = vi.fn();
    const { container } = render(<BottomSheet open onClose={() => {}} onSnap={onSnap} title="T">x</BottomSheet>);
    const d = dialogOf(container);
    expect(d.getAttribute("data-snap")).toBe("half");
    const handle = screen.getByRole("button", { name: /resize/i });
    fireEvent.click(handle);
    expect(d.getAttribute("data-snap")).toBe("full");
    fireEvent.click(handle);
    expect(d.getAttribute("data-snap")).toBe("half");
    expect(onSnap).toHaveBeenCalledTimes(2);
  });

  it("honours the initial snap and ArrowUp / ArrowDown step through snaps", () => {
    const { container } = render(
      <BottomSheet open snap="peek" snaps={["peek", "half", "full"]} onClose={() => {}} title="T">x</BottomSheet>,
    );
    const d = dialogOf(container);
    const handle = screen.getByRole("button", { name: /resize/i });
    expect(d.getAttribute("data-snap")).toBe("peek");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(d.getAttribute("data-snap")).toBe("half");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(d.getAttribute("data-snap")).toBe("full");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(d.getAttribute("data-snap")).toBe("half");
  });

  it("with one snap there is nothing to cycle", () => {
    const { container } = render(<BottomSheet open snaps={["half"]} onClose={() => {}} title="T">x</BottomSheet>);
    fireEvent.click(screen.getByRole("button", { name: /resize/i }));
    expect(dialogOf(container).getAttribute("data-snap")).toBe("half");
  });

  it("renders the sticky footer", () => {
    render(<BottomSheet open onClose={() => {}} title="T" footer={<button type="button">Save</button>}>x</BottomSheet>);
    expect(screen.getByRole("button", { name: "Save" }).closest("[data-sheet-footer]")).toBeTruthy();
  });
});

describe("BottomSheet: motion, direction, targets (CSS text)", () => {
  it("marks reduced motion from the media query", () => {
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      ...real(q),
      matches: q.includes("prefers-reduced-motion"),
    })) as typeof window.matchMedia;
    try {
      const { container } = render(<BottomSheet open onClose={() => {}} title="T">x</BottomSheet>);
      expect(dialogOf(container).getAttribute("data-reduced")).toBe("true");
    } finally {
      window.matchMedia = real;
    }
  });

  it("declares no transition or animation outside the no-preference block", () => {
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside).not.toMatch(/\btransition\s*:/);
    expect(outside).not.toMatch(/\banimation\s*:/);
    expect(css).toMatch(/prefers-reduced-motion: no-preference/);
  });

  it("uses logical properties only (right to left works)", () => {
    expect(css).not.toMatch(/(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m);
    expect(css).not.toMatch(/text-align\s*:\s*(left|right)/);
  });

  it("renders under dir=rtl with the close button after the title in source order", () => {
    document.documentElement.dir = "rtl";
    const { container } = render(<BottomSheet open onClose={() => {}} title="פרטים">x</BottomSheet>);
    const h = header(container);
    const kids = [...h.querySelectorAll("h2, button")].map((e) => e.tagName);
    expect(kids.at(-1)).toBe("BUTTON");
    expect(h.querySelector("h2")!.textContent).toBe("פרטים");
  });

  it("the handle, the close button and footer buttons are 44px targets", () => {
    for (const sel of [".handle", ".close"]) {
      expect(rule(sel), sel).toMatch(/min-block-size:\s*2\.75rem/);
      expect(rule(sel), sel).toMatch(/min-inline-size:\s*2\.75rem|inline-size:\s*2\.75rem|inline-size:\s*100%/);
    }
    expect(css).toMatch(/\.footer\s*>\s*\*[^{]*\{[^}]*min-block-size:\s*2\.75rem/);
  });

  it("pads the footer by the safe-area inset", () => {
    expect(rule(".footer")).toContain("env(safe-area-inset-bottom)");
  });

  it("sizes the three snaps and locks page scroll", () => {
    expect(css).toMatch(/data-snap="peek"[^{]*\{[^}]*30dvh/);
    expect(css).toMatch(/data-snap="half"[^{]*\{[^}]*55dvh/);
    expect(css).toMatch(/data-snap="full"[^{]*\{[^}]*92dvh/);
    expect(rule(".body")).toMatch(/overscroll-behavior:\s*contain/);
  });
});
