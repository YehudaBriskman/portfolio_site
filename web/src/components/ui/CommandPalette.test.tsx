import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Mail, Plus } from "lucide-react";
import { CommandPalette, type PaletteItem, type PaletteWords } from "@/components/ui/CommandPalette";
import { flattenNav, rankItems } from "@/components/ui/paletteItems";
import type { NavNode } from "@/components/ui/SidebarGroup";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/*
 * Ctrl+K (A32): a native modal <dialog> holding a combobox over a listbox.
 * jsdom has no showModal and no layout, so it is stood in for; keys, focus and
 * ARIA are read off the DOM, motion and logical edges off the CSS text.
 */

const css = readCss(resolve(__dirname, "CommandPalette.module.css"));

const words: PaletteWords = {
  title: "Search",
  placeholder: "Go to a page or create something",
  recent: "Recent",
  create: "Create",
  go: "Go to",
  empty: "Nothing matches",
  results: (n) => (n === 1 ? "1 result" : `${n} results`),
  close: "Close",
};

const make = (run: (id: string) => void): PaletteItem[] => [
  { id: "new-post", label: "New post", group: "create", icon: Plus, run: () => run("new-post") },
  { id: "new-area", label: "New area", group: "create", icon: Plus, run: () => run("new-area") },
  { id: "overview", label: "Overview", group: "go", run: () => run("overview") },
  { id: "marketing-audience", label: "Audience", hint: "Marketing", group: "go", icon: Mail, run: () => run("audience") },
  { id: "posts", label: "Posts", hint: "Content", group: "go", run: () => run("posts") },
  { id: "translations", label: "Translations", hint: "Site", group: "go", run: () => run("translations") },
];

