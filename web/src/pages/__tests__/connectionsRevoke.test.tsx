import { afterEach, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminConnections from "@/pages/AdminConnections";

/* B-h3-10: one failed Revoke replaces the whole connections list with "Couldn't load this".
   S5 (#840): Revoke is not drawn on the row; it is a menu item that asks first, in outcome words. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
/* jsdom has no <dialog>.showModal: the stand-ins only flip `open`. */
beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); },
    close(this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

function setup(deleteStatus: number) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  const grant = { id: "g1", client: "Claude", scopes: ["mcp:read"], login: "o", createdAt: "2026-11-01T00:00:00Z", lastUsedAt: null, expiresAt: "2027-01-01T00:00:00Z", revokedAt: null, revokedReason: null, status: "active" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    if (url.startsWith("/api/admin/mcp/grants") && init?.method === "DELETE")
      return deleteStatus === 200 ? json({ ok: true, item: { ...grant, status: "revoked", revokedAt: "2026-11-15T00:00:00Z" } }) : json({ error: "boom" }, deleteStatus);
    if (url.startsWith("/api/admin/mcp/grants")) return json({ ok: true, items: [grant] });
    return json({ ok: true, items: [] });
  }));
  render(<MemoryRouter><AdminConnections /></MemoryRouter>);
}

async function openConfirm() {
  expect((await screen.findAllByText("Claude")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /^Revoke/ }), "Revoke is not drawn at rest").toBeNull();
  await userEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
  await userEvent.click(await screen.findByRole("menuitem", { name: /Revoke/ }));
  await waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
  return document.querySelector("dialog")!;
}

it("Revoke is a quiet menu item behind a confirm that names the outcome", async () => {
  setup(500);
  const dlg = await openConfirm();
  expect(within(dlg).getByRole("button", { name: "Revoke Claude", hidden: true })).toBeTruthy();
  expect(within(dlg).getByRole("button", { name: "Keep", hidden: true })).toBeTruthy();
});

it("a failed revoke keeps the list on screen", async () => {
  setup(500);
  const dlg = await openConfirm();
  fireEvent.click(within(dlg).getByRole("button", { name: "Revoke Claude", hidden: true }));
  await waitFor(() => expect(document.body.textContent).toMatch(/boom|could not be revoked/));
  expect(screen.queryAllByText("Claude").length, "the list was replaced by the error").toBeGreaterThan(0);
});
