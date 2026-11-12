import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampaignsTab from "../CampaignsTab";
import SettingsPanel from "../../SettingsPanel";
import { DEFAULT_SENDER, senderProblems } from "../../sender/defaults";
import { previewMail, zonedToIso } from "../mailPreview";
import type { AnnounceSettings } from "@/services/adminAnnounce";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// Shape copied from `view` in backend/src/campaigns/route.ts.
const camp = (o: object = {}) => ({
  id: "c1", _rev: "1-a", name: "Spring news", subject: "Hello <b>", preheader: "", bodyText: "Hi\n\nthere", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
  status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});
const sender = (o: object = {}) => ({ ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", testRecipients: ["me@example.com"], ...o });
const settings = (s = sender()) => ({
  enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["linkedin"], templates: { en: {}, he: {} }, snippets: [], library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: s,
});

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
let stored: ReturnType<typeof camp>[];
let senderDoc: ReturnType<typeof sender>;
beforeEach(() => {
  calls = [];
  stored = [camp(), camp({ id: "c2", name: "Sent one", status: "sent", counters: { queued: 10, sent: 9, failed: 1, suppressed: 0 }, finishedAt: "2026-11-02T10:00:00Z" })];
  senderDoc = sender();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/admin/campaigns" && method === "GET") return json({ ok: true, campaigns: stored });
      if (url === "/api/admin/campaigns/c1" && method === "GET") return json({ ok: true, campaign: stored[0] });
      if (url === "/api/admin/campaigns/c1/audience") return json({ ok: true, count: 12, samples: ["a***@e***.com"] });
      if (url === "/api/admin/campaigns/c1/send-now") return json({ ok: true, campaign: camp({ status: "sending", counters: { queued: 12, sent: 3, failed: 0, suppressed: 0 } }) });
      if (url === "/api/admin/announce/settings" && method === "GET") return json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings: settings(senderDoc) });
      if (url === "/api/admin/announce/settings" && method === "PUT") return json({ ok: true, exists: true, _rev: "2-s", updatedAt: null, settings: (JSON.parse(String(init?.body)) as { settings: unknown }).settings, warnings: [{ field: "fromAddress", code: "domain-not-sendable", message: "Check with your mail provider." }] });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 12 }] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("pure helpers", () => {
  it("escapes everything in the preview and adds the Hebrew label", () => {
    const m = previewMail({ subject: "Hi", preheader: "", bodyText: "<script>x</script>", blocks: null }, "he", sender(), "example.com");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain('dir="rtl"');
    expect(m.subject.startsWith("פרסומת: ")).toBe(true);
  });
  it("turns a wall time in a zone into the right instant", () => {
    expect(zonedToIso("2026-01-15T10:00", "UTC")).toBe("2026-01-15T10:00:00.000Z");
    expect(zonedToIso("2026-01-15T10:00", "Asia/Jerusalem")).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToIso("2026-07-15T10:00", "Asia/Jerusalem")).toBe("2026-07-15T07:00:00.000Z");
  });
  it("names bad sender values before Save", () => {
    expect(senderProblems(sender())).toEqual({});
    expect(Object.keys(senderProblems(sender({ throttlePerHour: 0, replyTo: "nope" })))).toEqual(["replyTo", "throttlePerHour"]);
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

  it("blocks with a clear message when the footer identity is empty", async () => {
    senderDoc = sender({ footerIdentity: "" });
    open();
    expect(await screen.findByTestId("footer-blocker")).toBeTruthy();
  });

  it("confirms with the server's recipient count and the cannot-unsend warning before sending", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring news" }));
    await screen.findByText("12 will receive it");
    fireEvent.click(screen.getByRole("button", { name: "Send now…" }));
    expect(await screen.findByText("It will be emailed to 12 people.")).toBeTruthy();
    expect(screen.getByText(/cannot be unsent/)).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/send-now"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Send to 12 now" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/send-now") && c.method === "POST")).toBe(true));
    expect(await screen.findByTestId("progress")).toBeTruthy();
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
});
