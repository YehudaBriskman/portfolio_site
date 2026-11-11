import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { setUnread } from "@/services/adminAnnounce";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  setUnread(null);
});

const shell = () => render(<MemoryRouter initialEntries={["/admin/announce"]}><AdminShell title="Announce" section="announce"><p>x</p></AdminShell></MemoryRouter>);

describe("the Announce nav item", () => {
  it("links to /admin/announce and shows the unread count", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/admin/announce" ? json({ ok: true, unread: 3, items: [] }) : json({ ok: true, login: "o" }))));
    shell();
    const link = screen.getByRole("link", { name: /Announce/ });
    expect(link.getAttribute("href")).toBe("/admin/announce");
    await waitFor(() => expect(link.textContent).toContain("3"));
    expect(link.textContent).toContain("3 unread");
  });

  it("follows the page when something is read, and shows nothing at zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/admin/announce" ? json({ ok: true, unread: 2, items: [] }) : json({ ok: true, login: "o" }))));
    shell();
    const link = screen.getByRole("link", { name: /Announce/ });
    await waitFor(() => expect(link.textContent).toContain("2"));
    act(() => setUnread(0));
    expect(link.textContent).not.toMatch(/\d/);
  });

  it("shows no badge when the count cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    shell();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole("link", { name: /Announce/ }).textContent).not.toMatch(/\d/);
  });
});
