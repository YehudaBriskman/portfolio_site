import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminShell from "@/components/admin/AdminShell";
import AdminLayout from "@/components/admin/AdminLayout";

/*
 * The sidebar outlives a navigation (#852). AdminShell used to be rendered inside each page, so every
 * route change unmounted the whole sidebar and its scroll container came back at the top. The shell is
 * now one layout route; a page only publishes its title and puts its content into <main>.
 */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "owner", email: null }) : json({ ok: true, unread: 0, items: [] }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const Posts = () => (
  <AdminShell title="Posts" section="posts" counts={{ posts: 3 }}>
    <p>posts page</p>
  </AdminShell>
);
const Areas = () => (
  <AdminShell title="Areas" section="areas">
    <p>areas page</p>
  </AdminShell>
);

const app = (at = "/admin/posts") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin/posts" element={<Posts />} />
          <Route path="/admin/areas" element={<Areas />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
const nav = () => screen.getByRole("navigation", { name: "Admin sections" });

describe("the sidebar persists across navigation", () => {
  it("keeps the same scroll container node and its scrollTop when the route changes", async () => {
    app();
    const side = document.querySelector(".a-side") as HTMLElement;
    const navEl = nav();
    side.scrollTop = 137;
    expect(side.scrollTop).toBe(137);

    fireEvent.click(within(nav()).getByRole("link", { name: "Areas" }));
    await screen.findByText("areas page");

    expect(document.querySelector(".a-side")).toBe(side);
    expect(nav()).toBe(navEl);
    expect(side.scrollTop).toBe(137);
  });

  it("still swaps the page content, the crumbs and the current row", async () => {
    app();
    expect(screen.getByText("posts page")).toBeTruthy();
    expect(within(nav()).getByRole("link", { name: /^Posts/ }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(nav()).getByRole("link", { name: "Areas" }));
    await waitFor(() => expect(screen.queryByText("posts page")).toBeNull());
    expect(screen.getByText("areas page")).toBeTruthy();
    expect(within(nav()).getByRole("link", { name: "Areas" }).getAttribute("aria-current")).toBe("page");
    expect(document.querySelector(".a-crumbs")!.textContent).toContain("Areas");
    expect(document.querySelector("main#admin-content")!.contains(screen.getByText("areas page"))).toBe(true);
    expect(document.querySelectorAll("main#admin-content")).toHaveLength(1);
  });

  it("keeps a group the owner opened, open, across a navigation", async () => {
    app();
    const site = within(nav()).getByRole("button", { name: /Site/ });
    fireEvent.click(site);
    expect(site.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(within(nav()).getByRole("link", { name: "Areas" }));
    await screen.findByText("areas page");
    expect(within(nav()).getByRole("button", { name: /Site/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("measures a bottom bar a page publishes after the frame mounted (focus stays clear of it, 2.4.11)", () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    const Editor = () => (
      <AdminShell title="Posts" section="posts" bottomBar={<button type="button">Save</button>}>
        <p>editor</p>
      </AdminShell>
    );
    render(
      <MemoryRouter initialEntries={["/admin/posts"]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/posts" element={<Editor />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(observed.some((el) => el.classList.contains("a-bottom"))).toBe(true);
  });

  it("App.tsx mounts every /admin route under the one layout route", () => {
    const src = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(src).toMatch(/<Route element=\{<Suspense fallback=\{<RouteFallback \/>\}><AdminLayout \/><\/Suspense>\}>/);
    const at = src.indexOf("<AdminLayout />");
    const adminRoutes = [...src.matchAll(/<Route path="\/admin[^"]*"/g)].filter((m) => !/collections/.test(m[0]));
    expect(adminRoutes.length).toBeGreaterThan(8);
    for (const m of adminRoutes) expect(m.index!, m[0]).toBeGreaterThan(at);
  });
});
