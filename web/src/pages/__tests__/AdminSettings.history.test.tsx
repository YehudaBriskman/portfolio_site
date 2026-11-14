import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import AdminSettings from "@/pages/AdminSettings";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { resetSettings } from "@/settings/store";
import { json, lang, phone } from "@/components/admin/phone/__tests__/helpers";

/* /admin/settings on a phone: a sub-page is a screen (Back closes it), Escape closes it, and unsaved edits are guarded. */

let undoPhone: () => void;
beforeEach(() => {
  undoPhone = phone(true);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    return json({ ok: true, exists: true, _rev: "1-abc", version: 1, updatedAt: "2026-11-01T10:00:00.000Z", settings: structuredClone(DEFAULT_SETTINGS), history: [] });
  }));
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  resetSettings();
  lang("en");
});

function Probe() {
  return (
    <>
      <output data-testid="navtype">{useNavigationType()}</output>
      <output data-testid="search">{useLocation().search}</output>
    </>
  );
}
const page = () => render(<MemoryRouter initialEntries={["/admin/settings"]}><Probe /><AdminSettings /></MemoryRouter>);

describe("Settings on a phone: sub-pages and leaving", () => {
  it("opening a sub-page (a group with a text field) is a history entry, so Back closes it", async () => {
    page();
    fireEvent.click(await screen.findByRole("button", { name: /Link tags/ }));
    await waitFor(() => expect(screen.getByTestId("search").textContent).toContain("group=links"));
    expect(screen.getByTestId("navtype").textContent).toBe("PUSH");
  });

  it("Escape on an open sub-page goes back to the list", async () => {
    page();
    fireEvent.click(await screen.findByRole("button", { name: /Link tags/ }));
    await screen.findByRole("button", { name: "Back to settings" });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Back to settings" })).toBeNull());
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("an edited, unsaved document arms the tab-close guard", async () => {
    page();
    const ev0 = new Event("beforeunload", { cancelable: true });
    await screen.findByRole("button", { name: /Link tags/ });
    window.dispatchEvent(ev0);
    expect(ev0.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Link tags/ }));
    const input = await screen.findByLabelText(/source/i);
    fireEvent.change(input, { target: { value: "newsletter" } });
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
