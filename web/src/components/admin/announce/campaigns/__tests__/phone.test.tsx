import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampaignsTab from "../CampaignsTab";
import { DEFAULT_SENDER } from "../../sender/defaults";
import { DEFAULT_NOTIFY } from "../../notify/defaults";
import { CAMPAIGN_STATUSES } from "@/services/adminCampaigns";

/*
 * The Campaigns tab below 600px: a RecordRow per campaign, one sheet for the
 * rest, bulk select for drafts only. jsdom has no layout, so what it cannot
 * see (no horizontal scroll, rows above the fold) is read off the CSS text
 * here and measured in a real browser for the PR.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const camp = (o: object = {}) => ({
  id: "c1", _rev: "1-a", name: "Spring news", subject: "Hello <b>", preheader: "", bodyText: "Hi\n\nthere", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
  status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, testedAt: null, capOverride: null,
  startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});
const sender = { ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"] };
const settings = {
  enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["linkedin"], templates: { en: {}, he: {} }, snippets: [], library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender, notify: DEFAULT_NOTIFY,
};

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
let stored: ReturnType<typeof camp>[];

const fresh = () => [
  camp(),
  camp({ id: "c2", name: "Sent one", status: "sent", counters: { queued: 10, sent: 9, failed: 1, suppressed: 0 }, startedAt: "2026-11-02T09:00:00Z", finishedAt: "2026-11-02T10:00:00Z" }),
  camp({ id: "c3", name: "Live blast", status: "sending", counters: { queued: 100, sent: 40, failed: 0, suppressed: 0 }, startedAt: "2026-11-13T09:00:00Z" }),
  camp({ id: "c4", name: "Later", status: "scheduled", sendAt: "2026-12-01T09:00:00Z" }),
  camp({ id: "c5", name: "Stuck", status: "paused", pausedReason: "auth", counters: { queued: 12, sent: 3, failed: 1, suppressed: 0 } }),
  camp({ id: "c6", name: "Second draft" }),
];

/** Below 600px: the one media query the tab asks. */
function phone(on: boolean) {
  const real = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    ...real(q),
    matches: on && /max-width:\s*599px/.test(q),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = real;
  };
}

