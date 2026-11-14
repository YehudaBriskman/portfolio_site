import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";

/* B-h3-11: a deep link to a post that does not exist opens the NEW-note form with "The draft was not saved". */

vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return { ...real, admin: { ...real.admin, get: async () => { throw new Error("Not Found"); }, list: async () => [], collections: async () => [] } };
});
afterEach(cleanup);

it("a missing post says it is missing, not 'The draft was not saved'", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/posts/gone"]}>
      <Routes><Route path="/admin/posts/:slug" element={<AdminEditor />} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.body.textContent).toMatch(/Not Found/i));
  expect(document.body.textContent).not.toMatch(/draft was not saved/i);
  expect(document.body.textContent).not.toMatch(/Choose the title and the address/i);
  expect(document.body.querySelector("a[href='/admin/posts']")).not.toBeNull();
});

it("a missing area says it is missing and links back, not an empty form", async () => {
  const { default: AdminCollection } = await import("@/pages/AdminCollection");
  render(
    <MemoryRouter initialEntries={["/admin/areas/gone"]}>
      <Routes><Route path="/admin/areas/:slug" element={<AdminCollection />} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.body.textContent).toMatch(/Not found/i));
  expect(document.body.querySelector("a[href='/admin/areas']")).not.toBeNull();
  expect(document.body.querySelector("input")).toBeNull();
});
