import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import SettingsPanel from "@/components/admin/announce/SettingsPanel";
import { DEFAULT_NOTIFY } from "@/components/admin/announce/notify/defaults";
import { DEFAULT_SENDER } from "@/components/admin/announce/sender/defaults";

/* UI hunt h4: the Marketing Settings kit on a phone (sub-page, Back, Esc, leaving with edits). Each test passes once the bug is fixed. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const base = () => ({
  enabled: true, email: { enabled: false, events: ["post", "release"] }, hashtags: ["build"], signature: "",
  channels: ["linkedin", "email"], templates: { en: {}, he: {} }, snippets: [], library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  sender: { ...DEFAULT_SENDER, footerIdentity: "Yehuda", identityEmail: "me@example.com", testRecipients: ["me@example.com"] },
  notify: DEFAULT_NOTIFY,
});
function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings: base() });
    if (url.startsWith("/api/admin/announce/budget")) return json({ ok: false }, 500);
    return json({ ok: true });
  }));
}
const realMatchMedia = window.matchMedia;
function asPhone() {
  window.matchMedia = ((q: string) => ({ ...realMatchMedia(q), matches: /max-width:\s*599/.test(q), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as typeof window.matchMedia;
}
beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); }),
    close: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }),
  });
  asPhone();
  stub();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

function Probe() {
  return (
    <>
      <output data-testid="navtype">{useNavigationType()}</output>
      <output data-testid="search">{useLocation().search}</output>
    </>
  );
}
const panel = () => render(<MemoryRouter initialEntries={["/admin/marketing?tab=settings"]}><Probe /><SettingsPanel /></MemoryRouter>);
const groupRow = (id: string) => document.querySelector<HTMLElement>(`[data-settings-group="${id}"]`)!;

describe("Marketing Settings on a phone (h4)", () => {
  /* B-h4-13 */
  it("opening a sub-page (a group with a text field) must add a history entry so the Back button closes it", async () => {
    panel();
    await screen.findByRole("searchbox", { name: "Search settings" });
    expect(screen.getByTestId("navtype").textContent).toBe("POP");
    fireEvent.click(within(groupRow("wording")).getByRole("button"));
    await waitFor(() => expect(screen.getByTestId("search").textContent).toContain("section=wording"));
    // A sheet owns a history entry (BottomSheet pushes one). A sub-page is a screen: it must be a PUSH, or Back leaves /admin/marketing and drops the unsaved edits.
    expect(screen.getByTestId("navtype").textContent).toBe("PUSH");
  });

  /* B-h4-14 */
  it("Escape on an open sub-page goes back to the list", async () => {
    panel();
    await screen.findByRole("searchbox", { name: "Search settings" });
    fireEvent.click(within(groupRow("wording")).getByRole("button"));
    await screen.findByRole("button", { name: /^back to settings$/i });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /^back to settings$/i })).toBeNull());
  });

  /* B-h4-15 */
  it("an edited, unsaved settings document arms the tab-close guard (beforeunload)", async () => {
    panel();
    await screen.findByRole("searchbox", { name: "Search settings" });
    fireEvent.click(within(groupRow("wording")).getByRole("button"));
    const signature = await screen.findByRole("textbox", { name: /signature/i });
    fireEvent.change(signature, { target: { value: "-- Yehuda, a long unsaved signature" } });
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