let undoPhone: () => void;
beforeEach(() => {
  window.localStorage.clear();
  calls = [];
  stored = fresh();
  undoPhone = phone(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/admin/campaigns" && method === "GET") return json({ ok: true, campaigns: stored });
      if (url === "/api/admin/campaigns" && method === "POST") return json({ ok: true, campaign: camp({ id: `n${calls.length}`, ...(body ?? {}) }) });
      const one = /^\/api\/admin\/campaigns\/(c\d)$/.exec(url);
      if (one && method === "GET") return json({ ok: true, campaign: stored.find((c) => c.id === one[1]) });
      if (one && method === "DELETE") return json({ ok: true });
      if (url === "/api/admin/campaigns/sending") return json({ ok: true, paused: false, pausedAt: null, envDisabled: false, blocked: false });
      if (url === "/api/admin/campaigns/audience") return json({ ok: true, count: 12, samples: ["a***@e***.com"] });
      if (url === "/api/admin/campaigns/preview") return json({ ok: true, subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
      if (/\/c1\/test$/.test(url)) return json({ ok: true, sent: 1, failed: 0 });
      if (/\/c3\/cancel$/.test(url)) return json({ ok: true, campaign: camp({ id: "c3", name: "Live blast", status: "canceled" }) });
      if (/\/c5\/resume$/.test(url)) return json({ ok: true, campaign: camp({ id: "c5", name: "Stuck", status: "sending" }) });
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 12 }] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

const open = () => render(<MemoryRouter><CampaignsTab /></MemoryRouter>);
const rowOf = (name: string) => screen.findByRole("button", { name: `Open ${name}` });
const dialog = () => screen.findByRole("dialog");

describe("Campaigns on a phone: the list", () => {
  it("draws a row per campaign, not a table, and no repeated pill", async () => {
    open();
    await rowOf("Spring news");
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.querySelectorAll(".a-pill").length).toBe(0);
    for (const c of stored) expect(screen.getByRole("button", { name: `Open ${c.name}` })).toBeTruthy();
  });

  it("each row is one button with at most 3 facts, one status glyph and nothing interactive inside", async () => {
    open();
    await rowOf("Spring news");
    const rows = document.querySelectorAll<HTMLElement>("[data-record-row]");
    expect(rows.length).toBe(stored.length);
    rows.forEach((row) => {
      expect(row.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(3);
      expect(row.querySelectorAll("[data-kind]").length).toBeLessThanOrEqual(1);
      expect(row.querySelectorAll("button, a, input, select, textarea").length).toBe(0);
    });
  });

  it("names every status in the row's description, so no status is colour or shape alone", async () => {
    stored = CAMPAIGN_STATUSES.map((s) => camp({ id: `c${CAMPAIGN_STATUSES.indexOf(s) + 1}`, name: `Is ${s}`, status: s, counters: { queued: 10, sent: 4, failed: 0, suppressed: 0 } }));
    open();
    await rowOf("Is draft");
    const words: Record<string, string> = { draft: "Draft", scheduled: "Scheduled", sending: "Sending", sent: "Sent", failed: "Failed", canceled: "Canceled", paused: "Paused" };
    for (const s of CAMPAIGN_STATUSES) {
      const row = screen.getByRole("button", { name: `Open Is ${s}` });
      const desc = document.getElementById(row.getAttribute("aria-describedby")!);
      expect(desc?.querySelector(`[role="img"][aria-label="${words[s]}"]`)).toBeTruthy();
    }
  });

  it("shows a progress bar only on a campaign that is sending or paused", async () => {
    open();
    await rowOf("Live blast");
    const bars = (name: string) => within(screen.getByRole("button", { name: `Open ${name}` })).queryAllByRole("img", { name: /of 100|of 12/ });
    expect(bars("Live blast").length).toBe(1);
    expect(bars("Stuck").length).toBe(1);
    expect(bars("Spring news").length).toBe(0);
    expect(bars("Sent one").length).toBe(0);
  });

  it("keeps Pause all sending visible above the list", async () => {
    open();
    expect(await screen.findByRole("button", { name: "Pause all sending" })).toBeTruthy();
  });

  it("its CSS has no horizontal scroller, fixed width or physical side", () => {
    const css = readFileSync(resolve(__dirname, "../CampaignsPhone.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/overflow-x\s*:\s*(auto|scroll)/);
    expect(css).not.toMatch(/(^|[;{\s])(width|min-width)\s*:\s*\d+px/);
    expect(css).not.toMatch(/(^|[;{\s])(margin|padding)-(left|right)\s*:/);
    expect(css).not.toMatch(/(^|[;{\s])(left|right)\s*:/);
  });
});

describe("Campaigns on a phone: filters", () => {
  it("a stage chip narrows the list and says it is on", async () => {
    open();
    await rowOf("Spring news");
    const chip = screen.getByRole("button", { name: "Drafts" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open Sent one" })).toBeNull());
    expect(screen.getByRole("button", { name: "Open Spring news" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Second draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drafts" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("says so when a filter leaves nothing", async () => {
    stored = [camp()];
    open();
    await rowOf("Spring news");
    fireEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(await screen.findByText("No campaign matches these filters.")).toBeTruthy();
  });
});

describe("Campaigns on a phone: the sheet", () => {
  it("opens from the whole row with the details, the lifecycle, counters and actions, and hands focus back on close", async () => {
    open();
    const row = await rowOf("Live blast");
    row.focus();
    fireEvent.click(row);
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Live blast" })).toBeTruthy();
    const steps = within(d).getByRole("list", { name: "Where this campaign is" });
    expect(within(steps).getAllByRole("listitem").length).toBe(4);
    expect(within(steps).getByText("Sending").closest("li")?.getAttribute("aria-current")).toBe("step");
    expect(d.textContent).toMatch(/40/);
    expect(within(d).getByRole("button", { name: "Cancel sending…" })).toBeTruthy();
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("asks before it cancels, with the existing words, and the server is only called after the confirm", async () => {
    open();
    fireEvent.click(await rowOf("Live blast"));
    const d = await dialog();
    fireEvent.click(within(d).getByRole("button", { name: "Cancel sending…" }));
    expect(await within(await dialog()).findByText("Mail not yet sent will not be sent. Mail already sent stays sent.")).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/cancel"))).toBe(false);
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Cancel campaign" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/campaigns/c3/cancel" && c.method === "POST")).toBe(true));
  });

  it("keeps the Keep it way out of the cancel confirm", async () => {
    open();
    fireEvent.click(await rowOf("Live blast"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Cancel sending…" }));
    fireEvent.click(await within(await dialog()).findByRole("button", { name: "Keep it" }));
    expect(calls.some((c) => c.url.endsWith("/cancel"))).toBe(false);
    expect(within(await dialog()).getByRole("button", { name: "Cancel sending…" })).toBeTruthy();
  });

  it("a paused campaign says why and resumes only after a confirm", async () => {
    open();
    fireEvent.click(await rowOf("Stuck"));
    const d = await dialog();
    expect(d.textContent).toMatch(/refused the login/);
    fireEvent.click(within(d).getByRole("button", { name: "Resume sending…" }));
    expect(calls.some((c) => c.url.endsWith("/resume"))).toBe(false);
    fireEvent.click(await within(await dialog()).findByRole("button", { name: "Resume" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/campaigns/c5/resume" && c.method === "POST")).toBe(true));
  });

  it("sends a test of a saved draft straight from the sheet", async () => {
    open();
    fireEvent.click(await rowOf("Spring news"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Send test" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/campaigns/c1/test" && c.method === "POST")).toBe(true));
    expect(await within(await dialog()).findByText("Test sent to 1 address.")).toBeTruthy();
  });

  it("send now and schedule never fire from the sheet: they open the composer, whose count and confirm stand", async () => {
    open();
    fireEvent.click(await rowOf("Spring news"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Send now…" }));
    expect(await screen.findByTestId("campaign-editor")).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/send-now") || c.url.endsWith("/schedule"))).toBe(false);
  });

  it("duplicates a campaign into a new draft", async () => {
    open();
    fireEvent.click(await rowOf("Sent one"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/campaigns" && c.method === "POST")).toBe(true));
    const made = calls.find((c) => c.url === "/api/admin/campaigns" && c.method === "POST")!.body!;
    expect(made.name).toBe("Copy of Sent one");
    expect(made.subject).toBe("Hello <b>");
    expect("status" in made).toBe(false);
  });

  it("offers no sending action on a sent campaign", async () => {
    open();
    fireEvent.click(await rowOf("Sent one"));
    const d = await dialog();
    for (const n of ["Send now…", "Send test", "Cancel sending…", "Resume sending…"]) expect(within(d).queryByRole("button", { name: n })).toBeNull();
    expect(d.textContent).toMatch(/9/);
  });
});

describe("Campaigns on a phone: bulk select", () => {
  it("lists only drafts in select mode and selects only drafts", async () => {
    open();
    await rowOf("Spring news");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open Sent one" })).toBeNull());
    expect(screen.queryByRole("checkbox", { name: "Open Live blast" })).toBeNull();
    expect(screen.getAllByRole("checkbox").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(await screen.findByText("2 selected")).toBeTruthy();
  });

  it("duplicates the chosen drafts", async () => {
    open();
    await rowOf("Spring news");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/admin/campaigns" && c.method === "POST").length).toBe(2));
  });

  it("deletes drafts only after a confirm that names the count", async () => {
    open();
    fireEvent.click((await rowOf("Spring news")));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Open Spring news" }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Delete/ }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Delete 1 draft" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(["/api/admin/campaigns/c1"]));
  });
});

describe("Campaigns on a phone: Hebrew", () => {
  it("renders the list and the sheet in Hebrew with no English chrome left", async () => {
    document.documentElement.lang = "he";
    document.documentElement.setAttribute("dir", "rtl");
    open();
    const row = await screen.findByRole("button", { name: /Live blast/ });
    expect(row.getAttribute("aria-label")).toMatch(/[֐-׿]/);
    row.focus();
    fireEvent.click(row);
    const d = await dialog();
    const data = ["Live blast", "Hello <b>", "Subscribers", "subscribers"];
    const text = data.reduce((t, s) => t.split(s).join(""), d.textContent ?? "");
    expect(text.match(/[A-Za-z]{3,}/g) ?? []).toEqual([]);
    fireEvent.click(within(d).getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });
});

describe("Campaigns on a phone: the composer", () => {
  it("puts the rarely used fields behind one closed Advanced disclosure and reviews with a Journey", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "New campaign" }));
    const pre = await screen.findByLabelText("Preview text");
    const adv = pre.closest("details");
    expect(adv).toBeTruthy();
    expect(adv!.open).toBe(false);
    expect(within(adv!).getByLabelText("Internal name")).toBeTruthy();
    expect(screen.getByLabelText("Subject").closest("details")).toBeNull();
    const journey = await screen.findByRole("list", { name: /^From .* to .*12/ }, { timeout: 3000 });
    expect(journey).toBeTruthy();
    expect(document.querySelector("[data-testid='campaign-editor'] dl")).toBeNull();
  });
});

describe("Campaigns at 600px and wider", () => {
  it("is still the table", async () => {
    undoPhone();
    undoPhone = phone(false);
    open();
    expect(await screen.findByRole("table", { name: "Campaigns" })).toBeTruthy();
    expect(document.querySelector("[data-record-row]")).toBeNull();
  });
});
