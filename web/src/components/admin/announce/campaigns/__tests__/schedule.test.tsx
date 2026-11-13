import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampaignsTab from "../CampaignsTab";
import { DEFAULT_SENDER } from "../../sender/defaults";
import { DEFAULT_NOTIFY } from "../../notify/defaults";
import { zonedToIso } from "../helpers";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sender = (o: object = {}) => ({ ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"], ...o });
const wall = (iso: string, tz: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso)).replace(" ", "T");

afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("zonedToIso and a wall time that does not exist", () => {
  it.each([
    ["2026-03-27T02:30", "Asia/Jerusalem"],
    ["2026-03-08T02:30", "America/New_York"],
  ])("refuses %s in %s (spring-forward gap) instead of moving it to another wall time", (local, tz) => {
    const iso = zonedToIso(local, tz);
    expect(iso === null || wall(iso, tz) === local, `${tz} ${local} -> ${iso}`).toBe(true);
    expect(iso).toBeNull();
  });

  it("keeps times either side of the gap", () => {
    expect(zonedToIso("2026-03-27T01:59", "Asia/Jerusalem")).toBe("2026-03-26T23:59:00.000Z");
    expect(zonedToIso("2026-03-27T03:00", "Asia/Jerusalem")).toBe("2026-03-27T00:00:00.000Z");
    expect(zonedToIso("2026-03-08T03:00", "America/New_York")).toBe("2026-03-08T07:00:00.000Z");
  });

  it("an ambiguous fall-back hour is the first occurrence (the earlier instant)", () => {
    // New York falls back 2026-11-01 02:00 EDT -> 01:00 EST, so 01:30 happens twice; the first is 01:30 EDT = 05:30Z.
    expect(zonedToIso("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
    // Israel falls back 2026-10-25 02:00 IDT -> 01:00 IST, so 01:30 happens twice; the first is 01:30 IDT = 22:30Z.
    expect(zonedToIso("2026-10-25T01:30", "Asia/Jerusalem")).toBe("2026-10-24T22:30:00.000Z");
  });
});

describe("campaign editor opened as 'new'", () => {
  const camp = (o: object = {}) => ({
    id: "c9", _rev: "1-a", name: "n", subject: "Hello", preheader: "", bodyText: "Hi", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
    status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, testedAt: null, capOverride: null,
    startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
  });
  const sendingCamp = () => camp({ status: "sending", counters: { queued: 12, sent: 3, failed: 0, suppressed: 0 } });
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/admin/campaigns" && method === "GET") return json({ ok: true, campaigns: [] });
      if (url === "/api/admin/campaigns" && method === "POST") return json({ ok: true, campaign: camp() }, 201);
      if (url === "/api/admin/campaigns/c9/send-now") return json({ ok: true, campaign: sendingCamp() });
      if (url === "/api/admin/campaigns/c9" && method === "GET") return json({ ok: true, campaign: sendingCamp() });
      if (url === "/api/admin/campaigns/sending") return json({ ok: true, paused: false, pausedAt: null, envDisabled: false, blocked: false });
      if (url === "/api/admin/campaigns/audience") return json({ ok: true, count: 12, samples: [] });
      if (url === "/api/admin/campaigns/preview") return json({ ok: true, subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings: { enabled: true, email: { enabled: false, events: [] }, hashtags: [], signature: "", channels: [], templates: { en: {}, he: {} }, snippets: [], library: [], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: sender(), notify: DEFAULT_NOTIFY } });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 12 }] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      return json({ ok: true });
    }));
  });

  const fillNew = async () => {
    render(<MemoryRouter><CampaignsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /new campaign/i }));
    fireEvent.change(await screen.findByLabelText(/^subject/i), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: "Hi" } });
    await waitFor(() => expect(screen.getByTestId("audience-count").textContent).toMatch(/12/));
  };

  it("after send-now on a campaign created in this editor, the form is read-only and shows progress", async () => {
    await fillNew();
    fireEvent.click(screen.getByRole("button", { name: "Send now…" }));
    fireEvent.click(await screen.findByRole("button", { name: /^send to 12 now/i }));
    await waitFor(() => expect(screen.getByText(/sending/i)).toBeTruthy());
    // The server refuses edits to a campaign that is no longer a draft (409).
    await waitFor(() => expect(screen.queryByTestId("progress")).not.toBeNull());
    expect(document.querySelector("fieldset[disabled]")).not.toBeNull();
  });

  it("a gap time in schedule mode says the time does not exist and blocks Send", async () => {
    await fillNew();
    fireEvent.click(screen.getByRole("button", { name: "Schedule for later" }));
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Asia/Jerusalem" } });
    fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2099-03-27T02:30" } });
    expect((await screen.findAllByText(/does not exist/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/goes out/i)).toBeNull();
  });
});
