import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import AdminAnnounce from "@/pages/AdminAnnounce";
import { DEFAULT_SENDER } from "@/components/admin/announce/sender/defaults";
import { DEFAULT_NOTIFY } from "@/components/admin/announce/notify/defaults";
import { SETTINGS_SECTIONS } from "@/components/admin/adminNav";

/*
 * Marketing > Settings in the sidebar lists the screen's real sections (#852), not one. Each is a deep link
 * (?tab=settings&section=<id>) with the section's own existing title; the phone drawer carries the same
 * tree; the panel opens and scrolls to the section the address names.
 */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const settings = () => ({
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: [],
  signature: "",
  channels: ["linkedin", "email"],
  templates: { en: {}, he: {} },
  snippets: [],
  library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  sender: { ...DEFAULT_SENDER, footerIdentity: "Yehuda", identityEmail: "me@example.com", testRecipients: ["me@example.com"] },
  notify: DEFAULT_NOTIFY,
});

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
  viewport(1440);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings: settings() });
      return json({ ok: false });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const nav = () => screen.getByRole("navigation", { name: "Admin sections" });
const shell = (at: string) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminShell title="T" section="marketing">
        <p>x</p>
      </AdminShell>
    </MemoryRouter>,
  );

const TITLES: Record<string, string> = {
  mail: "Email me",
  channels: "Channels",
  wording: "Hashtags & signature",
  signature: "Signature image",
  sender: "Sender & delivery",
  limits: "Sending limits",
  texts: "Subscriber emails",
  notices: "Alert details",
  advanced: "Advanced",
};

describe("Marketing > Settings in the sidebar", () => {
  it("lists every section of the Settings screen, each a deep link under its existing title", () => {
    shell("/admin/marketing?tab=settings");
    expect([...SETTINGS_SECTIONS]).toEqual(Object.keys(TITLES));
    for (const [id, title] of Object.entries(TITLES)) {
      const link = within(nav()).getByRole("link", { name: title });
      expect(link.getAttribute("href"), id).toBe(`/admin/marketing?tab=settings&section=${id}`);
    }
  });

  it("marks the section the address names, and Settings itself when it names none", () => {
    shell("/admin/marketing?tab=settings&section=limits");
    expect(within(nav()).getByRole("link", { name: "Sending limits" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("link", { name: /^Settings/ }).getAttribute("aria-current")).toBeNull();
    cleanup();
    shell("/admin/marketing?tab=settings");
    expect(within(nav()).getByRole("link", { name: /^Settings/ }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("link", { name: "Sending limits" }).getAttribute("aria-current")).toBeNull();
  });

  it("is the same tree in the phone drawer", () => {
    viewport(390);
    shell("/admin/marketing?tab=settings");
    for (const title of Object.values(TITLES)) expect(within(nav()).getByRole("link", { name: title })).toBeTruthy();
  });

  it("reads in Hebrew with the existing Hebrew titles", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    shell("/admin/marketing?tab=settings");
    const links = [...document.querySelectorAll(".a-side-nav a")];
    const text = links.map((a) => a.textContent).join("|");
    for (const en of Object.values(TITLES)) expect(text).not.toContain(en);
    expect(links.length).toBeGreaterThan(15);
  });

  it("adds no wording: every title is one the Settings screen already prints", () => {
    shell("/admin/marketing?tab=settings");
    const labels = SETTINGS_SECTIONS.map((id) => within(nav()).getByRole("link", { name: TITLES[id] }).textContent);
    expect(new Set(labels).size).toBe(SETTINGS_SECTIONS.length);
  });
});

describe("the panel follows the address on a desktop", () => {
  it("opens Advanced and the closed section the address names, and scrolls it into view", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <MemoryRouter initialEntries={["/admin/marketing?tab=settings&section=limits"]}>
        <AdminAnnounce />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('[data-testid="sec-limits"]')).toBeTruthy());
    await waitFor(() => expect((document.querySelector('[data-testid="sec-limits"]') as HTMLDetailsElement).open).toBe(true));
    expect((document.querySelector('[data-testid="advanced"]') as HTMLDetailsElement).open).toBe(true);
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts.at(-1)).toBe(document.querySelector('[data-testid="sec-limits"]'));
  });

  it("scrolls to an Everyday section too (channels)", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <MemoryRouter initialEntries={["/admin/marketing?tab=settings&section=channels"]}>
        <AdminAnnounce />
      </MemoryRouter>,
    );
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect((scroll.mock.contexts.at(-1) as HTMLElement).getAttribute("data-section")).toBe("channels");
  });

  it("follows a sidebar click without a reload: Sender then Alert details", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <MemoryRouter initialEntries={["/admin/marketing?tab=settings"]}>
        <AdminAnnounce />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('[data-testid="advanced"]')).toBeTruthy());
    fireEvent.click(within(nav()).getByRole("link", { name: "Alert details" }));
    await waitFor(() => expect(within(nav()).getByRole("link", { name: "Alert details" }).getAttribute("aria-current")).toBe("page"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
