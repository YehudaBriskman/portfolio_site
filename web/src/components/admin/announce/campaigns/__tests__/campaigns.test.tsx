import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampaignsTab from "../CampaignsTab";
import SettingsPanel from "../../SettingsPanel";
import { DEFAULT_SENDER, senderProblems } from "../../sender/defaults";
import { zonedToIso } from "../helpers";
import type { AnnounceSettings } from "@/services/adminAnnounce";

import { DEFAULT_NOTIFY } from "../../notify/defaults";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// Shape copied from `view` in backend/src/campaigns/route.ts.
const camp = (o: object = {}) => ({
  id: "c1", _rev: "1-a", name: "Spring news", subject: "Hello <b>", preheader: "", bodyText: "Hi\n\nthere", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
  status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});
const sender = (o: object = {}) => ({ ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"], ...o });
const settings = (s = sender()) => ({
  enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["linkedin"], templates: { en: {}, he: {} }, snippets: [], library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: s, notify: DEFAULT_NOTIFY,
});

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
let stored: ReturnType<typeof camp>[];
let senderDoc: ReturnType<typeof sender>;
/* How many of the 12 recipients are already at the monthly limit (the server's count). */
let atLimit = 0;
let sending = { paused: false, pausedAt: null as string | null, envDisabled: false };
beforeEach(() => {
  calls = [];
  stored = [camp(), camp({ id: "c2", name: "Sent one", status: "sent", counters: { queued: 10, sent: 9, failed: 1, suppressed: 0 }, finishedAt: "2026-11-02T10:00:00Z" })];
  senderDoc = sender();
  atLimit = 0;
  sending = { paused: false, pausedAt: null, envDisabled: false };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/admin/campaigns" && method === "GET") return json({ ok: true, campaigns: stored });
      if (url === "/api/admin/campaigns/c1" && method === "GET") return json({ ok: true, campaign: stored[0] });
      if (url === "/api/admin/campaigns/sending" && method === "POST") {
        const paused = (JSON.parse(String(init?.body)) as { paused: boolean }).paused;
        sending = { ...sending, paused, pausedAt: paused ? "2026-11-13T10:00:00Z" : null };
        return json({ ok: true, ...sending, blocked: sending.paused || sending.envDisabled });
      }
      if (url === "/api/admin/campaigns/sending") return json({ ok: true, ...sending, blocked: sending.paused || sending.envDisabled });
      if (url === "/api/admin/campaigns/audience") return json({ ok: true, count: 12, samples: ["a***@e***.com"], ...(atLimit ? { overCap: atLimit, cap: 4 } : {}) });
      if (url === "/api/admin/campaigns/preview") return json({ ok: true, subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
      if (url === "/api/admin/campaigns/c1/resume") return json({ ok: true, campaign: camp({ status: "scheduled", sendAt: "2026-11-12T10:00:00Z" }) });
      if (url === "/api/admin/campaigns/c1/send-now" && atLimit && !(JSON.parse(String(init?.body ?? "{}")) as { skipCapped?: boolean; overrideCap?: boolean }).skipCapped && !(JSON.parse(String(init?.body ?? "{}")) as { overrideCap?: boolean }).overrideCap)
        return json({ ok: false, code: "cap", capped: atLimit, total: 12, max: 4, error: "x" }, 409);
      if (url === "/api/admin/campaigns/c1/send-now") return json({ ok: true, campaign: camp({ status: "sending", counters: { queued: 12, sent: 3, failed: 0, suppressed: 0 } }) });
      if (url === "/api/admin/announce/settings" && method === "GET") return json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings: settings(senderDoc) });
      if (url === "/api/admin/announce/settings" && method === "PUT") return json({ ok: true, exists: true, _rev: "2-s", updatedAt: null, settings: (JSON.parse(String(init?.body)) as { settings: unknown }).settings, warnings: [{ field: "fromAddress", code: "domain-not-sendable", message: "Check with your mail provider." }] });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 12 }, { slug: "friends", name: "Friends", kind: "manual", total: 3, active: 3 }] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("pure helpers", () => {
  it("turns a wall time in a zone into the right instant", () => {
    expect(zonedToIso("2026-01-15T10:00", "UTC")).toBe("2026-01-15T10:00:00.000Z");
    expect(zonedToIso("2026-01-15T10:00", "Asia/Jerusalem")).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToIso("2026-07-15T10:00", "Asia/Jerusalem")).toBe("2026-07-15T07:00:00.000Z");
  });
  it("names bad sender values before Save", () => {
    expect(senderProblems(sender())).toEqual({});
    expect(senderProblems(sender({ unsubscribeNoteEn: "Thanks" })).unsubscribeNoteEn).toBe("noLink");
    expect(senderProblems(sender({ unsubscribeNoteEn: "Out {Link}" })).unsubscribeNoteEn).toBe("noLink");
    expect(senderProblems(sender({ unsubscribeNoteEn: "x {{link}}" })).unsubscribeNoteEn).toBe("unknown");
    expect(senderProblems(sender({ unsubscribeNoteEn: "{name} {link}" })).unsubscribeNoteEn).toBe("unsubVars");
    expect(Object.keys(senderProblems(sender({ throttlePerHour: 0, replyTo: "nope" })))).toEqual(["replyTo", "throttlePerHour"]);
    expect(DEFAULT_SENDER.maxPerContact30d).toBe(4);
    for (const n of [0, 4, 31]) expect(senderProblems(sender({ maxPerContact30d: n })).maxPerContact30d).toBeUndefined();
    for (const n of [-1, 32, 2.5, NaN]) expect(senderProblems(sender({ maxPerContact30d: n })).maxPerContact30d).toBe("number");
  });
});

describe("Campaigns tab", () => {
  const open = () => render(<MemoryRouter><CampaignsTab /></MemoryRouter>);

  it("lists campaigns with a status word and counters", async () => {
    open();
    expect(await screen.findByText("Spring news")).toBeTruthy();
    expect(screen.getAllByText("Sent").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("footer-blocker")).toBeNull();
  });

  it("a paused campaign says why, in plain words, and resumes only after a confirm", async () => {
    stored[0] = camp({ status: "paused", pausedReason: "auth", counters: { queued: 12, sent: 3, failed: 1, suppressed: 0 } });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    const banner = await screen.findByTestId("paused-banner");
    expect(banner.textContent).toMatch(/refused the login/);
    expect(screen.getAllByText("Paused").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Resume sending…" }));
    expect(calls.some((c) => c.url.endsWith("/resume"))).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/campaigns/c1/resume" && c.method === "POST")).toBe(true));
  });

  it("one click pauses all sending, no confirm; resuming asks first", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Pause all sending" }));
    expect(await screen.findByTestId("sending-paused")).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith("/sending") && c.method === "POST").map((c) => c.body)).toEqual([{ paused: true }]);
    fireEvent.click(screen.getByRole("button", { name: "Resume sending…" }));
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/sending"))).toHaveLength(1);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    await waitFor(() => expect(screen.queryByTestId("sending-paused")).toBeNull());
    expect(calls.filter((c) => c.url.endsWith("/sending") && c.method === "POST").map((c) => c.body)).toEqual([{ paused: true }, { paused: false }]);
  });

  it("shows a pause that is already on, and says the server setting cannot be lifted here", async () => {
    sending = { paused: true, pausedAt: "2026-11-13T10:00:00Z", envDisabled: true };
    open();
    expect(await screen.findByTestId("sending-paused")).toBeTruthy();
    expect(screen.getByTestId("sending-env-off").textContent).toMatch(/SEND_ENABLED/);
  });

  it("an unreadable sending state is an alert with a retry, never silence", async () => {
    sending = undefined as never;
    open();
    expect(await screen.findByTestId("sending-failed")).toBeTruthy();
  });

  it("blocks with a clear message when the footer identity is empty", async () => {
    senderDoc = sender({ footerIdentity: "" });
    open();
    expect(await screen.findByTestId("footer-blocker")).toBeTruthy();
  });

  it("names the missing contact email in the checklist and the section, and a postal line is optional", async () => {
    senderDoc = sender({ identityEmail: "" });
    open();
    expect(await screen.findByTestId("footer-blocker")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    expect(await screen.findByText(/Add your contact email in Sender & delivery/)).toBeTruthy();
  });

  it("offers the label policy (default off) and says so", async () => {
    senderDoc = sender();
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "sender" } });
    expect((screen.getByLabelText(/^Off\./) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/no mail carries the label/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Hebrew recipients only/));
    expect((screen.getByLabelText(/Hebrew recipients only/) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText(/no mail carries the label/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "nope" } });
    expect((screen.getByLabelText("Contact email") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
  });

  it("lists the unsubscribe-note problem among what stands between you and Send", async () => {
    senderDoc = sender({ unsubscribeNoteEn: "Thanks for reading" });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    expect(await screen.findByText(/Fix the unsubscribe note and confirmation texts in Sender & delivery/)).toBeTruthy();
  });

  it("confirms with the server's recipient count and the cannot-unsend warning before sending", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    await screen.findAllByText("12 will receive it", {}, { timeout: 3000 });
    expect(screen.getByRole("heading", { name: /Write/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Review and send/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send now…" }));
    expect(await screen.findByText("It will be emailed to 12 people.")).toBeTruthy();
    expect(screen.getByText(/cannot be unsent/)).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/send-now"))).toBe(false);
    /* The preview is asked for after a 450 ms debounce, so on a slow runner it may not have gone out yet. */
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/campaigns/preview"))).toBe(true), { timeout: 3000 });
    fireEvent.click(await screen.findByRole("button", { name: "Send to 12 now" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/send-now") && c.method === "POST")).toBe(true));
    /* The number on the button is the number the server is asked to hold the owner to. */
    expect(calls.find((c) => c.url.endsWith("/send-now") && c.method === "POST")?.body).toMatchObject({ confirmCount: 12 });
    expect(await screen.findByTestId("progress")).toBeTruthy();
  });

  it("shows the monthly limit in the checklist, then asks skip or override when the server blocks the send", async () => {
    atLimit = 2;
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    expect((await screen.findByTestId("ready-cap", {}, { timeout: 3000 })).textContent).toMatch(/2 of 12 recipients already got 4 emails in the last 30 days/);
    fireEvent.click(screen.getByRole("button", { name: "Send now…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send to 12 now" }));
    const block = await screen.findByTestId("cap-block");
    expect(block.textContent).toMatch(/2 of 12 recipients already got 4 emails/);
    // A modal <dialog> only becomes accessible once its effect opens it, after the testid is already in the DOM.
    expect(await screen.findByRole("button", { name: "Send to the other 10" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Send to everyone anyway" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/send-now") && c.body?.overrideCap === true)).toBe(true));
    expect(await screen.findByTestId("progress")).toBeTruthy();
  });

  it("skipping the capped sends with skipCapped and no override", async () => {
    atLimit = 2;
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    await screen.findByTestId("ready-cap", {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Send now…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send to 12 now" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send to the other 10" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/send-now") && c.body?.skipCapped === true && c.body?.overrideCap === undefined)).toBe(true));
  });

  it("recounts for the unsaved selection as a group is ticked", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    await screen.findAllByText("12 will receive it", {}, { timeout: 3000 });
    fireEvent.click(screen.getByLabelText(/Friends/));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/campaigns/audience")).some((c) => (c.body?.groups as string[]).includes("friends"))).toBe(true), { timeout: 3000 });
  });
});

describe("Sender & delivery", () => {
  it("round-trips the whole sender object and shows the server's warnings", async () => {
    senderDoc = sender({ quietHours: { from: "22:00", to: "07:00", tz: "Asia/Jerusalem" }, autoDraftCampaign: true });
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "sender" } });
    fireEvent.change(screen.getByLabelText("From address"), { target: { value: "news@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!.body as { settings: AnnounceSettings };
    expect(put.settings.sender).toEqual({ ...senderDoc, fromAddress: "news@example.com" });
    expect(await screen.findByText(/Check with your mail provider/)).toBeTruthy();
  });

  it("says the footer is required, and resets a field to its env default", async () => {
    senderDoc = sender({ footerIdentity: "", fromName: "Me" });
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "sender" } });
    expect(screen.getByTestId("footer-required")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset From name to env default" }));
    expect((screen.getByLabelText("From name") as HTMLInputElement).value).toBe("");
  });

  it("names a note without {link}, offers Insert {link}, and blocks Save until it is fixed", async () => {
    senderDoc = sender({ unsubscribeNoteEn: "Thanks for reading" });
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "sender" } });
    expect(screen.getByText(/The unsubscribe note must contain \{link\}, otherwise nobody can unsubscribe/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Insert {link}" }));
    expect((screen.getByLabelText("Unsubscribe line (English)") as HTMLTextAreaElement).value).toBe("Thanks for reading {link}");
    expect(screen.queryByText(/must contain \{link\}/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says it in Hebrew too", async () => {
    senderDoc = sender({ unsubscribeNoteHe: "תודה" });
    document.documentElement.lang = "he";
    try {
      render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
      fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "שולח" } });
      expect(await screen.findByText(/חייבת לכלול \{link\}/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "הוספת {link}" })).toBeTruthy();
    } finally {
      document.documentElement.lang = "en";
    }
  });
});
