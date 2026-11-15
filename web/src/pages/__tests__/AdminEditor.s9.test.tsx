import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminPost } from "@/services/admin";

/*
 * Admin S9 (gap audit rows 30 to 32): the post editor says where the note
 * stands once, has one primary action, keeps its details in a panel, and its
 * controls do not touch.
 */

const NOW = "2026-10-01T10:00:00.000Z";
const LIVE: AdminPost = {
  _rev: "3-a", slug: "live-note", title: "Live note", subtitle: "A sub", excerpt: "e", body: "Line one",
  status: "published", publishedAt: NOW, updatedAt: NOW, tags: ["ci"], collection: "site", coverImage: null,
  links: [], readingMinutes: 1, featured: null,
  seo: { title: null, description: null, canonical: null, noindex: false },
  he: null, changeNote: null, draft: null, draftSavedAt: null,
};
const EDITED: AdminPost = { ...LIVE, draft: { ...LIVE, title: "Live note 2" } as never, draftSavedAt: NOW };
const DRAFT: AdminPost = { ...LIVE, status: "draft", publishedAt: null };

const api = vi.hoisted(() => ({
  get: vi.fn(), list: vi.fn(), collections: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(), discardDraft: vi.fn(), save: vi.fn(), me: vi.fn(),
}));
vi.mock("@/services/admin", async (orig) => ({ ...(await orig<typeof import("@/services/admin")>()), admin: api }));
vi.mock("@/components/admin/AdminShell", () => ({
  default: ({ children, bottomBar }: { children: React.ReactNode; bottomBar?: React.ReactNode }) => (
    <>
      <main>{children}</main>
      {bottomBar}
    </>
  ),
}));

async function open(post: AdminPost) {
  api.get.mockResolvedValue(post);
  const { default: AdminEditor } = await import("@/pages/AdminEditor");
  render(
    <MemoryRouter initialEntries={["/admin/posts/live-note"]}>
      <Routes><Route path="/admin/posts/:slug" element={<AdminEditor />} /></Routes>
    </MemoryRouter>,
  );
  return screen.findByRole("textbox", { name: "Body" }, { timeout: 8000 });
}

beforeEach(() => {
  api.list.mockResolvedValue([LIVE]);
  api.collections.mockResolvedValue([{ slug: "site", title: "The site", status: "published" }]);
  api.saveDraft.mockImplementation(async (_s: string, b: object) => ({ ...LIVE, _rev: "4-b", draft: b, draftSavedAt: NOW }));
});
afterEach(() => vi.clearAllMocks());

describe("the post editor says it once", { timeout: 20000 }, () => {
  it("a published note with edits is named once, in the bar, and no pill, banner or footer repeats it", async () => {
    await open(EDITED);
    expect(screen.getAllByText("Edited")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/unpublished/i);
    expect(screen.queryByText("Published")).toBeNull();
  });

  it("a published note with no edits says Published once", async () => {
    await open(LIVE);
    expect(screen.getAllByText("Published")).toHaveLength(1);
  });

  it("a draft says Draft once", async () => {
    await open(DRAFT);
    expect(screen.getAllByText("Draft")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/Not published yet/);
  });

  it("has one primary action: Publish for a draft, Update for a published note", async () => {
    await open(DRAFT);
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Draft, again" } });
    expect(document.querySelectorAll(".a-btn-primary")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Publish" })).toHaveClass("a-btn-primary");
  });

  it("calls the primary Update once a published note has edits", async () => {
    await open(EDITED);
    expect(screen.getByRole("button", { name: "Update" })).toHaveClass("a-btn-primary");
    expect(document.querySelectorAll(".a-btn-primary")).toHaveLength(1);
  });

  it("keeps Save draft, Move to drafts, Discard and the shortcuts behind More", async () => {
    await open(EDITED);
    expect(screen.queryByRole("button", { name: "Move to drafts" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
    const names = screen.getAllByRole("menuitem").map((m) => m.textContent);
    expect(names).toEqual(["Save draft", "Discard changes", "Move to drafts", "Keyboard shortcuts"]);
  });

  it("documents the shortcuts in a dialog, not in a line under the body", async () => {
    await open(LIVE);
    expect(document.body.textContent).not.toMatch(/Ctrl\+B/);
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Keyboard shortcuts" }));
    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Ctrl+B")).toBeInTheDocument();
    expect(within(dialog).getByText("Ctrl+S")).toBeInTheDocument();
  });
});

describe("the language is a segmented control", { timeout: 20000 }, () => {
  it("is one radio group of English, Hebrew and Side by side", async () => {
    await open(LIVE);
    const group = screen.getByRole("radiogroup", { name: "Editing" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["English", "Hebrew", "Side by side"]);
    fireEvent.click(within(group).getByRole("radio", { name: "Side by side" }));
    expect(screen.getByRole("textbox", { name: "Body, Hebrew" })).toBeInTheDocument();
  });
});

describe("the details are a panel", { timeout: 20000 }, () => {
  it("opens from a Details button and holds area, tags, cover, SEO and links", async () => {
    await open(LIVE);
    expect(screen.queryByLabelText("Subtitle")).toBeNull();
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = await screen.findByRole("dialog", { name: "Details" });
    expect(within(panel).getByLabelText("Subtitle")).toHaveValue("A sub");
    expect(within(panel).getByLabelText("Area")).toBeInTheDocument();
    expect(within(panel).getByRole("list", { name: "Tags" })).toBeInTheDocument();
    expect(within(panel).getByText("Search and sharing")).toBeInTheDocument();
  });

  it("opens by itself when the server refuses a field that lives in it", async () => {
    const { AdminValidationError } = await import("@/services/admin");
    await open(LIVE);
    api.saveDraft.mockRejectedValueOnce(new AdminValidationError({ coverImage: "Not a URL" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Live note!" } });
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true"), { timeout: 5000 });
  });
});

describe("controls do not touch (A7)", () => {
  const css = readFileSync(resolve(__dirname, "../../components/admin/noteEditor/NoteEditor.module.css"), "utf8");
  const block = (sel: string) => {
    const at = css.indexOf(`\n${sel} {`);
    expect(at, `${sel} is in the stylesheet`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };
  const rem = (text: string, prop: string) => Number(new RegExp(`${prop}:\\s*([\\d.]+)rem`).exec(text)?.[1]);

  it("spaces the toolbar's buttons by at least 8px", () => {
    expect(rem(block(".toolbar"), "gap")).toBeGreaterThanOrEqual(0.5);
  });
  it("spaces the tag chips and the tag input by at least 8px", () => {
    expect(rem(block(".tags"), "gap")).toBeGreaterThanOrEqual(0.5);
  });
  it("keeps the picture button 8px off the text", () => {
    expect(block(".bar")).toMatch(/padding-block:\s*[\d.]+rem\s+0?\.5rem|padding-bottom:\s*\.5rem/);
  });
});
