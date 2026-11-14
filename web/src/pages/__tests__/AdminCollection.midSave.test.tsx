import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminCollection from "@/pages/AdminCollection";

/* An area edited while its save is in flight is not "saved": the newer text is only in the browser. */

const area = {
  slug: "site", title: "Site", tagline: "", kind: "site", description: "", links: [], order: 50, status: "published", _rev: "1-a",
};
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return { ...real, admin: { ...real.admin, collections: async () => [area], saveCollection: mocks.save } };
});
afterEach(() => (cleanup(), vi.clearAllMocks()));

it("text typed while Save is in flight keeps the Unsaved state", async () => {
  let finish!: (v: unknown) => void;
  mocks.save.mockImplementation(() => new Promise((r) => (finish = r)));
  render(
    <MemoryRouter initialEntries={["/admin/areas/site"]}>
      <Routes><Route path="/admin/areas/:slug" element={<AdminCollection />} /></Routes>
    </MemoryRouter>,
  );
  const title = (await screen.findByDisplayValue("Site")) as HTMLInputElement;
  fireEvent.change(title, { target: { value: "Site 2" } });
  fireEvent.click(screen.getAllByRole("button", { name: /^save/i })[0]);
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  fireEvent.change(title, { target: { value: "Site 2 and more" } });
  await act(async () => finish({ slug: "site", _rev: "2-b" }));
  expect(title.value).toBe("Site 2 and more");
  expect(screen.queryAllByText(/^Saved/).length).toBe(0);
  expect(screen.getAllByText("Unsaved").length).toBeGreaterThan(0);
});
