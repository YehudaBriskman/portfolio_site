import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Tree from "@/components/dashboard/Tree";
import type { TreeNode } from "@/components/dashboard/tree";

/*
 * The tree's keyboard, against the WAI-ARIA APG treeview pattern (#224).
 * The tree is controlled, as the Blogs dashboard drives it from the URL, so
 * the harness holds the open branches in state the way the page holds them
 * in `?open=`.
 */

const NODES: TreeNode[] = [
  {
    id: "site",
    text: "The site",
    label: "The site",
    children: [
      { id: "site/a", text: "Alpha", label: "Alpha", href: "/blog/alpha" },
      { id: "site/b", text: "Beta", label: "Beta", href: "/blog/beta" },
    ],
  },
  {
    id: "bothy",
    text: "Bothy",
    label: "Bothy",
    children: [{ id: "bothy/g", text: "Gamma", label: "Gamma", href: "/blog/gamma" }],
  },
  {
    id: "windom",
    text: "WindoM",
    label: "WindoM",
    children: [{ id: "windom/d", text: "Delta", label: "Delta", href: "/blog/delta" }],
  },
];

function Harness({ initial = [] as string[], onChange = (_: string[]) => {} }) {
  const [open, setOpen] = useState(initial);
  return (
    <MemoryRouter>
      <Tree
        nodes={NODES}
        expanded={open}
        onExpandedChange={(next) => {
          onChange(next);
          setOpen(next);
        }}
        label="Browse by area"
      />
    </MemoryRouter>
  );
}

const item = (name: string) => screen.getByRole("treeitem", { name: new RegExp(`^${name}`) });
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });

afterEach(() => vi.restoreAllMocks());

describe("Tree", () => {
  it("is one tab stop: only the first item is in the tab order", () => {
    render(<Harness />);
    const items = screen.getAllByRole("treeitem");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.getByRole("tree", { name: "Browse by area" })).toBeInTheDocument();
  });

  it("states level, position and set size, and whether a branch is open", () => {
    render(<Harness initial={["site"]} />);
    const site = item("The site");
    expect(site).toHaveAttribute("aria-expanded", "true");
    expect(site).toHaveAttribute("aria-level", "1");
    expect(site).toHaveAttribute("aria-posinset", "1");
    expect(site).toHaveAttribute("aria-setsize", "3");
    const beta = item("Beta");
    expect(beta).toHaveAttribute("aria-level", "2");
    expect(beta).toHaveAttribute("aria-posinset", "2");
    expect(beta).toHaveAttribute("href", "/blog/beta");
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "false");
    /* A closed branch's children are not in the tree at all. */
    expect(screen.queryByRole("treeitem", { name: "Gamma" })).toBeNull();
  });

  it("moves with Down, Up, Home and End over the visible items", () => {
    render(<Harness initial={["site"]} />);
    item("The site").focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(item("Alpha"));
    key("ArrowDown");
    key("ArrowDown");
    expect(document.activeElement).toBe(item("Bothy"));
    key("ArrowUp");
    expect(document.activeElement).toBe(item("Beta"));
    key("End");
    expect(document.activeElement).toBe(item("WindoM"));
    key("Home");
    expect(document.activeElement).toBe(item("The site"));
    /* The roving tabindex follows focus. */
    expect(item("The site").tabIndex).toBe(0);
    expect(item("Beta").tabIndex).toBe(-1);
  });

  it("opens with Right, then moves into the branch; Left goes back up, then closes", () => {
    const changes: string[][] = [];
    render(<Harness onChange={(n) => changes.push(n)} />);
    item("Bothy").focus();
    key("ArrowRight");
    expect(changes.at(-1)).toEqual(["bothy"]);
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(item("Bothy"));
    key("ArrowRight");
    expect(document.activeElement).toBe(item("Gamma"));
    key("ArrowRight"); /* a leaf: nothing */
    expect(document.activeElement).toBe(item("Gamma"));
    key("ArrowLeft");
    expect(document.activeElement).toBe(item("Bothy"));
    key("ArrowLeft");
    expect(changes.at(-1)).toEqual([]);
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles a branch with Enter and Space, and opens every sibling with *", () => {
    render(<Harness />);
    item("The site").focus();
    key("Enter");
    expect(item("The site")).toHaveAttribute("aria-expanded", "true");
    key(" ");
    expect(item("The site")).toHaveAttribute("aria-expanded", "false");
    key("*");
    for (const n of ["The site", "Bothy", "WindoM"]) expect(item(n)).toHaveAttribute("aria-expanded", "true");
  });

  it("jumps to the next item whose name starts with a typed letter", () => {
    render(<Harness initial={["site", "windom"]} />);
    item("The site").focus();
    key("d");
    expect(document.activeElement).toBe(item("Delta"));
    key("b");
    /* Wraps round: Beta comes after Delta in visible order from the top. */
    expect(document.activeElement).toBe(item("Beta"));
  });

  it("does not let a child's key reach its branch as well", () => {
    const changes: string[][] = [];
    render(<Harness initial={["site"]} onChange={(n) => changes.push(n)} />);
    item("Alpha").focus();
    key("ArrowLeft");
    /* Moved to the parent; did not also close it. */
    expect(document.activeElement).toBe(item("The site"));
    expect(changes).toEqual([]);
  });

  it("swaps Right and Left in a right-to-left page", () => {
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const s = real(el, pseudo);
      return (el as Element).getAttribute?.("role") === "tree" ? ({ ...s, direction: "rtl" } as CSSStyleDeclaration) : s;
    });
    render(<Harness />);
    item("Bothy").focus();
    key("ArrowRight");
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "false");
    key("ArrowLeft");
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "true");
    key("ArrowLeft");
    expect(document.activeElement).toBe(item("Gamma"));
    key("ArrowRight");
    expect(document.activeElement).toBe(item("Bothy"));
  });

  it("opens a branch on a press of its row", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Bothy"));
    expect(item("Bothy")).toHaveAttribute("aria-expanded", "true");
    expect(item("Gamma")).toBeInTheDocument();
  });
});
