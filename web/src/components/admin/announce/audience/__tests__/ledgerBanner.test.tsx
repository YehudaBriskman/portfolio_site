import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LedgerBanner from "../LedgerBanner";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const zero = { unsubscribed: 0, suppressed: 0, erased: 0 };
const calls: string[] = [];
const serve = (state: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return json(url.endsWith("/ack") ? { ok: true, acknowledged: true } : state);
    }),
  );
afterEach(() => (cleanup(), vi.unstubAllGlobals(), (calls.length = 0)));

describe("LedgerBanner", () => {
  it("renders nothing when the ledger is ready and nothing was repaired", async () => {
    serve({ ok: true, ready: true, counts: zero, report: null });
    const { container } = render(<LedgerBanner />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(container.textContent).toBe("");
  });

  it("says sending is held when the ledger cannot be read", async () => {
    serve({ ok: true, ready: false, counts: zero, report: null });
    render(<LedgerBanner />);
    expect(await screen.findByTestId("ledger-banner")).toHaveTextContent("cannot be read");
  });

  it("reports counts of repaired people and confirms with one click", async () => {
    serve({ ok: true, ready: true, counts: zero, report: { at: "2026-11-01T10:00:00Z", repaired: { unsubscribed: 2, suppressed: 1, erased: 3 }, acknowledgedAt: null } });
    render(<LedgerBanner />);
    const banner = await screen.findByTestId("ledger-banner");
    expect(banner).toHaveTextContent("unsubscribed (2)");
    expect(banner).toHaveTextContent("erased (3)");
    fireEvent.click(screen.getByRole("button", { name: "I have checked" }));
    await waitFor(() => expect(calls).toContain("POST /api/admin/audience/ledger/ack"));
  });

  it("stays quiet once the report is acknowledged", async () => {
    serve({ ok: true, ready: true, counts: zero, report: { at: "2026-11-01T10:00:00Z", repaired: { ...zero, erased: 1 }, acknowledgedAt: "2026-11-02T10:00:00Z" } });
    const { container } = render(<LedgerBanner />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(container.textContent).toBe("");
  });
});
