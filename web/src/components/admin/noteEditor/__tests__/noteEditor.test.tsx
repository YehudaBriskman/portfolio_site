import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { altFromFile, applyEdit, edit, imageMarkdown, openWikilink } from "../markdownOps";
import { changedFields, counts, diffLines, hunks } from "../diff";
import type { AdminPost, PostContent } from "@/services/admin";

/*
 * The note editor (#250): what its toolbar writes, what its review shows,
 * and the rule the whole thing exists to keep: an edit to a published note
 * goes to its draft, and only Publish changes what readers see.
 */

const sel = (value: string, start: number, end = start) => ({ value, start, end });
const run = (value: string, start: number, end: number, op: Parameters<typeof edit>[1]) =>
  applyEdit(value, edit(sel(value, start, end), op));

describe("markdown ops", () => {
  it("wraps and unwraps a selection", () => {
    expect(run("a word here", 2, 6, "bold")).toBe("a **word** here");
    expect(run("a **word** here", 4, 8, "bold")).toBe("a word here");
    expect(run("a word", 2, 6, "code")).toBe("a `word`");
    const e = edit(sel("", 0), "italic", "text");
    expect(applyEdit("", e)).toBe("_text_");
    expect([e.selStart, e.selEnd]).toEqual([1, 5]);
  });

  it("toggles a line prefix on every selected line, replacing another", () => {
    expect(run("one\ntwo", 0, 7, "ul")).toBe("- one\n- two");
    expect(run("- one\n- two", 0, 11, "ul")).toBe("one\ntwo");
    expect(run("one\ntwo", 0, 7, "ol")).toBe("1. one\n2. two");
    expect(run("## Title", 3, 3, "h3")).toBe("### Title");
    expect(run("> quote", 0, 0, "quote")).toBe("quote");
  });

  it("makes a link with the address selected for typing", () => {
    const e = edit(sel("see docs", 4, 8), "link", "link text");
    expect(applyEdit("see docs", e)).toBe("see [docs](https://)");
    expect("see [docs](https://)".slice(e.selStart, e.selEnd)).toBe("https://");
    expect(run("https://example.org", 0, 19, "link")).toBe("[text](https://example.org)");
  });

  it("finds an open [[ before the caret, and not a closed one", () => {
    expect(openWikilink("See [[are", 9)).toEqual({ from: 4, query: "are" });
    expect(openWikilink("See [[a]] and", 13)).toBeNull();
    expect(openWikilink("[[a\nb", 5)).toBeNull();
  });

  it("writes picture markdown that cannot break out of its brackets", () => {
    expect(imageMarkdown("a [tricky]\nalt", "https://x/api/images/media/1")).toBe("![a \\[tricky\\] alt](https://x/api/images/media/1)");
    expect(altFromFile("my-photo_02.png")).toBe("my photo 02");
  });
});

describe("the review diff", () => {
  it("diffs lines and folds what did not change", () => {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h"].join("\n");
    const after = ["a", "b", "c", "d", "E", "f", "g", "h", "i"].join("\n");
    const lines = diffLines(before, after)!;
    expect(counts(lines)).toEqual({ added: 2, removed: 1 });
    const h = hunks(lines, 1);
    expect(h[0]).toEqual({ kind: "skip", count: 3 });
    expect(h.some((x) => x.kind === "lines" && x.lines.some((l) => l.kind === "del" && l.text === "e"))).toBe(true);
  });

  it("names the fields that changed", () => {
    const base = { title: "A", tags: ["x"], body: "b", seo: { title: null, description: null, canonical: null, noindex: false } } as PostContent;
    expect(changedFields(base, { ...base, title: "B", body: "c" })).toEqual(["title"]);
    expect(changedFields(base, { ...base, tags: ["x", "y"] })).toEqual(["tags"]);
  });
});

/* ------------------------------------------------------------ the page */

const NOW = "2026-10-01T10:00:00.000Z";
const LIVE: AdminPost = {
  _rev: "3-a",
  slug: "live-note",
  title: "Live note",
  subtitle: null,
  excerpt: "e",
  body: "Line one\nLine two",
  status: "published",
  publishedAt: NOW,
  updatedAt: NOW,
  tags: ["ci"],
  collection: "site",
  coverImage: null,
  links: [],
  readingMinutes: 1,
  featured: null,
  seo: { title: null, description: null, canonical: null, noindex: false },
  he: null,
  changeNote: null,
  draft: null,
  draftSavedAt: null,
};

