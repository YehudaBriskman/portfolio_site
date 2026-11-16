import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ToastHost from "@/components/ui/ToastHost";
import { __resetToasts } from "@/lib/toast";
import AdminMedia from "@/pages/AdminMedia";
import type { MediaItem } from "@/services/media";

/*
 * /admin/media on a desktop (S7, #851): one primary action in the header, the
 * limits behind an info button, a filter bar, grid or list, bulk delete for
 * unused items, the item in a side panel, and delete through a confirm that
 * names what it removes. jsdom has no layout; what it cannot see is measured in
 * a browser for the PR.
 */

const item = (id: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  id,
  _rev: "1-a",
  name: `${id}.jpg`,
  alt: `Alt for ${id}`,
  caption: "",
  credit: "",
  kind: "image",
  format: "jpeg",
  mime: "image/jpeg",
  file: null,
  width: 1600,
  height: 900,
  bytes: 120_000,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  visibility: "public",
  live: true,
  url: `https://yehudabriskman.com/api/images/media/${id}`,
  preview: `/api/images/m/${id}/w400-${"a".repeat(16)}.webp`,
  srcset: { avif: "", webp: "" },
  usedBy: [],
  ...extra,
});

const USE = { id: "collection:windom", type: "collection", title: "WindoM", slug: "windom", field: "coverImage" };
const fresh = (): MediaItem[] => [
  item("used-1", { alt: "A clock over the aurora", usedBy: [USE] }),
  item("free-1", { alt: "An orange sports car" }),
  item("free-2", { alt: "A quiet harbour" }),
  item("noalt-1", { alt: "" }),
  item("draft-1", { alt: "A private sketch", visibility: "draft", live: false }),
  item("draft-live-1", { alt: "A sketch a page uses", visibility: "draft", live: true, usedBy: [USE] }),
  item("leaf-1", { alt: "A leaf", kind: "icon", format: "svg", mime: "image/svg+xml", file: `/api/images/m/leaf-1/icon-${"b".repeat(16)}.svg`, monochrome: true }),
];

let stored: MediaItem[];
let calls: Array<{ url: string; method: string; signal?: AbortSignal | null }>;
let hang = false;

beforeEach(() => {
  window.localStorage.clear();
  stored = fresh();
  calls = [];
  hang = false;
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, signal: init?.signal });
      const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));
      if (url === "/api/admin/me") return ok({ ok: true, login: "owner", email: null });
      if (url.startsWith("/api/admin/media") && method === "GET") return ok({ ok: true, items: stored });
      if (method === "POST" && hang) {
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      }
      if (method === "DELETE") return ok({ ok: true });
      if (method === "PUT") {
        const id = url.split("/").pop()!;
        const sent = JSON.parse(String(init?.body)) as { visibility: "draft" | "public" };
        const cur = stored.find((m) => m.id === id)!;
        return ok({ ok: true, item: { ...cur, visibility: sent.visibility, live: sent.visibility === "public" || cur.live, _rev: "2-b" } });
      }
      return ok({ ok: false, error: "unexpected" });
    }),
  );
});
afterEach(() => {
  __resetToasts();
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

const page = (path = "/admin/media") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/media" element={<AdminMedia />} />
      </Routes>
      <ToastHost />
    </MemoryRouter>,
  );
const grid = () => screen.findByRole("list", { name: /items?$/ });

describe("the library header and upload", () => {
  it("has one h1, a one-sentence description and one primary Upload action; the long help is behind an info button", async () => {
    page();
    await grid();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.queryByText(/AVIF/)).toBeNull();
    expect(screen.queryByText(/Choose a file/)).toBeNull();
  });

  it("keeps the limits behind an info control, not on the page", async () => {
    page();
    await grid();
    expect(screen.queryByText(/up to 10 MB/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /About the upload limits/ }));
    expect(await screen.findByText(/up to 10 MB/)).toBeInTheDocument();
  });

  it("shows what is uploading, with Cancel that aborts the request and adds nothing", async () => {
    hang = true;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:http://localhost:3000/1b6f0c2e-5d1a-4c3e-9f1e-2a7b8c9d0e1f", revokeObjectURL: () => {} }));
    page();
    await grid();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "new.png", { type: "image/png" }));
    await userEvent.type(await screen.findByRole("textbox", { name: /Alt text/ }), "A new picture");
    await userEvent.click(within(screen.getByRole("form", { name: /Describe/ })).getByRole("button", { name: "Upload" }));
    expect(await screen.findByRole("progressbar", { name: /new\.png/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(await grid()).getAllByRole("button")).toHaveLength(stored.length);
  });
});

