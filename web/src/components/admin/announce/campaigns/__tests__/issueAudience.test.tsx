import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CampaignsTab from "../CampaignsTab";
import { DEFAULT_SENDER } from "../../sender/defaults";
import { DEFAULT_NOTIFY } from "../../notify/defaults";

/* Issue #594: who an issue reaches depends on its blocks' topics, so the count the owner confirms must be asked with them. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("the audience count of an issue", () => {
  it("is asked with the issue's kind and blocks", async () => {
    const blocks = [{ type: "p", text: "v1.2.0", topic: "releases" }];
    const issue = {
      id: "c9", _rev: "1-a", name: "Issue", subject: "1 release", preheader: "", bodyText: "v1.2.0", blocks, groups: ["subscribers"], lang: "all", topic: null, kind: "issue",
      status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, testedAt: null, capOverride: null,
      startedAt: null, finishedAt: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
    };
    const asked: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/admin/campaigns" && (init?.method ?? "GET") === "GET") return json({ ok: true, campaigns: [] });
      if (url === "/api/admin/campaigns/compile") return json({ ok: true, campaign: issue }, 201);
      if (url === "/api/admin/campaigns/c9") return json({ ok: true, campaign: issue });
      if (url === "/api/admin/campaigns/sending") return json({ ok: true, paused: false, pausedAt: null, envDisabled: false, blocked: false });
      if (url === "/api/admin/campaigns/audience") {
        asked.push(JSON.parse(String(init?.body)));
        return json({ ok: true, count: 3, samples: [] });
      }
      if (url === "/api/admin/campaigns/preview") return json({ ok: true, subject: "1 release", html: "<p>v</p>", text: "v" });
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings: { enabled: true, email: { enabled: false, events: [] }, hashtags: [], signature: "", channels: [], templates: { en: {}, he: {} }, snippets: [], library: [], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: DEFAULT_SENDER, notify: DEFAULT_NOTIFY } });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 3, active: 3 }] });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      return json({ ok: true });
    }));
    render(<MemoryRouter><CampaignsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /compile issue/i }));
    await waitFor(() => expect(asked.at(-1)).toMatchObject({ kind: "issue", blocks }));
  });
});
