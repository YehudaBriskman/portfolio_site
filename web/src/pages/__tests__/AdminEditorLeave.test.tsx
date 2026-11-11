import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";

const post = (slug: string) => ({
  _rev: "1-a", slug, title: `Title ${slug}`, subtitle: null, excerpt: "", body: "", status: "draft" as const,
  publishedAt: null, updatedAt: "2026-11-01T10:00:00.000Z", tags: [], collection: "site", coverImage: null,
  links: [], readingMinutes: 1, featured: null,
});

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return {
    ...real,
    admin: {
      ...real.admin,
      get: mocks.get,
      saveDraft: mocks.saveDraft,
      list: async () => [],
      collections: async () => [],
    },
  };
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

function mount() {
  return render(
    <MemoryRouter initialEntries={["/admin/posts/aaa"]}>
      <Harness />
      <Routes>
        <Route path="/admin/posts/:slug" element={<AdminEditor />} />
        <Route path="/elsewhere" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminEditor leaving", () => {
  it("sends a pending edit when the editor unmounts inside the autosave debounce", async () => {
    mocks.get.mockImplementation(async (s: string) => post(s));
    mocks.saveDraft.mockImplementation(async (s: string) => post(s));
    mount();
    const title = await screen.findByDisplayValue("Title aaa");
    fireEvent.change(title, { target: { value: "Edited" } });
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("to-elsewhere"));
    await screen.findByText("elsewhere");
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveDraft.mock.calls[0][1]).toMatchObject({ title: "Edited" });
  });

  it("ignores a save response that lands after the editor moved to another post", async () => {
    let finish!: (p: ReturnType<typeof post>) => void;
    mocks.get.mockImplementation(async (s: string) => post(s));
    mocks.saveDraft.mockImplementation(() => new Promise((r) => (finish = r)));
    mount();
    fireEvent.change(await screen.findByDisplayValue("Title aaa"), { target: { value: "Edited" } });
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    fireEvent.click(screen.getByText("to-bbb"));
    await screen.findByDisplayValue("Title bbb");
    finish(post("aaa"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("path")).toHaveTextContent("/admin/posts/bbb");
  });
});
