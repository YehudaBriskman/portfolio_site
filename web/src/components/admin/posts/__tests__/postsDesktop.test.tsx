import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import ToastHost from "@/components/ui/ToastHost";
import { __resetToasts } from "@/lib/toast";
import Admin from "@/pages/Admin";
import AdminAreas from "@/pages/AdminAreas";

/*
 * Posts and Areas on a desktop (#846, workstream S6 of #830): one DataTable each. The status is said once (the
 * tab, or the group header on All), never as a pill on every row; the language pair and the time are columns;
 * a row has one primary (Edit) and a More menu whose destructive entry asks first, in words that name the outcome.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const seo = { title: null, description: null, canonical: null, noindex: false };
const post = (slug: string, o: Record<string, unknown> = {}) => ({
  _id: `post:${slug}`, _rev: `1-${slug}`, slug, title: `Title ${slug}`, subtitle: null, excerpt: "e", body: "body", status: "published",
  publishedAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z", tags: [], collection: "site", coverImage: null,
  links: [], readingMinutes: 3, featured: null, seo, he: null, ...o,
});
const posts = [
  post("one", { title: "Alpha published", updatedAt: "2026-11-13T10:00:00.000Z" }),
  post("two", { title: "Bravo draft", status: "draft", publishedAt: null }),
  post("three", { title: "Charlie changes", draft: { ...post("three"), title: "Charlie (new)" } }),
  post("four", { title: "Delta archived", status: "archived" }),
];
const area = (slug: string, o: Record<string, unknown> = {}) => ({
  slug, title: `Area ${slug}`, tagline: "", kind: "project", repo: null, stats: null, description: "d", coverImage: null, links: [], order: 0, status: "published", _rev: `1-${slug}`, ...o,
});
const areas = [area("site", { kind: "site", order: 0 }), area("windom", { order: 1 }), area("old", { order: 2, status: "hidden" })];

let calls: { url: string; method: string }[];
function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}
const mount = (path: string, el: ReactElement) => render(<MemoryRouter initialEntries={[path]}>{el}<Where /><ToastHost /></MemoryRouter>);

beforeEach(() => {
  calls = [];
  /* jsdom has no <dialog>.showModal: the stand-ins only flip `open`. */
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  try {
    window.localStorage.clear();
  } catch {
    /* none */
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/posts" && method === "GET") return json({ ok: true, items: posts });
      if (url === "/api/admin/collections" && method === "GET") return json({ ok: true, items: areas });
      if (url.startsWith("/api/admin/translations")) return json({ ok: true, counts: { missing: 0, draft: 0, stale: 0, unverified: 0, translated: 0 }, coverage: 0, items: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => {
  __resetToasts();
  cleanup();
  vi.unstubAllGlobals();
});

describe("Posts on a desktop", () => {
  it("is a data grid with a header, and says each status once as a group, not as a pill per row", async () => {
    mount("/admin/posts", <Admin />);
    const grid = await screen.findByRole("grid", { name: "Posts" });
    await within(grid).findByText("Alpha published");
    expect(within(grid).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(4);
    expect(grid.querySelectorAll(".a-pill").length).toBe(0);
    const groups = within(grid).getAllByRole("rowheader").map((g) => g.textContent);
    expect(groups).toEqual(["Published 2", "Draft 1", "Archived 1"]);
  });

  it("tabs filter by status, write it to the address, and the strip is a tablist with counts", async () => {
    mount("/admin/posts", <Admin />);
    await screen.findByRole("grid");
    const tab = await screen.findByRole("tab", { name: /^Drafts/ });
    expect(screen.getAllByRole("tab").length).toBe(4);
    fireEvent.click(tab);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("status=draft"));
    expect(screen.queryByText("Alpha published")).toBeNull();
    expect(screen.getByText("Bravo draft")).toBeTruthy();
    expect(screen.queryAllByRole("rowheader").length).toBe(0); // the tab already says it
  });

  it("searches locally and says there is nothing, with one way out", async () => {
    mount("/admin/posts?q=zzzz", <Admin />);
    await screen.findByText("Nothing matches those filters");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Alpha published")).toBeTruthy();
  });

  it("archives only after a confirm that names the outcome, and Keep leaves it alone", async () => {
    mount("/admin/posts", <Admin />);
    const row = (await screen.findByText("Alpha published")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Archive", hidden: true })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Keep", hidden: true })).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive", hidden: true }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/admin/posts/one")).toBe(true));
  });

  it("an archived post offers no Archive, and only a published one offers View live", async () => {
    mount("/admin/posts?status=archived", <Admin />);
    const row = (await screen.findByText("Delta archived")).closest("tr") as HTMLElement;
    expect(within(row).queryByRole("button", { name: "More actions" })).toBeNull();
  });
});

describe("Areas on a desktop", () => {
  it("is a grid with no Order column and no Published pill, in the order the site shows", async () => {
    mount("/admin/areas", <AdminAreas />);
    const grid = await screen.findByRole("grid", { name: "Areas" });
    await within(grid).findByText("Area windom");
    expect(within(grid).queryByRole("columnheader", { name: "Order" })).toBeNull();
    expect(grid.querySelectorAll(".a-pill").length).toBe(0);
    const names = within(grid).getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(names[0]).toContain("Area site");
    expect(names[2]).toContain("Area old");
  });

  it("hides an area only after a confirm, and a hidden area offers no Hide", async () => {
    mount("/admin/areas", <AdminAreas />);
    const row = (await screen.findByText("Area windom")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Hide" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide", hidden: true }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/admin/collections/windom")).toBe(true));
    const old = screen.getByText("Area old").closest("tr") as HTMLElement;
    expect(within(old).queryByRole("button", { name: "More actions" })).toBeNull();
  });
});
