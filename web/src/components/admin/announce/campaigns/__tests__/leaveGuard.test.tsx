import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CampaignEditor from "../CampaignEditor";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const camp = {
  id: "c1", _rev: "1-a", name: "Spring news", subject: "Hello", preheader: "", bodyText: "Hi there", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
  status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, startedAt: null, finishedAt: null,
  createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
};
const unload = () => {
  const ev = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/admin/campaigns/c1") return json({ ok: true, campaign: camp });
    if (url === "/api/admin/campaigns/audience") return json({ ok: true, count: 1, samples: [] });
    return json({ ok: true });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const editor = (id: string) => render(<CampaignEditor id={id} sender={null} groups={[]} events={[]} onClose={() => undefined} onChanged={() => undefined} />);

describe("Campaign composer leave guard", () => {
  it("an edited, unsaved campaign arms the tab-close guard", async () => {
    editor("c1");
    const subject = await screen.findByDisplayValue("Hello");
    expect(unload()).toBe(false);
    fireEvent.change(subject, { target: { value: "Hello, edited" } });
    expect(unload()).toBe(true);
  });

  it("a new campaign nobody has typed into does not nag", async () => {
    editor("new");
    await screen.findByLabelText(/^subject/i);
    expect(unload()).toBe(false);
  });

  it("a new campaign with typed text arms the guard", async () => {
    editor("new");
    fireEvent.change(await screen.findByLabelText(/^subject/i), { target: { value: "Draft subject" } });
    expect(unload()).toBe(true);
  });
});
