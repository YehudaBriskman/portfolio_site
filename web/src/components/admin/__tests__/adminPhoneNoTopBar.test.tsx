import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminShell from "@/components/admin/AdminShell";

/* Admin phone, no top bar (#896): the circle, the back pill and the page's own h1 are all the chrome. */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
function viewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const matches = min ? width >= Number(min[1]) : max ? width <= Number(max[1]) : false;
    return { media: query, matches, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  });
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "o", email: null }) : json({ ok: true, unread: 0, items: [] }))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shell = (props: { backTo?: string; titleH1?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={["/admin/posts/x"]}>
      <AdminShell title="Posts" section="posts" {...props}>
        <p>content</p>
      </AdminShell>
    </MemoryRouter>,
  );

describe("phone: no top bar", () => {
  it("draws no header, no crumbs, no Admin label; the circle is still there", () => {
    viewport(390);
    shell();
    expect(document.querySelector("header.a-top")).toBeNull();
    expect(document.querySelector(".a-crumbs")).toBeNull();
    expect(document.body.querySelector(":scope > [data-floating-circle]")).not.toBeNull();
  });

  it("keeps the back pill, fixed, on a detail screen", () => {
    viewport(390);
    shell({ backTo: "/admin/posts" });
    const pill = document.querySelector("[data-floating-pill]")!;
    expect(pill.getAttribute("href")).toBe("/admin/posts");
    expect(pill.closest("header")).toBeNull();
    expect(pill.closest(".a-float-back")).not.toBeNull();
  });

  it("keeps search, notifications, view site, display and sign out in the circle's panel", () => {
    viewport(390);
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const foot = within(document.querySelector(".a-side") as HTMLElement);
    expect(foot.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(foot.getByRole("button", { name: /Notifications/ })).toBeTruthy();
    expect(foot.getByRole("link", { name: /View site/ })).toBeTruthy();
    expect(foot.getByText("Display settings")).toBeTruthy();
    expect(foot.getByRole("link", { name: "Sign out" })).toBeTruthy();
    expect(foot.getByRole("navigation", { name: "Admin sections" })).toBeTruthy();
  });

  it("a screen with no header of its own gets one visible h1 in main", () => {
    viewport(390);
    shell({ titleH1: true });
    const h = document.getElementById("admin-content")!.querySelectorAll("h1");
    expect(h.length).toBe(1);
    expect(h[0].textContent).toBe("Posts");
  });

  it("tablet and desktop keep their bar", () => {
    viewport(700);
    shell();
    expect(document.querySelector("header.a-top")).not.toBeNull();
    cleanup();
    viewport(1280);
    shell();
    expect(document.querySelector(".a-crumbs")).not.toBeNull();
  });

  it("main clears the circle on a phone, and the back pill is fixed", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(/@media \(max-width: 599px\)\s*\{[^@]*\.a-main\s*\{[^}]*padding-block-start:[^}]*--float-top[^}]*--float-h/s);
    expect(css).toMatch(/\.a-float-back\s*\{[^}]*position:\s*fixed/);
  });
});
