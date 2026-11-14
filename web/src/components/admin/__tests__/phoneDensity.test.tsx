import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import VisitorTemplates from "@/components/admin/announce/library/VisitorTemplates";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import type { AdminPost, PostContent } from "@/services/admin";

/*
 * The phone's first screen asks for few controls (#703, #704). jsdom cannot see the fold, so
 * admin-density-phone.mjs counts it in a real browser; these pin the structure that produces the
 * count (which control lives where) and that what was moved still does what it did.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const NOW = "2026-10-01T10:00:00.000Z";
const LIVE: AdminPost = {
  _rev: "3-a", slug: "live-note", title: "Live note", subtitle: null, excerpt: "e", body: "Line one\nLine two", status: "published",
  publishedAt: NOW, updatedAt: NOW, tags: ["ci"], collection: "site", coverImage: null, links: [], readingMinutes: 1, featured: null,
  seo: { title: null, description: null, canonical: null, noindex: false }, he: null, changeNote: null, draft: null, draftSavedAt: null,
};

const api = vi.hoisted(() => ({
  get: vi.fn(), list: vi.fn(), collections: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(), discardDraft: vi.fn(), save: vi.fn(), me: vi.fn(),
}));
vi.mock("@/services/admin", async (orig) => ({ ...(await orig<typeof import("@/services/admin")>()), admin: api }));

function phone(on: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("max-width: 599px"), media: q, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
}

async function openEditor(slug = "live-note") {
  const { default: AdminEditor } = await import("@/pages/AdminEditor");
  render(
    <MemoryRouter initialEntries={[`/admin/posts/${slug}`]}>
      <Routes>
        <Route path="/admin/posts/:slug" element={<AdminEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole("textbox", { name: "Body" }, { timeout: 8000 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, login: "owner", items: [], unread: 0, groups: [], contacts: [], nextCursor: null })));
  api.get.mockResolvedValue({ ...LIVE, draft: { ...LIVE, body: "Line one\nLine 2" } as unknown as PostContent, draftSavedAt: NOW });
  api.me.mockResolvedValue({ login: "owner", email: null });
  api.list.mockResolvedValue([LIVE]);
  api.collections.mockResolvedValue([{ slug: "site", title: "The site", status: "published" }]);
  api.saveDraft.mockImplementation(async (_s: string, body: PostContent) => ({ ...LIVE, _rev: "4-b", draft: body, draftSavedAt: NOW }));
  api.unpublish = vi.fn();
  api.save.mockResolvedValue({ ...LIVE, status: "draft" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the post editor on a phone", { timeout: 20000 }, () => {
  it("keeps one language control (a select), not three toggles and a preview", async () => {
    phone(true);
    await openEditor();
    const lang = screen.getByRole("combobox", { name: "Editing" });
    expect([...(lang as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["English", "Hebrew", "Side by side"]);
    expect(screen.queryByRole("button", { name: "Side by side" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hebrew" })).toBeNull();
  });

  it("puts the Hebrew title, subtitle and excerpt behind a closed Disclosure, and still saves them", async () => {
    phone(true);
    await openEditor();
    const he = screen.getByLabelText("Title in Hebrew") as HTMLInputElement;
    const box = he.closest("details");
    expect(box).not.toBeNull();
    expect(box!.open).toBe(false);
    expect(screen.getAllByLabelText(/in Hebrew$/).every((el) => el.closest("details"))).toBe(true);
    fireEvent.change(he, { target: { value: "שלום" } });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled(), { timeout: 5000 });
    expect(api.saveDraft.mock.calls.at(-1)![1]).toMatchObject({ he: { title: "שלום" } });
  });

  it("replaces the toolbar with one Format button whose sheet runs the same tools and returns focus", async () => {
    phone(true);
    const body = (await openEditor()) as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar")).toBeNull();
    const opener = screen.getByRole("button", { name: "Format" });
    opener.focus();
    fireEvent.click(opener);
    const sheet = await screen.findByRole("dialog", { name: "Format text" }, { timeout: 5000 });
    body.setSelectionRange(0, 4);
    fireEvent.click(within(sheet).getByRole("button", { name: "Bold" }));
    await waitFor(() => expect(body.value).toMatch(/^\*\*Line\*\*/));
    // Closing it hands focus back to the button that opened it.
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("moves Move to drafts under Advanced and unpublishes the same way", async () => {
    phone(true);
    await openEditor();
    const btn = screen.getByRole("button", { name: "Move to drafts" });
    expect(btn.closest("details")?.querySelector("summary")?.textContent ?? "").toMatch(/Advanced/);
    fireEvent.click(btn);
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("live-note", expect.objectContaining({ status: "draft" })));
  });

  it("keeps the desktop editor as it was: the toggle group, two titles, the whole toolbar", async () => {
    phone(false);
    await openEditor();
    expect(screen.queryByRole("combobox", { name: "Editing" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Format" })).toBeNull();
    expect(screen.getByRole("button", { name: "Side by side" })).toBeTruthy();
    expect(screen.getByLabelText("Title in Hebrew").closest("details")).toBeNull();
    expect(within(screen.getByRole("toolbar")).getAllByRole("button").length).toBeGreaterThanOrEqual(13);
  });
});

describe("the shell's nav drawer", () => {
  it("makes the page behind it inert while it is open, and gives it back on close", async () => {
    phone(true);
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, login: "owner", items: [], unread: 0 })));
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminShell title="Admin" section="overview">
          <button type="button">Behind the drawer</button>
        </AdminShell>
      </MemoryRouter>,
    );
    const menu = await screen.findByRole("button", { name: "Menu" });
    const main = () => document.querySelector("main")!;
    expect(main().hasAttribute("inert")).toBe(false);
    fireEvent.click(menu);
    await waitFor(() => expect(main().hasAttribute("inert")).toBe(true));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(main().hasAttribute("inert")).toBe(false));
  });
});

describe("the visitor share templates on a phone", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/admin/settings") return json({ ok: true, exists: true, _rev: "9-z", version: 1, updatedAt: null, history: [], settings: DEFAULT_SETTINGS });
        return json({ ok: true });
      }),
    );
  });

  it("is one row per template; the editor opens in a sheet and nothing is typed in the page flow", async () => {
    phone(true);
    const { container } = render(<MemoryRouter><VisitorTemplates bare /></MemoryRouter>);
    const rows = await waitFor(() => {
      const r = container.querySelectorAll("[data-record-row]");
      expect(r.length).toBeGreaterThan(3);
      return r;
    }, { timeout: 5000 });
    expect(container.querySelectorAll("textarea").length).toBe(0);
    expect(container.querySelectorAll("details").length).toBe(0);
    const first = rows[0] as HTMLElement;
    first.focus();
    fireEvent.click(first);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getAllByRole("textbox").length).toBe(1);
    await act(async () => {});
  });

  it("keeps the disclosure per channel on a desktop", async () => {
    phone(false);
    const { container } = render(<MemoryRouter><VisitorTemplates bare /></MemoryRouter>);
    await waitFor(() => expect(container.querySelectorAll("details").length).toBeGreaterThan(3), { timeout: 5000 });
    expect(container.querySelectorAll("[data-record-row]").length).toBe(0);
  });
});
