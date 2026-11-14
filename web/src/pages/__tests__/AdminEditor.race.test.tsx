import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";

/* a response for the post you LEFT overwrites the post you are on. */

const post = (slug: string) => ({
  _rev: "1-a", slug, title: `Title ${slug}`, subtitle: null, excerpt: "", body: "", status: "draft" as const,
  publishedAt: null, updatedAt: "2026-11-01T10:00:00.000Z", tags: [], collection: "site", coverImage: null,
  links: [], readingMinutes: 1, featured: null,
});

const mocks = vi.hoisted(() => ({ get: vi.fn(), saveDraft: vi.fn() }));
vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return { ...real, admin: { ...real.admin, get: mocks.get, saveDraft: mocks.saveDraft, list: async () => [], collections: async () => [] } };
});
afterEach(() => (cleanup(), vi.clearAllMocks()));

function Harness() {
  const nav = useNavigate();
  return (<><output data-testid="path">{useLocation().pathname}</output><button onClick={() => nav("/admin/posts/bbb")}>to-bbb</button></>);
}

it("out-of-order get(): the late answer for 'aaa' must not replace the form of 'bbb'", async () => {
  let releaseA: (p: ReturnType<typeof post>) => void = () => {};
  mocks.get.mockImplementation((s: string) => (s === "aaa" ? new Promise((r) => (releaseA = r)) : Promise.resolve(post(s))));
  render(
    <MemoryRouter initialEntries={["/admin/posts/aaa"]}>
      <Harness />
      <Routes><Route path="/admin/posts/:slug" element={<AdminEditor />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("to-bbb"));
  await waitFor(() => expect((screen.getByLabelText(/^Title$/i) as HTMLInputElement).value).toBe("Title bbb"));
  await act(async () => releaseA(post("aaa")));
  expect(screen.getByTestId("path").textContent).toBe("/admin/posts/bbb");
  expect((screen.getByLabelText(/^Title$/i) as HTMLInputElement).value).toBe("Title bbb");
});
