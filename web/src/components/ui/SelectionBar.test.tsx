import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Archive, Trash2 } from "lucide-react";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { useSelection } from "@/components/ui/useSelection";
import { useMobileWords } from "@/i18n/mobile";

const css = readFileSync(resolve(__dirname, "SelectionBar.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.removeAttribute("lang");
  vi.restoreAllMocks();
});

const IDS = ["a", "b", "c"];

function Harness({ actions, ids = IDS }: { actions: SelectionAction<string>[]; ids?: string[] }) {
  const sel = useSelection(ids);
  return (
    <div>
      <SelectionHeader selection={sel} total={ids.length} />
      {ids.map((id) => (
        <button key={id} type="button" onClick={() => sel.toggle(id)} aria-pressed={sel.has(id)}>
          row {id}
        </button>
      ))}
      <SelectionBar selection={sel} actions={actions} />
    </div>
  );
}

const make = () => {
  const archive = vi.fn();
  const del = vi.fn();
  const actions: SelectionAction<string>[] = [
    { id: "archive", icon: Archive, label: "Archive", run: archive },
    { id: "delete", icon: Trash2, label: "Delete", run: del, destructive: true, confirm: (n) => `Delete ${n} posts` },
  ];
  return { archive, del, actions };
};

const enter = () => fireEvent.click(screen.getByRole("button", { name: "Select" }));
const pick = (...ids: string[]) => ids.forEach((id) => fireEvent.click(screen.getByRole("button", { name: `row ${id}` })));
const bar = () => screen.getByRole("toolbar");

