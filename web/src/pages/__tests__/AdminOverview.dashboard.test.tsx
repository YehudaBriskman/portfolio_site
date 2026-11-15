import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminOverview from "@/pages/AdminOverview";
import { json, lang, phone, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * D1 (#858): the Overview is a dashboard. KPI tiles and "needs you" on top,
 * collapsible rows of panels below, each panel expandable. Same screen on a
 * phone (the grid is one column there). Nothing is drawn that the API did not
 * give: a sparkline needs real dates, a failed source shows a dash.
 */

const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const post = (slug: string, o: object = {}) => ({
  slug, title: `Title of ${slug}`, subtitle: null, excerpt: "", body: "", status: "published", publishedAt: ago(5),
  updatedAt: ago(4), tags: [], readingMinutes: 2, ...o,
});
const POSTS = [
  post("alpha", { publishedAt: ago(90) }),
  post("beta", { status: "draft", publishedAt: null, updatedAt: ago(2) }),
  post("gamma", { status: "draft", publishedAt: null, updatedAt: ago(3) }),
  post("delta", { draft: { title: "Delta v2" }, draftSavedAt: ago(1), publishedAt: ago(10) }),
];
const grant = (id: string, client: string, o: object = {}) => ({
  id, client, scopes: ["mcp:read"], login: "owner", createdAt: ago(20), lastUsedAt: ago(1), expiresAt: ago(-30), revokedAt: null, revokedReason: null, status: "active", ...o,
});
const GRANTS = [grant("g1", "Claude Code"), grant("g2", "Old client", { status: "revoked", revokedAt: ago(5) })];
const file = (id: string, created: number, used = true) => ({
  id, name: `${id}.png`, alt: id, caption: "", credit: "", kind: "image", format: "png", mime: "image/png", width: 1, height: 1, bytes: 1000,
  createdAt: ago(created), updatedAt: ago(created), url: `/m/${id}`, preview: null, file: null, srcset: { avif: "", webp: "" }, usedBy: used ? [{ type: "post", id: "alpha", title: "A", slug: "alpha", field: "cover" }] : [],
});
const MEDIA = [file("m1", 100), file("m2", 40, false), file("m3", 1)];
const campaign = (id: string, status: string, counters: object) => ({
  id, _rev: "1-a", name: `Campaign ${id}`, subject: "", preheader: "", bodyText: "", blocks: null, groups: [], lang: "all", topic: null, status, sendAt: null,
  counters: { queued: 10, sent: 8, failed: 2, suppressed: 0, ...counters }, eventId: null, pausedReason: null, testedAt: null, capOverride: null,
  startedAt: null, finishedAt: null, createdAt: ago(9), updatedAt: ago(8),
});
const REPORT = { ok: true, counts: { missing: 5, draft: 1, stale: 2, unverified: 1, translated: 11 }, coverage: 55, items: [] };

function api(o: { media?: unknown; campaigns?: unknown[]; unread?: number; fail?: string[] } = {}) {
  return stubFetch((url) => {
    if (o.fail?.includes(url)) return json({ error: "boom" }, 500);
    if (url === "/api/admin/posts") return json({ ok: true, items: POSTS });
    if (url === "/api/admin/collections") return json({ ok: true, items: [] });
    if (url === "/api/admin/media") return json({ ok: true, items: o.media ?? MEDIA });
    if (url === "/api/admin/mcp/grants") return json({ ok: true, items: GRANTS });
    if (url === "/api/admin/announce") return json({ ok: true, unread: o.unread ?? 3, items: [] });
    if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: o.campaigns ?? [campaign("c1", "sent", {}), campaign("c2", "sending", { failed: 0, sent: 4 })] });
    if (url.startsWith("/api/admin/translations")) return json(REPORT);
    return undefined;
  });
}

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const page = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

let undoPhone: () => void;
let clock = Date.now();
beforeEach(() => {
  localStorage.clear();
  undoPhone = phone(false);
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 31_000));
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  lang("en");
});

