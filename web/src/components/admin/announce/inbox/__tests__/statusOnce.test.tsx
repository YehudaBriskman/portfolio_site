import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InboxTab from "../InboxTab";
import { clearReadinessCache } from "../readiness";
import type { AnnounceSummary } from "@/services/adminAnnounce";
import "../words";
import "../../words";

/*
 * A5/A6 (#864): the warning glyph is drawn once, as the header of the group of
 * events that have something to fix, never on every row.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ev = (n: number): AnnounceSummary => ({
  id: `announce:post:p${n}:1`, kind: "post", ref: `p${n}`, title: `Post number ${n}`, url: `https://site.example.test/blog/p${n}`,
  langs: ["en", "he"], createdAt: "2026-11-01T10:00:00Z", readAt: "2026-11-01T11:00:00Z", done: {}, dismissed: null,
});
const ITEMS = [ev(1), ev(2), ev(3), ev(4)];

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && /max-width:\s*599px/.test(q), media: q,
    addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined,
    dispatchEvent: () => false, onchange: null,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  clearReadinessCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = String(input);
    if (url.includes("/preview")) {
      const bad = url.includes("p2") || url.includes("p3");
      return json({ ok: true, title: "T", description: "d", image: "", imageWidth: null, imageHeight: null, siteName: "S", url: "u", lang: "en", issues: bad ? [{ code: "image-missing", field: "image", severity: "error" }] : [] });
    }
    return json({}, 404);
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([["desktop", false], ["phone", true]] as const)("Inbox status on a %s", (_n, on) => {
  it("draws the warning glyph once, on the group header, and on no row", async () => {
    phone(on);
    const { container } = render(
      <MemoryRouter>
        <InboxTab items={ITEMS} error={null} onRetry={() => undefined} onChange={() => undefined} onCreated={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.querySelectorAll("[data-kind='attention']").length).toBe(1));
    const glyph = container.querySelector("[data-kind='attention']") as HTMLElement;
    const head = glyph.closest("[data-attention-group]") as HTMLElement;
    expect(head).not.toBeNull();
    expect(head.tagName).toBe("H3");
    expect(head.textContent).toMatch(/Needs attention/);
    expect(head.textContent).toMatch(/2/);
    expect(glyph.closest("li")).toBeNull();
    /* The two flagged events sit under the header, the clean ones after. */
    const section = head.closest("section") as HTMLElement;
    expect(section.querySelectorAll("li").length).toBe(2);
    expect(section.textContent).toMatch(/Post number 2/);
    expect(section.textContent).not.toMatch(/Post number 1/);
  });
});