describe("SelectionHeader", () => {
  it("shows a visible Select button; Done, All and None appear in the mode", () => {
    render(<Harness actions={make().actions} />);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    enter();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("status").textContent).toContain("3 selected");
    expect(screen.getByRole("button", { name: "Select none" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(screen.getByRole("status").textContent).toContain("0 selected");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
  });
});

describe("SelectionBar", () => {
  it("is absent until select mode, then stays put with its actions disabled at zero", () => {
    render(<Harness actions={make().actions} />);
    expect(screen.queryByRole("toolbar")).toBeNull();
    enter();
    expect(within(bar()).getByRole("button", { name: "Archive" }).hasAttribute("disabled")).toBe(true);
    pick("a");
    expect(within(bar()).getByRole("button", { name: "Archive" }).hasAttribute("disabled")).toBe(false);
  });

  it("announces the count in a polite live region, in tabular figures, as it changes", () => {
    render(<Harness actions={make().actions} />);
    enter();
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toContain("0 selected");
    pick("a", "b");
    expect(screen.getByRole("status")).toBe(live);
    expect(live.textContent).toContain("2 selected");
    expect(css).toMatch(/\.count\s*\{[^}]*tabular-nums/);
  });

  it("runs the primary action on the selected ids and leaves the mode", async () => {
    const { actions, archive } = make();
    render(<Harness actions={actions} />);
    enter();
    pick("a", "c");
    fireEvent.click(within(bar()).getByRole("button", { name: "Archive" }));
    await act(async () => {});
    expect(archive).toHaveBeenCalledWith(["a", "c"]);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("is operable from the keyboard alone: native buttons in the tab order, Enter runs, Escape leaves", async () => {
    const user = userEvent.setup();
    const { actions, archive } = make();
    render(<Harness actions={actions} />);
    await user.tab();
    await user.keyboard("{Enter}"); // the Select button
    expect(bar()).toBeTruthy();
    expect(bar().querySelectorAll("[role=button], div[tabindex]").length).toBe(0);
    for (const b of bar().querySelectorAll("button")) expect(b.getAttribute("type")).toBe("button");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("toolbar")).toBeNull();
    enter();
    pick("b");
    within(bar()).getByRole("button", { name: "Archive" }).focus();
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(archive).toHaveBeenCalledWith(["b"]);
  });

  it("More opens a sheet of every action, each with the item count", async () => {
    const { actions } = make();
    render(<Harness actions={actions} />);
    enter();
    pick("a", "b");
    fireEvent.click(within(bar()).getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: /Archive/ }).textContent).toContain("2 items");
    expect(within(sheet).getByRole("button", { name: /Delete/ }).textContent).toContain("2 items");
  });

  it("a destructive action asks first, names the object and count, and Keep does nothing", async () => {
    const { actions, del } = make();
    render(<Harness actions={actions} />);
    enter();
    pick("a", "b");
    fireEvent.click(within(bar()).getByRole("button", { name: "More" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Delete/ }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 2 posts" });
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    await act(async () => {});
    expect(del).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("2 selected");
  });

  it("confirming runs the destructive action once, on the chosen ids", async () => {
    const { actions, del } = make();
    render(<Harness actions={actions} />);
    enter();
    pick("c");
    fireEvent.click(within(bar()).getByRole("button", { name: "More" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Delete/ }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 1 posts" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete 1 posts" }));
    await act(async () => {});
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(["c"]);
  });

  it("a destructive primary action is also confirmed, and destructive rows sort last in More", async () => {
    const del = vi.fn();
    const keep = vi.fn();
    const actions: SelectionAction<string>[] = [
      { id: "delete", icon: Trash2, label: "Delete", run: del, destructive: true, confirm: (n) => `Delete ${n} posts` },
      { id: "keep", icon: Archive, label: "Archive", run: keep },
    ];
    render(<Harness actions={actions} />);
    enter();
    pick("a");
    fireEvent.click(within(bar()).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 1 posts" });
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    await act(async () => {});
    fireEvent.click(within(bar()).getByRole("button", { name: "More" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("button").filter((b) => /Archive|Delete/.test(b.textContent ?? ""));
    expect(rows[rows.length - 1].textContent).toContain("Delete");
  });

  it("Escape closes the bulk sheet first and select mode stays; Escape again leaves it", async () => {
    const { actions } = make();
    render(<Harness actions={actions} />);
    enter();
    pick("a");
    fireEvent.click(within(bar()).getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent(sheet, new Event("cancel", { cancelable: true }));
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bar()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("the Back button leaves select mode", () => {
    render(<Harness actions={make().actions} />);
    enter();
    window.history.replaceState(null, "");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("speaks Hebrew on a /he page", () => {
    document.documentElement.lang = "he";
    render(<Harness actions={make().actions} />);
    const w = useMobileWords.of("he").selection;
    fireEvent.click(screen.getByRole("button", { name: w.select }));
    pick("a", "b");
    expect(screen.getByRole("status").textContent).toContain(w.count(2));
    expect(bar().getAttribute("aria-label")).toBe(w.barLabel);
    expect(screen.getByRole("button", { name: w.more })).toBeTruthy();
    expect(screen.getByRole("button", { name: w.done })).toBeTruthy();
  });

  describe("strings", () => {
    const en = useMobileWords.of("en");
    const he = useMobileWords.of("he");
    it("every selection and undo string exists in both languages, and the Hebrew is Hebrew", () => {
      for (const key of ["selection", "undo"] as const) {
        expect(Object.keys(he[key]).sort()).toEqual(Object.keys(en[key]).sort());
        for (const [k, v] of Object.entries(he[key])) {
          const text = typeof v === "function" ? (v as (n: number) => string)(3) : String(v);
          expect(/[֐-׿]/.test(text), `${key}.${k}`).toBe(true);
        }
      }
    });
    it("counts use the language's plural forms", () => {
      expect(en.selection.count(1)).toBe("1 selected");
      expect(en.selection.count(3)).toBe("3 selected");
      expect(en.selection.items(1)).toBe("1 item");
      expect(en.selection.items(3)).toBe("3 items");
      expect(he.selection.items(1)).not.toBe(he.selection.items(3));
      expect(he.selection.items(2)).not.toBe(he.selection.items(3));
    });
  });

  describe("layout (read off the CSS)", () => {
    it("is sticky at the bottom, clear of the home indicator and the editor bar, static in landscape", () => {
      expect(css).toMatch(/\.bar\s*\{[^}]*position:\s*sticky/);
      expect(css).toMatch(/\.bar\s*\{[^}]*inset-block-end:\s*var\(--a-bar-h/);
      expect(css).toMatch(/safe-area-inset-bottom/);
      expect(css).toMatch(/@media \(max-height: 479px\)\s*\{[^}]*\.bar\s*\{[^}]*position:\s*static/);
    });
    it("every control is at least 44px, with logical properties and tokens only", () => {
      expect(css).toMatch(/\.btn\s*\{[^}]*min-block-size:\s*2\.75rem/);
      expect(css).toMatch(/\.btn\s*\{[^}]*min-inline-size:\s*2\.75rem/);
      expect(css).toMatch(/\.item\s*\{[^}]*min-block-size:\s*3\.5rem/);
      expect(css).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
      expect(css).not.toMatch(/transition:\s*all/);
      expect(css).not.toMatch(/\b\d+ms\b|cubic-bezier\(/);
    });
    it("moves only where motion is allowed", () => {
      const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
      expect(outside).not.toMatch(/transition|animation/);
    });
  });
});