let showModal: ReturnType<typeof vi.fn>;
beforeEach(() => {
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  Object.assign(HTMLDialogElement.prototype, {
    showModal,
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
  try {
    localStorage.clear();
  } catch {
    /* blocked */
  }
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

function Harness({ run = () => {}, items }: { run?: (id: string) => void; items?: PaletteItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <CommandPalette open={open} onOpenChange={setOpen} items={items ?? make(run)} words={words} />
    </>
  );
}
const openIt = () => fireEvent.click(screen.getByText("opener"));
const box = () => screen.getByRole("combobox", { name: "Search" });
const names = () => screen.getAllByRole("option").map((o) => within(o).getByText(/./, { selector: "[data-label]" }).textContent);
const type = (v: string) => fireEvent.change(box(), { target: { value: v } });

describe("CommandPalette", () => {
  it("renders nothing while closed; open is a modal dialog with a focused combobox", () => {
    render(<Harness />);
    expect(screen.queryByRole("combobox")).toBeNull();
    openIt();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
    expect(document.activeElement).toBe(box());
    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(box()).toHaveAttribute("placeholder", words.placeholder);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("with nothing typed: Create then Go to, each a named group, in kit order", () => {
    render(<Harness />);
    openIt();
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label") ?? g.querySelector("[data-heading]")?.textContent)).toEqual(["Create", "Go to"]);
    expect(names()).toEqual(["New post", "New area", "Overview", "Audience", "Posts", "Translations"]);
  });

  it("shows Recent first, once: a recent item is not repeated in its own group", () => {
    localStorage.setItem("admin-palette-recent", JSON.stringify(["posts", "gone-id", "new-area"]));
    render(<Harness />);
    openIt();
    expect(screen.getAllByRole("group").map((g) => g.querySelector("[data-heading]")?.textContent)).toEqual(["Recent", "Create", "Go to"]);
    expect(names()).toEqual(["Posts", "New area", "New post", "Overview", "Audience", "Translations"]);
  });

  it("filters by label, hint and every word, ignoring case; typing ranks one flat list, prefix first", () => {
    render(<Harness />);
    openIt();
    type("pos");
    expect(names()).toEqual(["Posts", "New post"]);
    type("MARKETING aud");
    expect(names()).toEqual(["Audience"]);
    type("a");
    expect(names()[0]).toBe("Audience");
    expect(screen.queryAllByRole("group")).toHaveLength(0);
  });

  it("says so when nothing matches, drops the listbox, and counts results politely", () => {
    render(<Harness />);
    openIt();
    expect(screen.getByRole("status")).toHaveTextContent("6 results");
    type("zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing matches");
    type("overview");
    expect(screen.getByRole("status")).toHaveTextContent("1 result");
  });

  it("matches Hebrew labels", () => {
    const items: PaletteItem[] = [{ id: "posts", label: "פוסטים", group: "go", run: () => {} }, { id: "media", label: "מדיה", group: "go", run: () => {} }];
    render(<Harness items={items} />);
    openIt();
    type("פוס");
    expect(names()).toEqual(["פוסטים"]);
  });

  it("arrows move the active option through aria-activedescendant, wrap, Home and End jump", () => {
    render(<Harness />);
    openIt();
    const active = () => document.getElementById(box().getAttribute("aria-activedescendant")!)!;
    expect(within(active()).getByText("New post")).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(within(active()).getByText("New area")).toBeInTheDocument();
    expect(active()).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(within(active()).getByText("Translations")).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "Home" });
    expect(within(active()).getByText("New post")).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "End" });
    expect(within(active()).getByText("Translations")).toBeInTheDocument();
    expect(document.activeElement).toBe(box());
  });

  it("Enter closes, then runs the active command, and remembers it as recent", () => {
    const order: string[] = [];
    const run = (id: string) => order.push(`run:${id}`);
    function H() {
      const [open, setOpen] = useState(true);
      return <CommandPalette open={open} onOpenChange={(o) => (order.push(`open:${o}`), setOpen(o))} items={make(run)} words={words} />;
    }
    render(<H />);
    type("trans");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(order).toEqual(["open:false", "run:translations"]);
    expect(JSON.parse(localStorage.getItem("admin-palette-recent")!)).toEqual(["translations"]);
  });

  it("recent keeps five, newest first, no repeats", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}`, group: "go" as const, run: () => {} }));
    render(<Harness items={items} />);
    for (let i = 0; i < 7; i++) {
      openIt();
      type(`Item ${i}`);
      fireEvent.keyDown(box(), { key: "Enter" });
    }
    openIt();
    type("Item 3");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(JSON.parse(localStorage.getItem("admin-palette-recent")!)).toEqual(["i3", "i6", "i5", "i4", "i2"]);
  });

  it("an Enter that confirms an IME composition does nothing", () => {
    const run = vi.fn();
    render(<Harness run={run} />);
    openIt();
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("a click on an option runs it; hovering moves the active one", () => {
    const run = vi.fn();
    render(<Harness run={run} />);
    openIt();
    fireEvent.pointerMove(screen.getAllByRole("option")[2]);
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: /Posts/ }));
    expect(run).toHaveBeenCalledWith("posts");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc (the dialog's cancel event) closes it, and a click on the backdrop does too", () => {
    render(<Harness />);
    openIt();
    const d = screen.getByRole("dialog");
    const cancel = new Event("cancel", { cancelable: true });
    act(() => {
      d.dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    openIt();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a click inside the box is not a backdrop click", () => {
    render(<Harness />);
    openIt();
    fireEvent.click(box());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("returns focus to what opened it", () => {
    render(<Harness />);
    const opener = screen.getByText("opener");
    opener.focus();
    openIt();
    expect(document.activeElement).toBe(box());
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(document.activeElement).toBe(opener);
  });

  it("starts from an empty query each time it opens", () => {
    render(<Harness />);
    openIt();
    type("post");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    openIt();
    expect(box()).toHaveValue("");
    expect(screen.getAllByRole("option")).toHaveLength(6);
  });
});

describe("flattenNav and rankItems", () => {
  const tree: NavNode[] = [
    { id: "overview", label: "Overview", to: "/admin" },
    {
      id: "marketing",
      label: "Marketing",
      children: [
        { id: "marketing-inbox", label: "Inbox", to: "/admin/marketing" },
        { id: "marketing-settings", label: "Settings", to: "/admin/marketing?tab=settings", children: [{ id: "marketing-sender", label: "Sender", to: "/admin/marketing?tab=settings&section=sender" }] },
      ],
    },
  ];

  it("lists every leaf with an address, with its parents as the hint, and skips toggle-only groups", () => {
    const go = vi.fn();
    const items = flattenNav(tree, go);
    expect(items.map((i) => [i.id, i.label, i.hint])).toEqual([
      ["overview", "Overview", undefined],
      ["marketing-inbox", "Inbox", "Marketing"],
      ["marketing-settings", "Settings", "Marketing"],
      ["marketing-sender", "Sender", "Marketing / Settings"],
    ]);
    expect(items.every((i) => i.group === "go")).toBe(true);
    items[3].run();
    expect(go).toHaveBeenCalledWith("/admin/marketing?tab=settings&section=sender");
  });

  it("ranks a label that starts with the query ahead of one that merely contains it, and is stable", () => {
    const items: PaletteItem[] = ["Site copy", "Copy link", "Scopy", "Zebra"].map((label) => ({ id: label, label, group: "go" as const, run: () => {} }));
    expect(rankItems(items, "copy").map((i) => i.label)).toEqual(["Copy link", "Site copy", "Scopy"]);
    expect(rankItems(items, "  ").map((i) => i.label)).toEqual(["Site copy", "Copy link", "Scopy", "Zebra"]);
  });
});

describe("CommandPalette stylesheet", () => {
  it("has no transition or animation of its own: the admin's one dialog enter is the only motion", () => {
    expect(css).not.toMatch(/transition\s*:|animation\s*:|@keyframes/);
    expect(outsideNoPreference(css)).not.toMatch(/transition|animation/);
  });
  it("uses logical edges only and never cuts a label mid-word", () => {
    expect(css).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
    expect(css).not.toMatch(/word-break:\s*(break-all|break-word)/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
  });
});
