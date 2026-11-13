import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminShell from "@/components/admin/AdminShell";
import AdminAnnounce from "@/pages/AdminAnnounce";
import { ADMIN_NAV_TARGETS } from "@/components/admin/adminNav";

/*
 * The admin's nav is a tree (#675): Marketing carries its five sections (and
 * Settings its own), the rest are grouped Content / Media / Site / System. On a
 * phone the drawer carries Marketing's sections and the tab strip is gone; at
 * 600px and up the tabs stay.
 */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function stubFetch(unread = 0) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/announce") return json({ ok: true, unread, items: [] });
      if (url === "/api/admin/announce/settings")
        return json({ ok: true, exists: false, _rev: null, updatedAt: null, settings: { enabled: true, email: { enabled: false, events: ["post", "release"] }, hashtags: [], signature: "", channels: ["linkedin", "instagram", "email", "gmail", "x"], templates: { en: {}, he: {} } } });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [] });
      if (url.startsWith("/api/admin/audience/contacts?")) return json({ ok: true, contacts: [], nextCursor: null });
      return json({ ok: true });
    }),
  );
}

/** matchMedia that answers for a viewport this wide. */
function viewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const matches = max ? width <= Number(max[1]) : min ? width >= Number(min[1]) : false;
    return { media: query, matches, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  });
}

beforeEach(() => {
  localStorage.clear();
  stubFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const shell = (at: string, section: "marketing" | "posts" | "overview" = "marketing") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminShell title="T" section={section}>
        <p>x</p>
      </AdminShell>
    </MemoryRouter>,
  );

const nav = () => screen.getByRole("navigation", { name: "Sections" });

describe("the nav tree", () => {
  it("Marketing carries its five sections, each a deep link the pages already read", () => {
    shell("/admin/marketing");
    const n = within(nav());
    const href = (name: RegExp) => n.getByRole("link", { name }).getAttribute("href");
    expect(href(/^Inbox/)).toBe("/admin/marketing");
    expect(href(/^Audience/)).toBe("/admin/marketing?tab=audience");
    expect(href(/^Campaigns/)).toBe("/admin/marketing?tab=campaigns");
    expect(href(/^Library/)).toBe("/admin/marketing?tab=library");
    expect(href(/^Settings/)).toBe("/admin/marketing?tab=settings");
  });

  it("opens Settings to Sender & delivery on the deep link, and marks it current", () => {
    shell("/admin/marketing?tab=settings&section=sender");
    const current = within(nav()).getByRole("link", { name: "Sender & delivery" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.getAttribute("href")).toBe("/admin/marketing?tab=settings&section=sender");
  });

  it("marks the tab the URL names, and Inbox when it names none", () => {
    shell("/admin/marketing?tab=campaigns");
    expect(within(nav()).getByRole("link", { name: /^Campaigns/ }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("link", { name: /^Inbox/ }).getAttribute("aria-current")).toBeNull();
    cleanup();
    shell("/admin/marketing");
    expect(within(nav()).getByRole("link", { name: /^Inbox/ }).getAttribute("aria-current")).toBe("page");
  });

  it("groups the rest as Content, Media, Site and System, shut until the route is in one", () => {
    shell("/admin/marketing");
    for (const g of ["Content", "Media", "Site", "System"]) {
      expect(within(nav()).getByRole("button", { name: new RegExp(g) }).getAttribute("aria-expanded")).toBe("false");
    }
    expect(within(nav()).queryByRole("link", { name: "Posts" })).toBeNull();
  });

  it("opens the group of an editor route and marks its section current", () => {
    shell("/admin/posts/hello", "posts");
    expect(within(nav()).getByRole("link", { name: "Posts" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("button", { name: /Content/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("Overview is a plain link at the top", () => {
    shell("/admin", "overview");
    expect(within(nav()).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  });

  it("rolls the unread count up to the Marketing row and the Inbox row", async () => {
    stubFetch(4);
    shell("/admin/marketing");
    await waitFor(() => expect(within(nav()).getByRole("link", { name: /^Marketing/ }).textContent).toContain("4 unread"));
    expect(within(nav()).getByRole("link", { name: /^Inbox/ }).textContent).toContain("4 unread");
  });

  it("reads in Hebrew with no English group left", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    shell("/admin/marketing");
    const text = document.querySelector(".a-side-nav")?.textContent ?? "";
    expect(text).not.toBe("");
    for (const en of ["Content", "Media", "System", "Inbox", "Audience", "Campaigns", "Library", "Expand", "Collapse"]) expect(text).not.toContain(en);
    expect(document.querySelectorAll(".a-side-nav a").length).toBeGreaterThan(5);
  });

  it("every leaf address is a real admin route in App.tsx", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(ADMIN_NAV_TARGETS.length).toBeGreaterThan(10);
    for (const p of ADMIN_NAV_TARGETS) expect(app, p).toContain(`path="${p}"`);
  });
});

describe("the Marketing tab strip", () => {
  const hub = (at = "/admin/marketing") => render(<MemoryRouter initialEntries={[at]}><AdminAnnounce /></MemoryRouter>);

  it("is gone on a phone: the drawer carries the sections", () => {
    viewport(390);
    hub();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(within(nav()).getByRole("link", { name: /^Campaigns/ })).toBeTruthy();
  });

  it("is unchanged at 600px and up", () => {
    viewport(600);
    hub();
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(5);
    viewport(1440);
    cleanup();
    hub();
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(5);
  });

  it("still opens /admin/marketing?tab=settings on desktop and on a phone", async () => {
    viewport(1440);
    hub("/admin/marketing?tab=settings");
    expect(screen.getByRole("tab", { name: /Settings/ }).getAttribute("aria-selected")).toBe("true");
    cleanup();
    viewport(390);
    hub("/admin/marketing?tab=settings");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(await screen.findByRole("heading", { level: 2, name: /Announce settings/ })).toBeTruthy();
    expect(within(nav()).getByRole("link", { name: /^Settings/, current: "page" })).toBeTruthy();
  });

  it("follows a drawer link without a reload: Campaigns after Inbox", async () => {
    viewport(390);
    hub();
    fireEvent.click(within(nav()).getByRole("link", { name: /^Campaigns/ }));
    await waitFor(() => expect(within(nav()).getByRole("link", { name: /^Campaigns/ }).getAttribute("aria-current")).toBe("page"));
  });
});
