import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { SidePanel, useSidePanelParam, useUnsavedGuard } from "@/components/ui/SidePanel";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/*
 * A non-modal side panel on a desktop, a half BottomSheet on a phone (A21).
 * jsdom has no layout and no <dialog>.showModal: motion is read off the CSS
 * text, focus and keys off the DOM, and the phone branch off a matchMedia stub.
 */

const css = readCss(resolve(__dirname, "SidePanel.module.css"));

function Harness({ guard, trapFocus, onChange }: { guard?: () => boolean | Promise<boolean>; trapFocus?: boolean; onChange?: (o: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <ul>
        <li>
          <button>row one</button>
        </li>
      </ul>
      <SidePanel
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          onChange?.(o);
        }}
        title="Edit contact"
        footer={<button>Save</button>}
        beforeClose={guard}
        trapFocus={trapFocus}
      >
        <label>
          Name <input />
        </label>
      </SidePanel>
    </>
  );
}

const open = () => fireEvent.click(screen.getByText("opener"));
const panel = () => screen.getByRole("dialog", { name: "Edit contact" });

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* storage blocked */
  }
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.removeProperty("--a-panel-w");
});

describe("SidePanel on a desktop", () => {
  it("is a non-modal dialog named by its title, and not a <dialog> or an inert page", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    const p = panel();
    expect(p).toHaveAttribute("aria-modal", "false");
    expect(p.tagName).not.toBe("DIALOG");
    expect(screen.getByText("opener").closest("[inert]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Edit contact" })).toBeInTheDocument();
  });

  it("moves focus to the title (no keyboard rising), and Esc closes and returns focus to the opener", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const opener = screen.getByText("opener");
    opener.focus();
    open();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Edit contact" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(opener);
  });

  it("Esc from the list behind it does not close the panel", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();
    fireEvent.keyDown(screen.getByText("row one"), { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("an Esc something inside already handled is not a close", () => {
    render(<Harness />);
    open();
    const input = screen.getByLabelText("Name");
    input.addEventListener("keydown", (e) => e.preventDefault());
    fireEvent.keyDown(input, { key: "Escape" });
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("the close button closes it", () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-state", "closed");
  });

  it("beforeClose returning false vetoes Esc and Close; true lets them through", async () => {
    let answer = false;
    render(<Harness guard={() => answer} />);
    open();
    await act(async () => {
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    });
    expect(panel()).toHaveAttribute("data-state", "open");
    answer = true;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-state", "closed");
  });

  it("leaves the DOM after its exit, never on an animation event", () => {
    vi.useFakeTimers();
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const gone = screen.getByRole("dialog", { hidden: true });
    expect(gone).toHaveAttribute("data-state", "closed");
    expect(gone).toHaveAttribute("inert");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("can be reopened during its exit (M7)", () => {
    vi.useFakeTimers();
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    open();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("does not trap Tab by default, and wraps it inside the panel with trapFocus", () => {
    const { unmount } = render(<Harness />);
    open();
    screen.getByRole("button", { name: "Save" }).focus();
    expect(fireEvent.keyDown(screen.getByRole("button", { name: "Save" }), { key: "Tab" })).toBe(true);
    unmount();

    render(<Harness trapFocus />);
    open();
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    expect(fireEvent.keyDown(save, { key: "Tab" })).toBe(false);
    expect(panel().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(save);
    const first = document.activeElement as HTMLElement;
    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(save);
  });

  it("keeps the list visible: it reserves its width on the page while open and gives it back", () => {
    render(<Harness />);
    expect(document.documentElement.style.getPropertyValue("--a-panel-w")).toBe("");
    open();
    expect(document.documentElement.style.getPropertyValue("--a-panel-w")).toBe("420px");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.documentElement.style.getPropertyValue("--a-panel-w")).toBe("");
  });

  it("resizes from its edge by keyboard, within 360 to 560, and remembers it", () => {
    render(<Harness />);
    open();
    const sep = screen.getByRole("separator", { name: "Resize panel" });
    expect(sep).toHaveAttribute("aria-valuemin", "360");
    expect(sep).toHaveAttribute("aria-valuemax", "560");
    expect(sep).toHaveAttribute("aria-valuenow", "420");
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(sep).toHaveAttribute("aria-valuenow", "436");
    for (let i = 0; i < 30; i++) fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(sep).toHaveAttribute("aria-valuenow", "560");
    fireEvent.keyDown(sep, { key: "Home" });
    expect(sep).toHaveAttribute("aria-valuenow", "360");
    expect(localStorage.getItem("admin-sidepanel-w")).toBe("360");
  });

  it("the resize arrows follow the reading direction", () => {
    document.documentElement.dir = "rtl";
    try {
      render(<Harness />);
      open();
      const sep = screen.getByRole("separator", { name: "Resize panel" });
      fireEvent.keyDown(sep, { key: "ArrowRight" });
      expect(sep).toHaveAttribute("aria-valuenow", "436");
    } finally {
      document.documentElement.dir = "";
    }
  });
});

describe("SidePanel stylesheet", () => {
  it("moves and fades only inside no-preference; reduced motion gets hidden at once", () => {
    const reduced = outsideNoPreference(css);
    expect(reduced).not.toMatch(/transition\s*:|animation\s*:|@keyframes/);
    expect(reduced).toMatch(/\[data-state='closed'\][^{]*\{[^}]*visibility:\s*hidden/);
  });
  it("enters on the entrance tokens and leaves on the exit tokens", () => {
    expect(css).toMatch(/--a-dur-sheet\) var\(--a-ease-out\)/);
    expect(css).toMatch(/--a-dur-exit-sheet\) var\(--a-ease-exit\)/);
  });
  it("animates transform-like properties only, with logical edges", () => {
    expect(css).not.toMatch(/transition[^;]*\b(width|height|margin|padding|inline-size|block-size|top|left|right)\b/);
    expect(css).not.toMatch(/\b(left|right)\s*:/);
  });
});

describe("SidePanel on a phone", () => {
  let showModal: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    Object.assign(HTMLDialogElement.prototype, { showModal, close: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }) });
    window.matchMedia = ((q: string) => ({ matches: /max-width: 599px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
    Reflect.deleteProperty(window, "matchMedia"); /* jsdom has none */
  });

  it("is the BottomSheet: a modal <dialog>, no side panel, no reserved width", () => {
    const { container } = render(<Harness />);
    open();
    expect(showModal).toHaveBeenCalled();
    expect(container.querySelector("[data-side-panel]")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--a-panel-w")).toBe("");
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});

describe("useUnsavedGuard", () => {
  it("says go ahead without asking when nothing changed", async () => {
    const ask = vi.fn(() => false);
    const { result } = renderHook(() => useUnsavedGuard(false, ask));
    expect(await result.current()).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks when dirty and passes the answer through, sync or async", async () => {
    const { result, rerender } = renderHook(({ a }: { a: () => boolean | Promise<boolean> }) => useUnsavedGuard(true, a), { initialProps: { a: () => false } });
    expect(await result.current()).toBe(false);
    rerender({ a: async () => true });
    expect(await result.current()).toBe(true);
  });

  it("reads the latest dirty flag and the latest question without changing identity", async () => {
    const { result, rerender } = renderHook(({ d, a }: { d: boolean; a: () => boolean }) => useUnsavedGuard(d, a), { initialProps: { d: false, a: () => true } });
    const first = result.current;
    rerender({ d: true, a: () => false });
    expect(result.current).toBe(first);
    expect(await result.current()).toBe(false);
  });
});

describe("useSidePanelParam", () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={["/admin/marketing?tab=audience&panel=7"]}>{children}</MemoryRouter>;
  }

  it("reads the id from the address and writes it without touching other params", () => {
    const { result } = renderHook(
      () => {
        const p = useSidePanelParam();
        return { p, loc: useLocation() };
      },
      { wrapper },
    );
    expect(result.current.p.id).toBe("7");
    act(() => result.current.p.open("12"));
    expect(result.current.loc.search).toBe("?tab=audience&panel=12");
    act(() => result.current.p.close());
    expect(result.current.loc.search).toBe("?tab=audience");
    expect(result.current.p.id).toBeNull();
  });
});
