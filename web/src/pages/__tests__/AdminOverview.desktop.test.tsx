import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminOverview from "@/pages/AdminOverview";
import { json, lang, phone, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/* S5 (#840): the desktop Overview says "needs you" first, draws four tiles of one size, and lists each fact once. */

const post = (slug: string, o: object = {}) => ({
  slug, title: `Title of ${slug}`, subtitle: null, excerpt: "", body: "", status: "published", publishedAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z", tags: [], readingMinutes: 2, ...o,
});
const POSTS = [post("alpha"), post("beta", { status: "draft", publishedAt: null, updatedAt: "2026-11-12T08:00:00Z" })];

let undoPhone: () => void;
let clock = Date.now();
beforeEach(() => {
  undoPhone = phone(false);
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 31_000));
  stubFetch((url) => {
    if (url === "/api/admin/posts") return json({ ok: true, items: POSTS });
    if (url === "/api/admin/collections" || url === "/api/admin/media" || url === "/api/admin/mcp/grants") return json({ ok: true, items: [] });
    if (url === "/api/admin/announce") return json({ ok: true, unread: 2, items: [] });
    if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: [] });
    return undefined;
  });
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  lang("en");
});

describe("/admin on a desktop", () => {
  it("puts Needs you first, then four tiles, then one recent list", async () => {
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    const needs = await screen.findByRole("region", { name: "Needs you" });
    const glance = screen.getByRole("region", { name: "At a glance" });
    const recent = screen.getByRole("region", { name: "Recent activity" });
    expect(needs.compareDocumentPosition(glance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(glance.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(glance).getAllByRole("link")).toHaveLength(4);
  });

  it("says each fact once: no second list of the same posts", async () => {
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    await screen.findByRole("region", { name: "Needs you" });
    expect(screen.queryByText("Pick up where you left off")).toBeNull();
    expect(screen.getAllByText("Recent activity")).toHaveLength(1);
    expect(document.querySelector(".a-stats")).toBeNull();
  });
});
