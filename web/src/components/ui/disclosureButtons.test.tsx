import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LinkedInPreview from "@/components/admin/announce/previews/LinkedInPreview";
import InstagramPreview from "@/components/admin/announce/previews/InstagramPreview";
import LibraryPanel from "@/components/admin/announce/library/LibraryPanel";
import CampaignEditor from "@/components/admin/announce/campaigns/CampaignEditor";
import InboxTab from "@/components/admin/announce/inbox/InboxTab";
import StaleNotice from "@/components/admin/noteEditor/StaleNotice";
import { useEditorWords } from "@/components/admin/noteEditor/words";
import { TopList } from "@/components/dashboard/Parts";
import { DEFAULT_NOTIFY } from "@/components/admin/announce/notify/defaults";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import "@/components/admin/announce/words";
import "@/components/admin/announce/inbox/words";
import "@/components/admin/announce/campaigns/words";

/*
 * Every show/hide button on the admin and the dashboard is one DisclosureButton:
 * a real chevron, aria-expanded that flips, aria-controls that names a node
 * that exists. Layout is invisible to jsdom, so the 44px floor is read from CSS.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const long = "word ".repeat(120).trim();

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/admin/announce/settings" && method === "GET")
        return json({
          ok: true,
          exists: true,
          _rev: "1-a",
          updatedAt: null,
          settings: {
            enabled: true,
            email: { enabled: false, events: ["post"] },
            hashtags: [],
            signature: "",
            channels: ["linkedin"],
            templates: { en: {}, he: {} },
            snippets: [],
            library: [{ id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}" }],
            advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
            notify: DEFAULT_NOTIFY,
          },
        });
      if (url === "/api/admin/campaigns/c1")
        return json({
          ok: true,
          campaign: {
            id: "c1", _rev: "1-a", name: "Spring", subject: "Hello", preheader: "", bodyText: "Hi", blocks: null, groups: [], lang: "all", topic: null,
            status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null,
            startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
          },
        });
      if (url === "/api/admin/campaigns/audience") return json({ ok: true, count: 0, samples: [] });
      if (url === "/api/admin/campaigns/preview") return json({ ok: true, subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/settings") return json({ ok: true, exists: true, _rev: "9-z", version: 1, updatedAt: null, history: [], settings: DEFAULT_SETTINGS });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

/** Click `btn` and check the three things a toggle owes a reader. */
function exercise(btn: HTMLElement) {
  expect(btn.querySelector("svg[aria-hidden='true']"), "chevron svg").not.toBeNull();
  const before = btn.getAttribute("aria-expanded");
  expect(before === "true" || before === "false").toBe(true);
  const controls = btn.getAttribute("aria-controls");
  expect(controls, "aria-controls").toBeTruthy();
  fireEvent.click(btn);
  const after = btn.isConnected ? btn : screen.getByRole("button", { expanded: before === "false" });
  expect(after.getAttribute("aria-expanded")).toBe(before === "true" ? "false" : "true");
  // Open state: the controlled region exists. (A region that is not rendered while
  // closed may only be named once it is there.)
  const id = after.getAttribute("aria-controls")!;
  const open = after.getAttribute("aria-expanded") === "true";
  if (open) expect(document.getElementById(id), `#${id} exists when open`).not.toBeNull();
  return after;
}

describe("toggle buttons are DisclosureButtons", () => {
  it("row 21: campaign preview pane", async () => {
    render(<CampaignEditor id="c1" sender={null} groups={[]} events={[]} onClose={() => {}} onChanged={() => {}} />);
    const btn = await screen.findAllByRole("button", { name: /show preview/i });
    exercise(btn[0]);
  });

  it("row 22: stale-translation diff", () => {
    const editorWords = renderHook(() => useEditorWords()).result.current[0];
    const statuses = { title: null, subtitle: null, excerpt: null, body: "stale" } as never;
    render(<StaleNotice statuses={statuses} base="a" english="b" words={editorWords} disabled={false} slug="s" rev="1-a" onAcked={async () => {}} />);
    exercise(screen.getByRole("button", { name: editorWords.showChanges }));
  });

  it("row 23: template library Open", async () => {
    render(<LibraryPanel />);
    const btn = await screen.findByRole("button", { name: /edit launch/i });
    exercise(btn);
  });

  it("row 24: Instagram folded text", () => {
    render(<InstagramPreview text={long} />);
    exercise(screen.getByRole("button", { name: /more/i }));
  });

  it("row 25: LinkedIn is one button, and focus stays on it", () => {
    render(<LinkedInPreview text={long} />);
    const btn = screen.getByRole("button", { name: /see more/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(btn.isConnected, "the same node survives the toggle").toBe(true);
    expect(document.activeElement).toBe(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.textContent).toMatch(/see less/i);
    expect(btn.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(document.getElementById(btn.getAttribute("aria-controls")!)).not.toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(1);
  });

  it("row 26: new announcement controls its form", () => {
    render(
      <MemoryRouter>
        <InboxTab items={[]} error={null} onRetry={() => {}} onChange={() => {}} onCreated={() => {}} />
      </MemoryRouter>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.hasAttribute("aria-expanded"))!;
    exercise(btn);
  });

  it("row 27: dashboard show more", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, label: `Area ${i}`, to: `/a/${i}` }));
    render(
      <MemoryRouter>
        <TopList title="Areas" items={items} limit={3} />
      </MemoryRouter>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("aria-expanded") !== null && /more/i.test(b.textContent ?? ""))!;
    exercise(btn);
  });
});

describe("dashboard .more", () => {
  it("is at least 2.75rem tall", () => {
    const css = readFileSync(resolve(__dirname, "../dashboard/Dashboard.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => /\.more\b/.test(sel) && !/:/.test(sel));
    const heights = rules.map(([, , body]) => /min-height:\s*([\d.]+)rem/.exec(body)?.[1]).filter(Boolean).map(Number);
    expect(Math.max(0, ...heights)).toBeGreaterThanOrEqual(2.75);
  });
});
