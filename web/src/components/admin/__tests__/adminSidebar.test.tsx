import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminShell from "@/components/admin/AdminShell";

/*
 * The desktop sidebar (#809): one weight scale, one row geometry, a collapse
 * to an icon rail, and the owner's identity shown once.
 */

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
  viewport(1280);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "owner-login", email: null }) : json({ ok: true, unread: 0, items: [] }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const shell = (at = "/admin/marketing", section: "marketing" | "posts" | "overview" = "marketing") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminShell title="T" section={section}>
        <input aria-label="field" />
      </AdminShell>
    </MemoryRouter>,
  );
const nav = () => screen.getByRole("navigation", { name: "Admin sections" });
const app = () => document.querySelector(".a-app")!;
const toggle = () => screen.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });

const css = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("one row geometry", () => {
  it("Marketing is one toggle row like Content, with its overview as the first child", () => {
    shell("/admin");
    expect(within(nav()).queryByRole("link", { name: /^Marketing/ })).toBeNull();
    const group = within(nav()).getByRole("button", { name: /Marketing/ });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    const list = document.getElementById(group.getAttribute("aria-controls")!)!;
    expect(within(list).getAllByRole("link")[0].getAttribute("href")).toBe("/admin/marketing");
    expect(within(nav()).queryByRole("button", { name: /Expand Marketing|Collapse Marketing/ })).toBeNull();
  });

  it("Media and System are plain items, not one-child groups", () => {
    shell("/admin");
    expect(within(nav()).getByRole("link", { name: /^Media/ }).getAttribute("href")).toBe("/admin/media");
    expect(within(nav()).getByRole("link", { name: /^Connected apps/ }).getAttribute("href")).toBe("/admin/connections");
    expect(within(nav()).queryByRole("button", { name: /^Media/ })).toBeNull();
    expect(within(nav()).queryByRole("button", { name: /^System/ })).toBeNull();
  });
});

describe("one weight scale", () => {
  const sheet = css("src/components/ui/SidebarGroup.module.css");
  it("nothing in the sidebar is bold, and the active item is a fill plus a bar", () => {
    expect(sheet).not.toMatch(/font-weight:\s*(?:[6-9]00|bold)/);
    expect(sheet).toMatch(/\.link\[aria-current="page"\][^{]*\{[^}]*background:\s*var\(--a-press\)/);
    expect(sheet).toMatch(/\.link\[aria-current="page"\]::before/);
  });
  it("draws no ring behind a glyph", () => {
    expect(readFileSync(resolve(process.cwd(), "src/components/ui/SidebarGroup.tsx"), "utf8")).not.toMatch(/Ring/);
  });
  it("headings and items use the one 500 weight", () => {
    expect([...sheet.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]).every((v) => v === "500")).toBe(true);
  });
});

describe("the Marketing flyout", () => {
  it("every row, Sender & delivery included, has a glyph and no extra indent", () => {
    localStorage.setItem("admin-nav-collapsed", "1");
    shell("/admin");
    fireEvent.click(document.querySelector('[data-nav-group="marketing"]')!);
    const sender = document.querySelector('[data-nav-id="marketing-sender"]')!;
    expect(sender).toBeTruthy();
    const links = [...sender.closest("ul")!.querySelectorAll("a")];
    expect(links.length).toBeGreaterThan(1);
    for (const a of links) expect(a.querySelector("svg"), a.getAttribute("data-nav-id")!).toBeTruthy();
    expect(css("src/components/ui/SidebarGroup.module.css")).not.toMatch(/\.flyoutList \[data-depth="1"\]/);
  });
});

