import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InboxTab from "../InboxTab";
import { clearReadinessCache } from "../readiness";
import type { AnnounceSummary } from "@/services/adminAnnounce";
import "../words";
import "../../words";

/*
 * The Inbox on a phone (under 600px): one row is one button with a kind icon,
 * a title, a time, a "new" dot and four channel glyphs; tapping it opens a
 * bottom sheet that holds the caption, the preview, the per-channel actions
 * and "Mark done" with an 8-second Undo. jsdom has no layout, so the sizes
 * (rows above the fold, no sideways scroll) are held by
 * web/scripts/a11y/admin-inbox-phone.mjs in a real browser.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ev = (n: number, o: Partial<AnnounceSummary> = {}): AnnounceSummary => ({
  id: `announce:post:p${n}:1`,
  kind: "post",
  ref: `p${n}`,
  title: `Post number ${n}`,
  url: `https://site.example.test/blog/p${n}`,
  langs: ["en", "he"],
  createdAt: "2026-11-01T10:00:00Z",
  readAt: "2026-11-01T11:00:00Z",
  done: {},
  dismissed: null,
  ...o,
});
const ITEMS = [
  ev(1, { title: "Rebuilding the admin as a tool", readAt: null }),
  ev(2, { kind: "release", title: "portfolio_site v1.9.0", done: { linkedin: "2026-11-02T10:00:00Z" } }),
  ev(3),
];

const kitItem = (text: string, subject = "") => ({ text, subject, limit: null, length: text.length, over: false });
let fetched: Array<{ url: string; method: string }>;

function stubFetch() {
  fetched = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      fetched.push({ url, method });
      if (url.includes("/preview")) {
        const long = url.includes("p3");
        return json({ ok: true, title: "T", description: "d", image: "", imageWidth: null, imageHeight: null, siteName: "S", url: "u", lang: "en", issues: long ? [{ code: "description-long", field: "description", severity: "warn" }] : [] });
      }
      if (url.endsWith("/done") && method === "POST") return json({ ok: true, event: { ...ITEMS[0], readAt: "x", done: { linkedin: "2026-11-14T10:00:00Z" } } });
      if (url.endsWith("/read") && method === "POST") return json({ ok: true, event: null });
      if (url.includes("/api/admin/announce/")) {
        const k = { linkedin: kitItem("LI text"), instagram: kitItem("IG text"), email: kitItem("Mail text", "Subject line"), x: kitItem("X text") };
        return json({ ok: true, siteOrigin: "https://site.example.test", event: { ...ITEMS[0], summary: "s", tags: [], version: null }, kit: { en: k, he: { linkedin: kitItem("טקסט") } } });
      }
      return json({}, 404);
    }),
  );
}

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && /max-width:\s*599px/.test(q),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  })) as typeof window.matchMedia;
}

let onChange: ReturnType<typeof vi.fn>;
const renderInbox = () => {
  onChange = vi.fn();
  return render(
    <MemoryRouter>
      <InboxTab items={ITEMS} error={null} onRetry={() => undefined} onChange={onChange} onCreated={() => undefined} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  clearReadinessCache();
  stubFetch();
  phone(true);
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("[data-record-row]"));

describe("Inbox row on a phone", () => {
  it("is one button per event, with no other button inside the row", () => {
    const { container } = renderInbox();
    expect(rows(container)).toHaveLength(3);
    for (const r of rows(container)) {
      expect(r.tagName).toBe("BUTTON");
      expect(r.querySelectorAll("button, a, input").length).toBe(0);
      expect(r.closest("li")?.querySelectorAll("button").length).toBe(1);
    }
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
  });

  it("carries at most the title and the time as text, and four named channel glyphs", () => {
    const { container } = renderInbox();
    const r = rows(container)[1];
    expect(r.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(1);
    const glyphs = Array.from(r.querySelectorAll("[data-channel]"));
    expect(glyphs.map((g) => g.getAttribute("data-channel"))).toEqual(["linkedin", "x", "instagram", "email"]);
    expect(glyphs.map((g) => g.getAttribute("aria-label"))).toEqual([
      "LinkedIn: posted",
      "X: not posted yet",
      "Instagram: not posted yet",
      "Email: not posted yet",
    ]);
    expect(glyphs.map((g) => g.getAttribute("data-done"))).toEqual(["true", "false", "false", "false"]);
  });

  it("names the row by its title and describes it by time, new and where it is posted", () => {
    const { container } = renderInbox();
    const r = rows(container)[0];
    expect(r.getAttribute("aria-label")).toMatch(/Rebuilding the admin as a tool/);
    const desc = document.getElementById(r.getAttribute("aria-describedby")!)!.textContent ?? "";
    expect(desc).toMatch(/New/);
    expect(desc).toMatch(/LinkedIn: not posted yet/);
  });

  it("marks an unread event with a dot and says New to a screen reader only", () => {
    const { container } = renderInbox();
    expect(container.querySelectorAll("[data-rr-unread]").length).toBe(1);
    expect(rows(container)[0].querySelector("[data-rr-unread]")).not.toBeNull();
  });

  it("never prints the word Ready, and shows one alert glyph only for an event with an issue", async () => {
    const { container } = renderInbox();
    await waitFor(() => expect(container.querySelectorAll("[data-kind='failed'], [data-kind='changes'], [data-issue]").length).toBe(1));
    expect(screen.queryByText(/^Ready$/)).toBeNull();
    const flagged = container.querySelector("[data-issue]") as HTMLElement;
    expect(flagged.closest("[data-record-row]")?.getAttribute("aria-label")).toMatch(/Post number 3/);
    expect(flagged.getAttribute("aria-label") ?? flagged.textContent).toMatch(/Long description/);
    expect(container.querySelectorAll("[data-issue]").length).toBe(1);
  });

  it("hides the keyboard hint, and the Copy buttons are gone from rows", () => {
    const { container } = renderInbox();
    expect(container.querySelector(".mk-keys")).toBeNull();
    expect(container.querySelector(".mk-quick")).toBeNull();
  });
});

describe("Inbox sheet on a phone", () => {
  it("opens on tap with the title, and Escape closes it and returns focus to the row", async () => {
    const { container } = renderInbox();
    const row = rows(container)[2];
    row.focus();
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: /Post number 3/ });
    expect(dialog).toBeTruthy();
    expect(await screen.findByRole("textbox", { name: /Caption for LinkedIn/ })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("closes on Back", async () => {
    const { container } = renderInbox();
    fireEvent.click(rows(container)[2]);
    await screen.findByRole("dialog");
    window.history.replaceState(null, "");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("has Copy and the channel's Open in the footer and the readiness issue by name", async () => {
    const { container } = renderInbox();
    fireEvent.click(rows(container)[2]);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("button", { name: /^Copy caption$/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Copy and open LinkedIn/ })).toBeTruthy();
    expect(await within(dialog).findByText(/Long description/)).toBeTruthy();
  });
});

describe("Mark done on a phone", () => {
  async function open() {
    const { container } = renderInbox();
    fireEvent.click(rows(container)[0]);
    const dialog = await screen.findByRole("dialog");
    const mark = await within(dialog).findByRole("button", { name: /Mark as done/ });
    return { container, dialog, mark };
  }
  const doneCalls = () => fetched.filter((f) => f.url.endsWith("/done"));

  it("shows Undo for 8 seconds and saves only after the window", async () => {
    const { dialog, mark } = await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(mark);
    expect(within(dialog).getByRole("button", { name: /^Undo$/ })).toBeTruthy();
    expect(doneCalls()).toHaveLength(0);
    await act(async () => void vi.advanceTimersByTime(7900));
    expect(doneCalls()).toHaveLength(0);
    await act(async () => void vi.advanceTimersByTime(200));
    expect(doneCalls()).toHaveLength(1);
    expect(onChange).toHaveBeenCalled();
  });

  it("Undo cancels the save and restores the Mark button and the row", async () => {
    const { container, dialog, mark } = await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const row = rows(container)[0];
    expect(row.querySelector("[data-channel=linkedin]")?.getAttribute("data-done")).toBe("false");
    fireEvent.click(mark);
    expect(row.querySelector("[data-channel=linkedin]")?.getAttribute("data-done")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Undo$/ }));
    await act(async () => void vi.advanceTimersByTime(20000));
    expect(doneCalls()).toHaveLength(0);
    expect(within(dialog).getByRole("button", { name: /Mark as done/ })).toBeTruthy();
    expect(row.querySelector("[data-channel=linkedin]")?.getAttribute("data-done")).toBe("false");
  });
});

describe("Inbox in Hebrew", () => {
  it("names the glyphs and the row in Hebrew, and the row mirrors by logical properties", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    const { container } = renderInbox();
    const r = rows(container)[1];
    expect(r.querySelector("[data-channel=linkedin]")?.getAttribute("aria-label")).toMatch(/[֐-׿]/);
    expect(r.getAttribute("aria-label")).toMatch(/[֐-׿]/);
    expect(r.querySelector("[data-channel=linkedin]")?.getAttribute("aria-label")).not.toMatch(/posted/);
  });
});

describe("Desktop is unchanged", () => {
  it("keeps the Copy buttons, the key hint and the old row at 600px and up", () => {
    phone(false);
    const { container } = renderInbox();
    expect(container.querySelectorAll("[data-record-row]").length).toBe(0);
    expect(container.querySelectorAll(".mk-quick").length).toBe(3);
    expect(container.querySelector(".mk-keys")).not.toBeNull();
  });
});
