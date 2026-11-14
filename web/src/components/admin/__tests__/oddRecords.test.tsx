import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import InboxRow from "@/components/admin/announce/inbox/InboxRow";
import AudienceDesktop from "@/components/admin/announce/audience/AudienceDesktop";
import { useWhen } from "@/components/admin/announce/audience/useWhen";
import { whenOf } from "@/components/admin/announce/sender/useBudget";
import AdminSettings from "@/pages/AdminSettings";
import Admin from "@/pages/Admin";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { resetSettings } from "@/settings/store";

/* One odd record (an enum this build does not know, a bad timestamp, a blank title)
   must degrade its own row and leave the screen standing. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const phone = () =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 599px"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
afterEach(() => (cleanup(), vi.restoreAllMocks(), vi.unstubAllGlobals(), resetSettings(), (document.documentElement.lang = "en")));

describe("an unknown status or event kind", () => {
  it("StatusGlyph draws a neutral glyph with a word instead of throwing", () => {
    render(<StatusGlyph kind={"mystery" as never} />);
    const g = screen.getByRole("img");
    expect(g.getAttribute("data-tone")).toBe("neutral");
    expect(g.getAttribute("aria-label")).toMatch(/\S/);
    expect(g.getAttribute("aria-label")).not.toBe("undefined");
  });
  it("StatusGlyph says 'Unknown' in Hebrew too", () => {
    document.documentElement.lang = "he";
    render(<StatusGlyph kind={"mystery" as never} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("לא ידוע");
  });
  it("desktop InboxRow with an unknown event kind renders with a label", () => {
    const ev = { id: "e", kind: "webinar", ref: "e", title: "t", url: "https://x.y", langs: ["en"], createdAt: "2026-11-01T00:00:00Z", readAt: null, done: {}, dismissed: null };
    render(<InboxRow event={ev as never} selected={false} readiness={undefined} onOpen={() => {}} onCopy={() => {}} />);
    expect(document.querySelector(".mk-kind .sr-only")?.textContent).toMatch(/\S/);
  });
});

describe("an invalid timestamp", () => {
  it("whenOf and useWhen do not throw and print a word, not 'Invalid Date'", () => {
    expect(whenOf("garbage")).toBe("unknown");
    const { result } = renderHook(() => useWhen());
    expect(result.current("garbage")).toBe("unknown");
    expect(result.current(undefined)).toBe("");
  });
});

describe("a title that is only spaces or zero-width characters", () => {
  it("the Posts phone row falls back to the slug", async () => {
    phone();
    const post = (slug: string, title: string) => ({ slug, title, subtitle: null, excerpt: "", body: "", status: "published", publishedAt: null, updatedAt: "2026-11-01T00:00:00Z", tags: [], readingMinutes: 1, collection: "site" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/posts") return json({ ok: true, items: [post("blank-one", "   "), post("zw-one", "​​")] });
      if (url === "/api/admin/collections") return json({ ok: true, items: [] });
      if (url === "/api/admin/me") return json({ ok: true, login: "o", email: null });
      return json({ ok: true, counts: {}, items: [] });
    }));
    render(<MemoryRouter initialEntries={["/admin/posts"]}><Admin /></MemoryRouter>);
    const rows = await screen.findAllByRole("button", { name: /^Open/ });
    const txt = rows.map((r) => r.textContent).join(" | ");
    expect(txt).toContain("blank-one");
    expect(txt).toContain("zw-one");
  });
  it("the Posts list shows the rest, and says one could not be read, when a post has an unknown status", async () => {
    phone();
    /* The service holds a list for 30 s; step past what the previous test cached. */
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    const post = (slug: string, status: string) => ({ slug, title: slug, subtitle: null, excerpt: "", body: "", status, publishedAt: null, updatedAt: "2026-11-01T00:00:00Z", tags: [], readingMinutes: 1, collection: "site" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/posts") return json({ ok: true, items: [post("fine-one", "published"), post("odd-one", "scheduled")] });
      if (url === "/api/admin/collections") return json({ ok: true, items: [] });
      if (url === "/api/admin/me") return json({ ok: true, login: "o", email: null });
      return json({ ok: true, counts: {}, items: [] });
    }));
    render(<MemoryRouter initialEntries={["/admin/posts"]}><Admin /></MemoryRouter>);
    await screen.findByText(/fine-one/);
    expect(document.body.textContent).toMatch(/1 item could not be read/);
    expect(document.body.textContent).not.toMatch(/invalid_enum|zod/i);
  });
});

describe("Settings with a partial payload", () => {
  it("opens when sharing.templates is missing", async () => {
    const settings = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
    settings.sharing = { ...(settings.sharing as object), templates: undefined };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      return json({ ok: true, exists: true, _rev: "1-a", version: 1, updatedAt: "2026-11-01T10:00:00.000Z", settings, history: [] });
    }));
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    await waitFor(() => expect(document.getElementById("settings-template-en-linkedin") ?? screen.queryByText(/Message templates/)).not.toBeNull());
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });
});

describe("Audience on a wide screen with a long unbroken name", () => {
  it("lets the name and group cells break anywhere so the table cannot widen the page", async () => {
    const long = "Supercalifragilisticexpialidocious".repeat(3);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/admin/audience/groups")) return json({ ok: true, groups: [] });
      if (url.startsWith("/api/admin/audience/contacts?"))
        return json({ ok: true, items: [{ hash: "h1", email: "a@b.co", name: long, lang: "en", groups: [long], status: "active", source: "site", consentAt: "2026-01-01T00:00:00Z", consentNote: "", topics: { blog: true, releases: true }, createdAt: "2026-01-01T00:00:00Z" }], nextCursor: null });
      return json({ ok: true });
    }));
    render(<MemoryRouter><AudienceDesktop /></MemoryRouter>);
    const cell = (await screen.findByText(long, { selector: "bdi" })).closest("td")!;
    expect(cell.className).toContain("overflow-wrap:anywhere");
    expect(cell.className).toContain("min-w-0");
  });
});
