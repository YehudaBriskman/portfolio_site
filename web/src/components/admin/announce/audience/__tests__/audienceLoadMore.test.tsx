import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AudiencePhone from "@/components/admin/announce/audience/AudiencePhone";

/* B-h3-9: "Load more" answered after the search changed is appended to the NEW result list. */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const contact = (n: string) => ({ hash: n, email: `${n}@b.co`, name: null, lang: "en", groups: [], status: "active", source: "site", consentAt: "2026-01-01T00:00:00Z", consentNote: "", topics: { blog: true, releases: true }, createdAt: "2026-01-01T00:00:00Z" });
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

it("a late page of the OLD search is not appended to the new search", async () => {
  let releaseMore: (r: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/api/admin/audience/groups")) return Promise.resolve(json({ ok: true, groups: [] }));
    if (url.startsWith("/api/admin/audience/contacts?")) {
      if (url.includes("cursor=c2")) return new Promise<Response>((r) => (releaseMore = r));
      if (url.includes("q=zed")) return Promise.resolve(json({ ok: true, items: [contact("zed1")], nextCursor: null }));
      return Promise.resolve(json({ ok: true, items: [contact("old1"), contact("old2")], nextCursor: "c2" }));
    }
    return Promise.resolve(json({ ok: true }));
  }));
  render(<MemoryRouter initialEntries={["/admin/marketing?tab=audience"]}><AudiencePhone /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /load more/i }));
  fireEvent.change(screen.getByLabelText("Search contacts"), { target: { value: "zed" } });
  await waitFor(() => expect(document.body.textContent).toContain("zed1@b.co"));
  await act(async () => releaseMore(json({ ok: true, items: [contact("old3"), contact("old4")], nextCursor: "c3" })));
  expect(document.body.textContent).not.toContain("old3@b.co");
  expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
});
