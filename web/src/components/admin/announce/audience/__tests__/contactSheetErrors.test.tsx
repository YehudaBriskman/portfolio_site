import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToastHost from "@/components/ui/ToastHost";
import { __resetToasts } from "@/lib/toast";
import AudienceTab from "../AudienceTab";

/*
 * A failed action on the contact sheet says what it was doing, never "check the fields" for an action that has no
 * fields (the production bug: erasing a suppressed contact answered 409 and the sheet said "That could not be saved").
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ada = {
  hash: "h1", email: "ada@example.com", name: "Ada", lang: "en", groups: ["subscribers"], status: "suppressed", source: "site",
  consentAt: "2026-01-02T00:00:00Z", createdAt: "2026-01-02T00:00:00Z", consentNote: "form v1", topics: { blog: true, releases: true },
};
let fail: { method: string; status: number } | null;
let attempts: string[];

beforeEach(() => {
  fail = null;
  attempts = [];
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 599px"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        attempts.push(method);
        if (fail && fail.method === method) return json({ ok: false, error: "x" }, fail.status);
      }
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [{ slug: "subscribers", name: "Subscribers", kind: "system", total: 1, active: 0 }] });
      if (url.startsWith("/api/admin/audience/contacts?")) return json({ ok: true, contacts: [ada], nextCursor: null });
      if (url === "/api/admin/audience/sweep") return json({ ok: true, pendingTtlDays: 7, report: null });
      if (url === "/api/admin/audience/suppression") return json({ ok: true, suppressed: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => {
  __resetToasts();
  cleanup();
  vi.unstubAllGlobals();
});

async function openSheet() {
  render(<MemoryRouter initialEntries={["/admin/marketing?tab=audience"]}><AudienceTab /><ToastHost /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open Ada" }));
  return screen.findByRole("dialog", { name: "Ada" });
}

describe("contact sheet: a failed action says what failed", () => {
  it.each([409, 500, 404])("erase failing with %i names the erasure, offers Try again, and does not blame fields", async (status) => {
    fail = { method: "DELETE", status };
    const dlg = await openSheet();
    fireEvent.click(within(dlg).getByText("Erase contact", { selector: "summary span" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Erase contact" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Erase ada@example.com for good" }));
    const alert = await within(dlg).findByRole("alert");
    expect(alert.textContent).toMatch(/erase/i);
    expect(alert.textContent).not.toMatch(/fields|could not be saved/i);
    const retry = within(alert).getByRole("button", { name: "Try again" });
    fail = null;
    fireEvent.click(retry);
    await waitFor(() => expect(attempts.filter((m) => m === "DELETE")).toHaveLength(2));
  });

  it("save failing says the changes were not saved (not 'check the fields') unless the server named a field", async () => {
    fail = { method: "PATCH", status: 500 };
    const dlg = await openSheet();
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    const alert = await within(dlg).findByRole("alert");
    expect(alert.textContent).toMatch(/not saved/i);
    expect(alert.textContent).not.toMatch(/fields/i);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("an ended session gets its own sentence", async () => {
    fail = { method: "DELETE", status: 401 };
    const dlg = await openSheet();
    fireEvent.click(within(dlg).getByText("Erase contact", { selector: "summary span" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Erase contact" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Erase ada@example.com for good" }));
    expect((await within(dlg).findByRole("alert")).textContent).toMatch(/sign in/i);
  });
});
