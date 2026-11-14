import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";
import { AdminValidationError } from "@/services/admin";

/*
 * Regression: the post editor. Every test names the bug id it proves and is
 * written to PASS once the bug is fixed (it fails today).
 */

const post = (slug: string, over: Record<string, unknown> = {}) => ({
  _rev: "1-a", slug, title: `Title ${slug}`, subtitle: null, excerpt: "", body: "english body", status: "draft" as const,
  publishedAt: null, updatedAt: "2026-11-01T10:00:00.000Z", tags: [], collection: "site", coverImage: null,
  links: [], readingMinutes: 1, featured: null, seo: { title: null, description: null, canonical: null, noindex: false },
  he: { title: "", subtitle: "", excerpt: "", body: "גוף עברי" }, ...over,
});

const mocks = vi.hoisted(() => ({
  get: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(), upload: vi.fn(),
}));

vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return {
    ...real,
    admin: {
      ...real.admin,
      get: mocks.get, saveDraft: mocks.saveDraft, publish: mocks.publish,
      list: async () => [], collections: async () => [],
    },
  };
});
vi.mock("@/services/media", async (orig) => {
  const real = await orig<typeof import("@/services/media")>();
  return { ...real, media: { ...real.media, upload: mocks.upload, list: async () => [] } };
});

afterEach(() => vi.clearAllMocks());

