import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";

/*
 * Touch targets and the meta-text token are read off the CSS text (jsdom has no
 * layout; the real measurement is the admin-matrix script). A finger needs
 * 44px; a pointer needs 32px; text that carries meaning is --a-fs-meta.
 */

const SRC = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(SRC, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Block = { media: string; sel: string; body: string };

/** Leaf rules, each tagged with the innermost @media condition it sits in. */
function blocks(css: string): Block[] {
  const out: Block[] = [];
  const walk = (src: string, media: string) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open < 0) break;
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth) {
        depth += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0;
        j++;
      }
      const head = src.slice(i, open).trim();
      const inner = src.slice(open + 1, j - 1);
      if (/^@media/.test(head)) walk(inner, head);
      else if (/^@/.test(head) && inner.includes("{")) walk(inner, media);
      else out.push({ media, sel: head, body: inner });
      i = j;
    }
  };
  walk(css, "");
  return out;
}

const rem = (v: string | undefined) => {
  const m = v?.trim().match(/^(\d*\.?\d+)(rem|px)$/);
  return m ? (m[2] === "px" ? Number(m[1]) / 16 : Number(m[1])) : null;
};
const decl = (body: string, prop: string) => body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`))?.[1];
const sels = (b: Block) => b.sel.split(",").map((s) => s.trim());

const INDEX = blocks(read("index.css"));
const COARSE = (b: Block) => /pointer:\s*coarse/.test(b.media);
/** The value a property settles on for a selector inside the coarse block. */
function coarse(sel: string, prop: string) {
  const hit = INDEX.filter((b) => COARSE(b) && sels(b).includes(sel));
  return rem(hit.map((b) => decl(b.body, prop)).filter(Boolean).pop());
}

describe("a finger gets 44px (2.75rem) under pointer: coarse", () => {
  for (const sel of [".a-btn", ".a-input", ".a-select", ".a-nav-item", ".a-tab"]) {
    it(`${sel} has min-height 2.75rem`, () => expect(coarse(sel, "min-height")).toBeGreaterThanOrEqual(2.75));
  }
  for (const prop of ["width", "height", "min-height"]) {
    it(`.a-icon-btn ${prop} is 44px`, () => expect(coarse(".a-icon-btn", prop)).toBeGreaterThanOrEqual(2.75));
  }
  it("a pointer keeps the compact 2rem button", () => {
    const base = INDEX.find((b) => !b.media && b.sel === ".a-btn")!;
    expect(rem(decl(base.body, "min-height"))).toBe(2);
  });
});

describe("the tag input", () => {
  const css = blocks(read("components/admin/noteEditor/NoteEditor.module.css"));
  it("is at least 2rem high on a pointer and 2.75rem on a finger", () => {
    const base = css.find((b) => !b.media && b.sel === ".tagInput")!;
    expect(rem(decl(base.body, "min-height"))).toBeGreaterThanOrEqual(2);
    const touch = css.filter((b) => /pointer:\s*coarse/.test(b.media) && b.sel === ".tagInput");
    expect(rem(touch.map((b) => decl(b.body, "min-height")).pop())).toBeGreaterThanOrEqual(2.75);
  });
});

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return { ...real, admin: { ...real.admin, get: mocks.get, list: async () => [], collections: async () => [] } };
});
afterEach(() => vi.clearAllMocks());

describe("the whole tag box focuses the tag input", () => {
  it("a click on the box (its padding or the empty row) focuses the input", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/posts/new"]}>
        <Routes><Route path="/admin/posts/:slug" element={<AdminEditor />} /></Routes>
      </MemoryRouter>,
    );
    const list = await waitFor(() => {
      const l = screen.getAllByRole("list").find((x) => x.getAttribute("aria-label")?.toLowerCase().includes("tag"));
      if (!l) throw new Error("no tag list yet");
      return l;
    });
    const input = list.parentElement!.querySelector("input")!;
    expect(document.activeElement).not.toBe(input);
    fireEvent.click(list.parentElement!);
    expect(document.activeElement).toBe(input);
  });
});

describe("--a-fs-meta is the one size of text that carries meaning", () => {
  it("is defined as .875rem", () => {
    const def = INDEX.map((b) => decl(b.body, "--a-fs-meta")).find(Boolean);
    expect(rem(def)).toBe(0.875);
  });

  const META = [
    ".a-side-head", ".a-side-who", ".a-page-meta", ".a-row-meta", ".a-hint", ".a-table th",
    ".a-tag", ".a-pill", ".a-counter", ".a-stat-label", ".a-stat-detail", ".a-box-foot",
  ];
  for (const sel of META) {
    it(`${sel} uses var(--a-fs-meta)`, () => {
      const hit = INDEX.filter((b) => !b.media && sels(b).includes(sel));
      expect(hit.length).toBeGreaterThan(0);
      expect(hit.map((b) => decl(b.body, "font-size"))).toContain("var(--a-fs-meta)");
    });
  }
  it("Media .tileMeta uses it", () => {
    const m = blocks(read("components/admin/Media.module.css")).find((b) => b.sel === ".tileMeta")!;
    expect(decl(m.body, "font-size")).toBe("var(--a-fs-meta)");
  });
});
