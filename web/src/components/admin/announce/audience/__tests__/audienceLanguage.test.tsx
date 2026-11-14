import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AudiencePhone from "@/components/admin/announce/audience/AudiencePhone";

/* The language filter is applied in the client, so the cursor is followed until a page fills. */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const contact = (n: string, lang: string) => ({ hash: n, email: `${n}@b.co`, name: null, lang, groups: [], status: "active", source: "site", consentAt: "2026-01-01T00:00:00Z", consentNote: "", topics: { blog: true, releases: true }, createdAt: "2026-01-01T00:00:00Z" });
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

const page = (n: number, lang: string, nextCursor: string | null, p: number) => json({ ok: true, items: Array.from({ length: n }, (_, i) => contact(`${lang}${p}x${i}`, lang)), nextCursor });

it("lang=he over English pages follows the cursor to the Hebrew contacts", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/admin/audience/groups")) return json({ ok: true, groups: [] });
    if (url.includes("cursor=c2")) return page(25, "en", "c3", 2);
    if (url.includes("cursor=c3")) return page(3, "he", null, 3);
    return page(25, "en", "c2", 1);
  }));
  render(<MemoryRouter initialEntries={["/admin/marketing?tab=audience&lang=he"]}><AudiencePhone /></MemoryRouter>);
  await waitFor(() => expect(document.body.textContent).toContain("he3x0@b.co"));
  expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
});

it("a failed Load more keeps the rows and says so on the button", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/admin/audience/groups")) return json({ ok: true, groups: [] });
    if (url.includes("cursor=c2")) return new Response("{}", { status: 500 });
    return page(2, "en", "c2", 1);
  }));
  render(<MemoryRouter initialEntries={["/admin/marketing?tab=audience"]}><AudiencePhone /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /load more/i }));
  await screen.findByRole("button", { name: /couldn.t load more/i });
  expect(document.body.textContent).toContain("en1x0@b.co");
});