const rowBtn = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("the Overview dashboard", () => {
  it("has three rows: At a glance and Activity open, Coverage closed", async () => {
    api();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    expect(rowBtn("At a glance").getAttribute("aria-expanded")).toBe("true");
    expect(rowBtn("Activity").getAttribute("aria-expanded")).toBe("true");
    expect(rowBtn("Coverage").getAttribute("aria-expanded")).toBe("false");
  });

  it("draws seven KPI tiles, each a link into its screen", async () => {
    api();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    const tiles = [
      ["Posts", "/admin/posts?status=published"], ["Areas", "/admin/areas"], ["Media", "/admin/media"], ["Apps", "/admin/connections"],
      ["Inbox", "/admin/marketing"], ["Drafts", "/admin/posts?status=draft"], ["Failed", "/admin/marketing?tab=campaigns"],
    ];
    for (const [name, href] of tiles) {
      const a = screen.getAllByRole("link").find((l) => l.getAttribute("data-kpi-name")?.startsWith(`${name} `));
      expect(a, name).toBeTruthy();
      expect(a!.getAttribute("href")).toBe(href);
    }
  });

  it("lists what needs the owner as one-button rows, and opens each screen", async () => {
    api();
    page();
    const needs = await screen.findByRole("region", { name: "Needs you" });
    const names = (await within(needs).findAllByRole("button")).map((b) => b.getAttribute("aria-label") ?? "").filter((n) => n.startsWith("Open"));
    expect(names[0]).toBe("Open Inbox 3 unread");
    expect(names[1]).toMatch(/^Open Drafts 3 waiting /);
    expect(names[2]).toBe("Open Campaigns 1 with failed sends");
    fireEvent.click(within(needs).getByRole("button", { name: /^Open Drafts/ }));
    expect((await screen.findByTestId("where")).textContent).toBe("/admin/posts?status=draft");
  });

  it("says All clear when nothing needs the owner", async () => {
    stubFetch((url) => {
      if (url === "/api/admin/posts") return json({ ok: true, items: [post("alpha")] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: [] });
      if (url.startsWith("/api/admin/translations")) return json(REPORT);
      if (url.startsWith("/api/admin/")) return json({ ok: true, items: [] });
      return undefined;
    });
    page();
    expect(await screen.findByText("All clear")).toBeTruthy();
  });

  it("draws a sparkline only where the dates give a real trend", async () => {
    api();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    const media = screen.getAllByRole("link").find((l) => l.getAttribute("data-kpi-name")?.startsWith("Media "))!;
    expect(media.querySelector("svg[role=img]")).toBeTruthy();
    const posts = screen.getAllByRole("link").find((l) => l.getAttribute("data-kpi-name")?.startsWith("Posts "))!;
    expect(posts.querySelector("svg[role=img]")).toBeTruthy();
    const inbox = screen.getAllByRole("link").find((l) => l.getAttribute("data-kpi-name")?.startsWith("Inbox "))!;
    expect(inbox.querySelector("svg[role=img]")).toBeNull();
  });

  it("shows a dash, never a zero, for a source that failed", async () => {
    api({ fail: ["/api/admin/media"] });
    page();
    await screen.findByRole("region", { name: "Needs you" });
    const media = screen.getAllByRole("link").find((l) => l.getAttribute("data-kpi-name")?.startsWith("Media "))!;
    expect(media.getAttribute("data-kpi-name")).toBe("Media —");
  });

  it("has a Recent activity panel with changes, a Campaigns panel and a Quick links panel", async () => {
    api();
    page();
    const recent = await screen.findByRole("region", { name: "Recent activity" });
    expect(within(recent).getAllByRole("button", { name: /^Open/ }).length).toBeGreaterThan(0);
    const campaigns = screen.getByRole("region", { name: "Campaigns" });
    expect(await within(campaigns).findByText("Campaign c2")).toBeTruthy();
    expect(within(campaigns).getByRole("img", { name: "8 of 10 sent" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Quick links" })).toBeTruthy();
  });

  it("opens the Coverage row to Translations and Media usage panels", async () => {
    api();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    fireEvent.click(rowBtn("Coverage"));
    const tr = await screen.findByRole("region", { name: "Translations" });
    expect(await within(tr).findByText("55%")).toBeTruthy();
    const mu = screen.getByRole("region", { name: "Media" });
    expect(within(mu).getByRole("img", { name: "In use: 2 / 3" })).toBeTruthy();
  });

  it("remembers an opened row, and E opens or closes all rows", async () => {
    api();
    const first = page();
    await screen.findByRole("region", { name: "Needs you" });
    fireEvent.click(rowBtn("Coverage"));
    first.unmount();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    expect(rowBtn("Coverage").getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document.body, { key: "e" });
    expect(rowBtn("Coverage").getAttribute("aria-expanded")).toBe("false");
    expect(rowBtn("At a glance").getAttribute("aria-expanded")).toBe("false");
  });

  it("expands Recent activity with V and shows more of it, Esc leaves", async () => {
    api();
    page();
    const user = userEvent.setup();
    const recent = await screen.findByRole("region", { name: "Recent activity" });
    const before = within(recent).getAllByRole("button", { name: /^Open/ }).length;
    within(recent).getAllByRole("button", { name: /^Open/ })[0].focus();
    await user.keyboard("v");
    expect(recent.getAttribute("data-expanded")).toBe("true");
    expect(within(recent).getAllByRole("button", { name: /^Open/ }).length).toBeGreaterThanOrEqual(before);
    await user.keyboard("{Escape}");
    expect(recent.getAttribute("data-expanded")).toBeNull();
  });

  it("renders the same dashboard on a phone", async () => {
    undoPhone();
    undoPhone = phone(true);
    api();
    page();
    expect(await screen.findByRole("region", { name: "Needs you" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Quick links" })).toBeTruthy();
  });

  it("is Hebrew in /he", async () => {
    lang("he");
    api();
    page();
    const needs = await screen.findByRole("region", { name: "מחכה לך" });
    expect(await within(needs).findAllByRole("button", { name: /^פתיחת/ })).toHaveLength(3);
    expect(screen.getByRole("region", { name: "קיצורים" })).toBeTruthy();
    expect(screen.queryByText("Needs you")).toBeNull();
    /* #864: the tile labels are short enough for a narrow tile; "Connected apps" was cut to "אפליקציות מחו...". */
    const labels = screen.getAllByRole("link").map((l) => l.getAttribute("data-kpi-name")).filter(Boolean) as string[];
    expect(labels.some((n) => n.startsWith("אפליקציות ") && !n.includes("מחוברות"))).toBe(true);
  });

  it("keeps every tile label short enough not to be cut at 1280", async () => {
    api();
    page();
    await screen.findByRole("region", { name: "Needs you" });
    const tiles = screen.getAllByRole("link").filter((l) => l.hasAttribute("data-kpi-name"));
    expect(tiles.length).toBe(7);
    for (const t of tiles) expect((t.querySelector("span > span:last-child")?.textContent ?? "").length, t.getAttribute("data-kpi-name")!).toBeLessThanOrEqual(12);
  });
});