const api = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  collections: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  discardDraft: vi.fn(),
  save: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/services/admin", async (orig) => ({
  ...(await orig<typeof import("@/services/admin")>()),
  admin: api,
}));
vi.mock("@/components/admin/AdminShell", () => ({
  /* The editor's actions live only in the shell's bottom bar (#288). */
  default: ({ children, bottomBar }: { children: React.ReactNode; bottomBar?: React.ReactNode }) => (
    <>
      <main>{children}</main>
      {bottomBar}
    </>
  ),
}));

async function open() {
  const { default: AdminEditor } = await import("@/pages/AdminEditor");
  render(
    <MemoryRouter initialEntries={["/admin/posts/live-note"]}>
      <Routes>
        <Route path="/admin/posts/:slug" element={<AdminEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  /* Generous waits: under the full suite the lazy page and its fetches can
     take well past the one-second default. */
  return screen.findByRole("textbox", { name: "Body" }, { timeout: 8000 });
}

describe("the editor page", { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.get.mockResolvedValue(LIVE);
    api.list.mockResolvedValue([
      LIVE,
      { ...LIVE, slug: "other-note", title: "The other note" },
    ]);
    api.collections.mockResolvedValue([{ slug: "site", title: "The site", status: "published" }]);
    api.saveDraft.mockImplementation(async (_slug: string, body: PostContent) => ({
      ...LIVE, _rev: "4-b", draft: body, draftSavedAt: NOW,
    }));
    api.publish.mockImplementation(async (_slug: string, body: PostContent & { changeNote?: string }) => ({
      ...LIVE, ...body, _rev: "5-c", changeNote: body.changeNote ?? null, draft: null,
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("autosaves an edit to the draft and never publishes it", async () => {
    const body = await open();
    fireEvent.change(body, { target: { value: "Line one\nLine 2" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(api.saveDraft.mock.calls[0][0]).toBe("live-note");
    expect(api.saveDraft.mock.calls[0][1]).toMatchObject({ body: "Line one\nLine 2", _rev: "3-a" });
    expect(api.publish).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("shows what Publish changes, then publishes with what changed", async () => {
    const body = await open();
    fireEvent.change(body, { target: { value: "Line one\nLine 2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Live note, revised" } });
    const review = screen.getAllByRole("button", { name: "Review and publish" })[0];
    await waitFor(() => expect(review).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(review);

    const dialog = await screen.findByRole("dialog", { name: "Review before publishing" }, { timeout: 5000 });
    expect(within(dialog).getByText("Body: 1 lines added, 1 removed")).toBeInTheDocument();
    expect(within(dialog).getByText("Live note, revised")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "What changed" }), { target: { value: "Fixed line two." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(api.publish.mock.calls[0][1]).toMatchObject({
      title: "Live note, revised",
      body: "Line one\nLine 2",
      changeNote: "Fixed line two.",
      _rev: expect.any(String),
    });
  });

  it("offers notes, areas and projects after [[ and writes the link", async () => {
    const body = (await open()) as HTMLTextAreaElement;
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    body.focus();
    body.setSelectionRange(body.value.length, body.value.length);
    fireEvent.change(body, { target: { value: "Line one\nSee [[oth" } });
    body.setSelectionRange(body.value.length, body.value.length);
    fireEvent.click(body);

    const list = await screen.findByRole("listbox", { name: "Link suggestions" });
    const option = within(list).getByRole("option", { name: /The other note/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(body).toHaveAttribute("aria-activedescendant", option.id);
    fireEvent.keyDown(body, { key: "Enter" });
    await waitFor(() => expect(body.value).toBe("Line one\nSee [[other-note|The other note]]"));
  });

  it("formats from the keyboard", async () => {
    const body = (await open()) as HTMLTextAreaElement;
    body.focus();
    body.setSelectionRange(0, 4);
    fireEvent.keyDown(body, { key: "b", ctrlKey: true });
    await waitFor(() => expect(body.value).toBe("**Line** one\nLine two"));
  });

  it("renders the preview with the reader's renderer, raw HTML as text", async () => {
    const body = await open();
    fireEvent.change(body, { target: { value: "<img src=x onerror=alert(1)> and **bold**" } });
    const preview = screen.getByRole("region", { name: "Preview, as a reader sees it" });
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.querySelector("strong")?.textContent).toBe("bold");
  });
});