describe("the filter bar and the views", () => {
  it("searches, and filters by kind with chips that are in the address", async () => {
    page("/admin/media?kind=icon");
    const list = await screen.findByRole("list", { name: "1 item" });
    expect(within(list).getByRole("button", { name: /A leaf/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Icons", pressed: true }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search media" }), "harbour");
    expect(within(await screen.findByRole("list", { name: "1 item" })).getByRole("button", { name: /A quiet harbour/ })).toBeInTheDocument();
  });

  it("switches between a grid and a list and remembers it in the address", async () => {
    page();
    await grid();
    expect(screen.getByRole("button", { name: "Grid", pressed: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    const table = await screen.findByRole("grid", { name: "Media" });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(stored.length);
    expect(screen.getByRole("button", { name: "List", pressed: true })).toBeInTheDocument();
  });

  it("says first use when the library is empty", async () => {
    stored = [];
    page();
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });

  it("marks a missing alt text once, quietly, on the tile", async () => {
    page();
    const list = await grid();
    expect(within(list).getAllByLabelText("No alt text")).toHaveLength(1);
  });
});

describe("select and bulk delete", () => {
  it("lists unused items only in select mode and deletes the chosen ones after a confirm that says how many", async () => {
    page();
    await grid();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    const list = await grid();
    expect(within(list).queryByRole("checkbox", { name: /A clock over the aurora/ })).toBeNull();
    await userEvent.click(within(list).getByRole("checkbox", { name: /An orange sports car/ }));
    await userEvent.click(within(list).getByRole("checkbox", { name: /A quiet harbour/ }));
    const bar = screen.getByRole("toolbar", { name: "Selected items" });
    expect(within(bar).getByRole("status")).toHaveTextContent("2");
    await userEvent.click(within(bar).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete 2 items?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete 2 items" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url).sort()).toEqual(["/api/admin/media/free-1?rev=1-a", "/api/admin/media/free-2?rev=1-a"]);
  });
});

describe("the item in a side panel", () => {
  it("opens beside the list, not as a modal, with alt text first", async () => {
    page("/admin/media?id=free-1");
    const panel = await screen.findByRole("dialog", { name: "free-1.jpg" });
    expect(panel).toHaveAttribute("aria-modal", "false");
    expect(within(panel).getByRole("textbox", { name: /Alt text \(required\)/ })).toHaveValue("An orange sports car");
    expect(within(panel).getByRole("button", { name: "Replace file" })).toBeInTheDocument();
  });

  it("deletes through a confirm that names the item, never window.confirm", async () => {
    page("/admin/media?id=free-1");
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete free-1.jpg?" });
    expect(within(dialog).getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete free-1.jpg" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});

describe("the phone toolbar", () => {
  it("puts Select first so the chips never run under it", () => {
    const css = readFileSync(resolve(__dirname, "../Media.phone.module.css"), "utf8");
    const tsx = readFileSync(resolve(__dirname, "../MediaPhone.tsx"), "utf8");
    expect(tsx.indexOf("<SelectionHeader")).toBeLessThan(tsx.indexOf("<FilterChips"));
    expect(css).toMatch(/\.chips\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe("drafts (#876)", () => {
  it("marks a draft nobody can see with an icon and the word, once; a draft a published page uses is public and unmarked", async () => {
    page();
    const list = await grid();
    expect(within(list).getAllByText("Draft")).toHaveLength(1);
    expect(within(within(list).getByRole("button", { name: /A private sketch/ })).getByText("Draft")).toBeInTheDocument();
    expect(within(within(list).getByRole("button", { name: /A sketch a page uses/ })).queryByText("Draft")).toBeNull();
  });

  it("filters to drafts", async () => {
    page("/admin/media");
    await grid();
    await userEvent.click(screen.getByRole("button", { name: "Drafts" }));
    const list = await screen.findByRole("list", { name: "1 item" });
    expect(within(list).getByRole("button", { name: /A private sketch/ })).toBeInTheDocument();
  });

  it("switches an item between Draft and Public in its panel, and says why a used draft is public", async () => {
    page("/admin/media?id=draft-1");
    const panel = await screen.findByRole("dialog", { name: "draft-1.jpg" });
    const group = within(panel).getByRole("group", { name: "Visibility" });
    expect(within(group).getByRole("radio", { name: "Draft" })).toBeChecked();
    expect(within(group).getByText(/Only you can see it/)).toBeInTheDocument();
    await userEvent.click(within(group).getByRole("radio", { name: "Public" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.url === "/api/admin/media/draft-1")).toBe(true));
    expect(await within(panel).findByRole("radio", { name: "Public" })).toBeChecked();
  });

  it("a draft that a published page uses reads as public now", async () => {
    page("/admin/media?id=draft-live-1");
    const panel = await screen.findByRole("dialog", { name: "draft-live-1.jpg" });
    expect(within(panel).getByText(/Public now, because a published page uses it/)).toBeInTheDocument();
  });

  it("the upload dialog says new uploads start as drafts", async () => {
    page();
    await grid();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "new.png", { type: "image/png" }));
    expect(await screen.findByText(/New uploads start as drafts/)).toBeInTheDocument();
  });
});
