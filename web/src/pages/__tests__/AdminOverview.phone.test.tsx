import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminOverview from "@/pages/AdminOverview";
import { controlsIn, factsOf, json, lang, phone, rows, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * The admin landing page below 600px (#682): what needs the owner comes
 * first, as tappable rows; the numbers that are only information are small
 * tiles; the rest (the feed) is behind one closed Disclosure. Above 600px
 * nothing changes.
 */

const post = (slug: string, o: object = {}) => ({
  slug, title: `Title of ${slug}`, subtitle: null, excerpt: "", body: "", status: "published", publishedAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z", tags: [], readingMinutes: 2, ...o,
});
const POSTS = [
  post("alpha"),
  post("beta", { status: "draft", publishedAt: null, updatedAt: "2026-11-12T08:00:00Z" }),
  post("gamma", { status: "draft", publishedAt: null, updatedAt: "2026-11-11T08:00:00Z" }),
  post("delta", { draft: { title: "Delta v2" }, draftSavedAt: "2026-11-12T09:00:00Z" }),
];
const grant = (id: string, client: string, o: object = {}) => ({
  id, client, scopes: ["mcp:read"], login: "owner", createdAt: "2026-11-01T10:00:00Z", lastUsedAt: "2026-11-12T10:00:00Z",
  expiresAt: "2026-12-01T10:00:00Z", revokedAt: null, revokedReason: null, status: "active", ...o,
});
const GRANTS = [grant("g1", "Claude Code"), grant("g2", "Old client", { status: "revoked", revokedAt: "2026-11-05T10:00:00Z" })];
const campaign = (id: string, status: string, failed: number) => ({
  id, _rev: "1-a", name: id, subject: "", preheader: "", bodyText: "", blocks: null, groups: [], lang: "all", topic: null, status, sendAt: null,
  counters: { queued: 10, sent: 10 - failed, failed, suppressed: 0 }, eventId: null, pausedReason: null, testedAt: null, capOverride: null,
  startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
});

function api(o: { unread?: number; campaigns?: unknown[] } = {}) {
  return stubFetch((url) => {
    if (url === "/api/admin/posts") return json({ ok: true, items: POSTS });
    if (url === "/api/admin/collections") return json({ ok: true, items: [] });
    if (url === "/api/admin/media") return json({ ok: true, items: [] });
    if (url === "/api/admin/mcp/grants") return json({ ok: true, items: GRANTS });
    if (url === "/api/admin/announce") return json({ ok: true, unread: o.unread ?? 3, items: [] });
    if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: o.campaigns ?? [campaign("c1", "sent", 2), campaign("c2", "sent", 0)] });
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
/* One clock for the file, only ever forward: the post and area lists are cached for 30 s, so each test starts after that. */
let clock = Date.now();
beforeEach(() => {
  undoPhone = phone(true);
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 31_000));
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  lang("en");
});

describe("/admin on a phone", () => {
  it("puts what needs the owner first, as one-button rows with their full names", async () => {
    api();
    page();
    const needs = await screen.findByRole("region", { name: "Needs you" });
    const list = within(needs).getAllByRole("button");
    expect(list.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Open the inbox: 3 unread",
      "Open drafts: 3 waiting",
      "Open campaigns: 1 with failed sends",
    ]);
    /* Needs-you comes before any figure that is only information. */
    const glance = screen.getByRole("region", { name: "At a glance" });
    expect(needs.compareDocumentPosition(glance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const row of rows().filter((r) => needs.contains(r))) {
      expect(controlsIn(row)).toBe(1);
      expect(factsOf(row).length).toBeLessThanOrEqual(2);
    }
  });

  it("opens each row's own screen", async () => {
    api();
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Open drafts: 3 waiting" }));
    expect((await screen.findByTestId("where")).textContent).toBe("/admin/posts?status=draft");
  });

  it("says so when nothing needs the owner, and draws no empty rows", async () => {
    /* The shared fixture always has drafts: serve a quiet site instead. */
    stubFetch((url) => {
      if (url === "/api/admin/posts") return json({ ok: true, items: [post("alpha")] });
      if (url === "/api/admin/collections" || url === "/api/admin/media") return json({ ok: true, items: [] });
      if (url === "/api/admin/mcp/grants") return json({ ok: true, items: [] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: [] });
      return undefined;
    });
    page();
    expect(await screen.findByText("Nothing needs you right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Open (the inbox|drafts|campaigns)/ })).toBeNull();
  });

  it("shows the figures as tiles with a bar, and keeps the feed behind a closed Disclosure", async () => {
    api();
    page();
    const glance = await screen.findByRole("region", { name: "At a glance" });
    expect(within(glance).getAllByRole("img").length).toBeGreaterThanOrEqual(2);
    expect(within(glance).getAllByRole("link").length).toBeGreaterThanOrEqual(3);
    const feed = document.querySelector("details");
    expect(feed).not.toBeNull();
    expect(feed!.open).toBe(false);
    expect(feed!.textContent).toContain("Recent activity");
    /* The desktop stat grid and its two-column feed are not on a phone. */
    expect(document.querySelector(".a-stats")).toBeNull();
  });

  it("is in Hebrew in /he, with the same rows", async () => {
    lang("he");
    api();
    page();
    expect(await screen.findByRole("region", { name: "מחכה לך" })).toBeInTheDocument();
    const needs = screen.getByRole("region", { name: "מחכה לך" });
    expect(await within(needs).findAllByRole("button", { name: /^פתיחת/ })).toHaveLength(3);
    expect(screen.queryByText("Needs you")).toBeNull();
  });
});

describe("/admin on a desktop", () => {
  it("is unchanged: the stat grid, the feed and the continue box", async () => {
    undoPhone();
    undoPhone = phone(false);
    api();
    page();
    expect(await screen.findByText("Pick up where you left off")).toBeInTheDocument();
    expect(document.querySelector(".a-stats")).not.toBeNull();
    expect(rows().length).toBe(0);
    expect(screen.queryByRole("region", { name: "Needs you" })).toBeNull();
  });
});
