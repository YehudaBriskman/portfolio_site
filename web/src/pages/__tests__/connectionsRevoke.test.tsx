import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminConnections from "@/pages/AdminConnections";

/* B-h3-10: one failed Revoke replaces the whole connections list with "Couldn't load this". */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

it("a failed revoke keeps the list on screen", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  vi.stubGlobal("confirm", () => true);
  const grant = { id: "g1", client: "Claude", scopes: ["mcp:read"], login: "o", createdAt: "2026-11-01T00:00:00Z", lastUsedAt: null, expiresAt: "2027-01-01T00:00:00Z", revokedAt: null, revokedReason: null, status: "active" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    if (url.startsWith("/api/admin/mcp/grants") && init?.method === "DELETE") return json({ error: "boom" }, 500);
    if (url.startsWith("/api/admin/mcp/grants")) return json({ ok: true, items: [grant] });
    return json({ ok: true, items: [] });
  }));
  render(<MemoryRouter><AdminConnections /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke Claude" }));
  await waitFor(() => expect(document.body.textContent).toMatch(/boom|Revoke failed/));
  expect(screen.queryByRole("button", { name: "Revoke Claude" }), "the list was replaced by the error").not.toBeNull();
});