describe("collapse to an icon rail", () => {
  it("toggles by button, names every item, and remembers the choice", () => {
    shell("/admin/posts", "posts");
    expect(app().getAttribute("data-side")).toBe("full");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle());
    expect(app().getAttribute("data-side")).toBe("rail");
    expect(localStorage.getItem("admin-nav-collapsed")).toBe("1");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(within(nav()).getByRole("link", { name: /^Overview/ })).toBeTruthy();
    fireEvent.click(toggle());
    expect(app().getAttribute("data-side")).toBe("full");
    expect(localStorage.getItem("admin-nav-collapsed")).toBe("0");
  });

  it("starts collapsed when the viewer left it collapsed, and survives a storage that throws", () => {
    localStorage.setItem("admin-nav-collapsed", "1");
    shell("/admin");
    expect(app().getAttribute("data-side")).toBe("rail");
    cleanup();
    const boom = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
    shell("/admin");
    fireEvent.click(toggle());
    expect(app().getAttribute("data-side")).toBe("rail");
  });

  it("Ctrl+B and Cmd+B toggle, except while typing in a field", () => {
    shell("/admin");
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true });
    expect(app().getAttribute("data-side")).toBe("rail");
    fireEvent.keyDown(document.body, { key: "b", metaKey: true });
    expect(app().getAttribute("data-side")).toBe("full");
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "b", ctrlKey: true });
    expect(app().getAttribute("data-side")).toBe("full");
  });

  it("never collapses the phone drawer, whatever was saved", () => {
    viewport(800);
    localStorage.setItem("admin-nav-collapsed", "1");
    shell("/admin");
    expect(app().getAttribute("data-side")).toBe("full");
    expect(screen.queryByRole("button", { name: /sidebar$/ })).toBeNull();
  });

  it("a group is a flyout button: aria-expanded, links inside, Escape closes", async () => {
    localStorage.setItem("admin-nav-collapsed", "1");
    shell("/admin");
    const group = within(nav()).getByRole("button", { name: /Content/ });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    await waitFor(() => expect(group.getAttribute("aria-expanded")).toBe("true"));
    expect(await screen.findByRole("link", { name: "Posts" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(group.getAttribute("aria-expanded")).toBe("false"));
  });

  it("the rail width is one CSS variable, 15rem to 4rem", () => {
    const index = css("src/index.css");
    expect(index).toMatch(/\.a-side\s*\{[^}]*width:\s*var\(--a-side-w/);
    expect(index).toMatch(/\[data-side="rail"\][^{]*\{[^}]*--a-side-w:\s*4rem/);
  });
});

describe("identity once", () => {
  it("the brand is the favicon alone, still named, and the login is not in the bar", async () => {
    shell("/admin");
    const header = document.querySelector("header.a-top")!;
    expect(header.querySelector(".a-brand-name")).toBeNull();
    expect(within(header as HTMLElement).getByRole("link", { name: "Yehuda Briskman" }).getAttribute("href")).toBe("/admin");
    expect(header.textContent).not.toContain("Yehuda Briskman");
    await screen.findByRole("button", { name: "Signed in as owner-login" });
    expect(header.textContent).not.toContain("owner-login");
    expect(document.querySelector(".a-side-who")).toBeNull();
    expect(document.body.textContent).not.toContain("Signed in as owner-login");
  });

  it("one avatar menu holds the login, View site and Sign out", async () => {
    shell("/admin");
    const avatar = await screen.findByRole("button", { name: "Signed in as owner-login" });
    expect(avatar.textContent).toBe("O");
    fireEvent.click(avatar);
    const menu = await screen.findByRole("dialog");
    expect(within(menu).getByText("owner-login")).toBeTruthy();
    expect(within(menu).getByRole("link", { name: /View site/ }).getAttribute("target")).toBe("_blank");
    expect(within(menu).getByRole("link", { name: "Sign out" }).getAttribute("href")).toBe("/oauth2/sign_out");
    expect(document.body.textContent?.split("owner-login").length).toBe(2);
    expect(within(document.querySelector("header.a-top") as HTMLElement).queryByRole("link", { name: /View site/ })).toBeNull();
  });
});
