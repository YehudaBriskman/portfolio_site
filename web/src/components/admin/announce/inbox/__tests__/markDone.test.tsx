import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InboxTab from "@/components/admin/announce/inbox/InboxTab";
import { clearReadinessCache } from "@/components/admin/announce/inbox/readiness";
import type { AnnounceSummary } from "@/services/adminAnnounce";
import "@/components/admin/announce/inbox/words";
import "@/components/admin/announce/words";

/* UI hunt h4: Marketing Inbox "Mark done" with the 8 s Undo (phone sheet). Each test passes once the bug is fixed. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ev = (n: number, o: Partial<AnnounceSummary> = {}): AnnounceSummary => ({
  id: `announce:post:p${n}:1`, kind: "post", ref: `p${n}`, title: `Post number ${n}`, url: `https://site.example.test/blog/p${n}`,
  langs: ["en", "he"], createdAt: "2026-11-01T10:00:00Z", readAt: "2026-11-01T11:00:00Z", done: {}, dismissed: null, ...o,
});
const ITEMS = [ev(1), ev(2)];
const kitItem = (text: string) => ({ text, subject: "", limit: null, length: text.length, over: false });
let fetched: Array<{ url: string; method: string }>;
let doneStatus = 200;

function stubFetch() {
  fetched = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    fetched.push({ url, method });
    if (url.includes("/preview")) return json({ ok: true, title: "T", description: "d", image: "", imageWidth: null, imageHeight: null, siteName: "S", url: "u", lang: "en", issues: [] });
    if (url.endsWith("/done") && method === "POST") {
      return doneStatus === 200 ? json({ ok: true, event: { ...ITEMS[0], done: { linkedin: "2026-11-14T10:00:00Z" } } }) : json({ ok: false, error: "boom" }, doneStatus);
    }
    if (url.endsWith("/read") && method === "POST") return json({ ok: true, event: null });
    if (url.includes("/api/admin/announce/")) {
      const k = { linkedin: kitItem("LI text"), instagram: kitItem("IG text"), email: kitItem("Mail text"), x: kitItem("X text") };
      return json({ ok: true, siteOrigin: "https://site.example.test", event: { ...ITEMS[0], summary: "s", tags: [], version: null }, kit: { en: k, he: {} } });
    }
    return json({}, 404);
  }));
}

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && /max-width:\s*599px/.test(q), media: q, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false, onchange: null,
  })) as typeof window.matchMedia;
}

let onChange: Mock<(id: string, next: AnnounceSummary | null) => void>;
const renderInbox = () => {
  onChange = vi.fn();
  return render(
    <MemoryRouter>
      <InboxTab items={ITEMS} error={null} onRetry={() => undefined} onChange={onChange} onCreated={() => undefined} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  doneStatus = 200;
  clearReadinessCache();
  stubFetch();
  phone(true);
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
    close: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("[data-record-row]"));
const doneCalls = () => fetched.filter((f) => f.url.endsWith("/done"));
async function openAndMark(fake = false) {
  const r = renderInbox();
  fireEvent.click(rows(r.container)[0]);
  const dialog = await screen.findByRole("dialog");
  const mark = await within(dialog).findByRole("button", { name: /Mark as done/ });
  if (fake) vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(mark);
  return { ...r, dialog };
}

describe("Inbox Mark done (h4)", () => {
  /* B-h4-7 */
  it("a Mark done that the server refuses must tell the owner on a phone (today the row silently un-marks)", async () => {
    doneStatus = 500;
    const { container } = await openAndMark(true);
    await act(async () => void vi.advanceTimersByTime(8100));
    vi.useRealTimers();
    await waitFor(() => expect(doneCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(rows(container)[0].querySelector("[data-channel=linkedin]")?.getAttribute("data-done")).toBe("false");
    expect(screen.queryByText(/did not go through/i)).not.toBeNull();
  });

  /* B-h4-8 */
  it("leaving the tab inside the Undo window saves it AND tells the parent list, so coming back shows it done", async () => {
    const { unmount } = await openAndMark();
    unmount();
    await waitFor(() => expect(doneCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(onChange).toHaveBeenCalledWith(ITEMS[0].id, expect.objectContaining({ done: expect.objectContaining({ linkedin: expect.any(String) }) }));
  });

  /* B-h4-9 */
  it("closing or reloading the page inside the Undo window must still send the Mark done (pagehide)", async () => {
    await openAndMark();
    expect(doneCalls()).toHaveLength(0);
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((r) => setTimeout(r, 50));
    expect(doneCalls()).toHaveLength(1);
  });
});