function Harness() {
  const nav = useNavigate();
  return (
    <>
      <output data-testid="path">{useLocation().pathname}</output>
      <button onClick={() => nav("/elsewhere")}>to-elsewhere</button>
      <button onClick={() => nav("/admin/posts/bbb")}>to-bbb</button>
    </>
  );
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
      <Routes>
        <Route path="/admin/posts/:slug" element={<AdminEditor />} />
        <Route path="/elsewhere" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("post editor ", () => {
  /* B-h4-1 */
  it("an upload that finishes after the language was switched must not write into the other body", async () => {
    mocks.get.mockImplementation(async (s: string) => post(s));
    let finish!: (v: unknown) => void;
    mocks.upload.mockImplementation(() => new Promise((r) => (finish = r)));
    mount("/admin/posts/aaa");
    const body = (await screen.findByDisplayValue("english body")) as HTMLTextAreaElement;
    body.focus();
    body.setSelectionRange(0, 0);
    const file = new File([new Uint8Array([1, 2, 3])], "pic.png", { type: "image/png" });
    fireEvent.paste(body, { clipboardData: { files: [file], types: ["Files"] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    // The placeholder is in the English body now.
    await waitFor(() => expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toContain("]()"));
    // Switch the body to Hebrew while the picture is still uploading.
    fireEvent.click(screen.getByRole("button", { name: /hebrew|עברית/i, pressed: false }));
    await screen.findByDisplayValue("גוף עברי");
    finish({ alt: "pic", url: "/media/pic.png" });
    await new Promise((r) => setTimeout(r, 50));
    // Back to English: the English body must still be the English text (plus the picture), not the Hebrew text.
    fireEvent.click(screen.getByRole("button", { name: /^english|אנגלית/i }));
    await screen.findByRole("button", { name: /^english/i, pressed: true });
    await waitFor(() => expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toContain("english body"));
    const en = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(en.value).not.toContain("גוף עברי");
    expect(en.value).not.toContain("]()");
  });

  /* B-h4-2 */
  it("leaving a NEW note (route change / Back) with typed text must flush or ask, not silently drop it", async () => {
    mount("/admin/posts/new");
    const title = await screen.findByLabelText(/^Title$/i);
    fireEvent.change(title, { target: { value: "My long new note" } });
    const asked = vi.spyOn(window, "confirm").mockReturnValue(true);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    fireEvent.click(screen.getByText("to-elsewhere"));
    await screen.findByText("elsewhere");
    await new Promise((r) => setTimeout(r, 20));
    // Either the draft was sent on the way out, or something asked first. (The tab-close guard alone does not cover Back / in-app routing.)
    expect(mocks.saveDraft.mock.calls.length > 0 || asked.mock.calls.length > 0).toBe(true);
    void beforeUnload;
  });

  /* B-h4-3 */
  it("a save that FAILS after the editor moved to another post must not mark the other post as failed", async () => {
    mocks.get.mockImplementation(async (s: string) => post(s));
    let fail!: (e: Error) => void;
    mocks.saveDraft.mockImplementation(() => new Promise((_r, rej) => (fail = rej)));
    mount("/admin/posts/aaa");
    fireEvent.change(await screen.findByDisplayValue("Title aaa"), { target: { value: "Edited" } });
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    fireEvent.click(screen.getByText("to-bbb"));
    await screen.findByDisplayValue("Title bbb");
    fail(new Error("network down"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryAllByText(/network down/)).toHaveLength(0);
  });

  /* B-h4-4 */
  it("moving to another post inside the debounce must not leave the new post 'dirty' and re-save it unedited", async () => {
    mocks.get.mockImplementation(async (s: string) => post(s));
    mocks.saveDraft.mockImplementation(async (s: string) => post(s));
    mount("/admin/posts/aaa");
    fireEvent.change(await screen.findByDisplayValue("Title aaa"), { target: { value: "Edited" } });
    fireEvent.click(screen.getByText("to-bbb"));
    await screen.findByDisplayValue("Title bbb");
    await new Promise((r) => setTimeout(r, 1900));
    const saved = mocks.saveDraft.mock.calls.map((c) => c[0]);
    // The edit made in aaa must have been sent to aaa (not dropped), and nobody typed in bbb so bbb must not be written.
    expect(saved).toEqual(["aaa"]);
  }, 10_000);

  /* B-h4-5 */
  it("after a publish, the next review must start with an empty 'what changed' note and scope both", async () => {
    const pub = post("aaa", { status: "published" });
    mocks.get.mockImplementation(async () => pub);
    mocks.publish.mockImplementation(async (_s: string, c: Record<string, unknown>) => ({ ...pub, title: c.title as string, _rev: "2-b" }));
    mocks.saveDraft.mockImplementation(async (_s: string, c: Record<string, unknown>) => ({ ...pub, draft: c, _rev: "2-b" }));
    mount("/admin/posts/aaa");
    fireEvent.change(await screen.findByDisplayValue("Title aaa"), { target: { value: "First edit" } });
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const review = () => screen.getByRole("button", { name: /^review and publish$/i });
    await waitFor(() => expect(review()).toBeEnabled());
    fireEvent.click(review());
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/what changed/i), { target: { value: "Fixed a typo" } });
    fireEvent.click(within(dlg).getByLabelText(/hebrew only|only hebrew/i));
    fireEvent.click(within(dlg).getByRole("button", { name: /^publish$/i }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(mocks.publish.mock.calls[0][1]).toMatchObject({ changeNote: "Fixed a typo", scope: "he" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // A second, unrelated edit and a second review.
    fireEvent.change(screen.getByDisplayValue("First edit"), { target: { value: "Second edit" } });
    await waitFor(() => expect(review()).toBeEnabled(), { timeout: 4000 });
    fireEvent.click(review());
    const dlg2 = await screen.findByRole("dialog");
    expect((within(dlg2).getByLabelText(/what changed/i) as HTMLInputElement).value).toBe("");
    expect((within(dlg2).getByLabelText(/hebrew only|only hebrew/i) as HTMLInputElement).checked).toBe(false);
  }, 15_000);

  /* B-h4-6 */
  it("a validation error inside a collapsed section (SEO) must open that section", async () => {
    mocks.get.mockImplementation(async (s: string) => post(s));
    mocks.saveDraft.mockImplementation(async () => {
      throw new AdminValidationError({ seo: "Canonical must be an https address" });
    });
    mount("/admin/posts/aaa");
    fireEvent.change(await screen.findByDisplayValue("Title aaa"), { target: { value: "Edited" } });
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    // The SEO <details> holds the invalid field (aria-invalid) and must be open so it can be seen.
    await waitFor(() => expect(document.querySelector("input[aria-invalid=true]")).not.toBeNull());
    const inv = document.querySelector("input[aria-invalid=true]")!;
    expect(inv.closest("details")!.open).toBe(true);
  }, 10_000);
});
