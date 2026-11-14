import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminConnections from "@/pages/AdminConnections";
import { controlsIn, factsOf, json, lang, phone, rows, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * Connected apps below 600px (#682): a row per grant (icon, name, last used,
 * one status glyph), the scopes and expiry in a sheet, and Revoke only from
 * that sheet, behind a confirm that names the app.
 */

const grant = (id: string, client: string, o: object = {}) => ({
  id, client, scopes: ["mcp:read"], login: "yehuda", createdAt: "2026-10-01T10:00:00Z", lastUsedAt: "2026-11-12T10:00:00Z",
  expiresAt: "2026-12-01T10:00:00Z", revokedAt: null, revokedReason: null, status: "active", ...o,
});
const GRANTS = [
  grant("g1", "Claude Code", { scopes: ["mcp:read", "mcp:write"] }),
  grant("g2", "A client with a deliberately long name that has to wrap on a phone"),
  grant("g3", "Old client", { status: "revoked", revokedAt: "2026-11-05T10:00:00Z", revokedReason: "owner" }),
  grant("g4", "Lapsed client", { status: "expired", lastUsedAt: null }),
];

let calls: ReturnType<typeof stubFetch>;
let undoPhone: () => void;
beforeEach(() => {
  undoPhone = phone(true);
  calls = stubFetch((url, init) => {
    if (url === "/api/admin/mcp/grants") return json({ ok: true, items: GRANTS });
    if (url === "/api/admin/mcp/grants/g1" && init?.method === "DELETE") {
      return json({ ok: true, item: grant("g1", "Claude Code", { scopes: ["mcp:read", "mcp:write"], status: "revoked", revokedAt: "2026-11-14T10:00:00Z" }) });
    }
    return undefined;
  });
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  lang("en");
});

const page = () =>
  render(
    <MemoryRouter initialEntries={["/admin/connections"]}>
      <AdminConnections />
    </MemoryRouter>,
  );
const rowOf = (name: string) => screen.findByRole("button", { name: `Open ${name}` });
const dialog = () => screen.findByRole("dialog");

describe("Connected apps on a phone: the list", () => {
  it("is a row per grant, not a table, with no Revoke button in the list", async () => {
    page();
    await rowOf("Claude Code");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Revoke/ })).toBeNull();
    expect(rows()).toHaveLength(GRANTS.length);
    for (const g of GRANTS) expect(screen.getByRole("button", { name: `Open ${g.client}` })).toBeTruthy();
  });

  it("each row is one button with at most three facts (two beside the title, one glyph)", async () => {
    page();
    await rowOf("Claude Code");
    for (const row of rows()) {
      expect(controlsIn(row)).toBe(1);
      expect(factsOf(row).length).toBeLessThanOrEqual(2);
      expect(row.querySelectorAll("[data-kind]").length).toBeLessThanOrEqual(1);
    }
  });

  it("draws nothing for an active grant and one named glyph for a revoked and an expired one", async () => {
    page();
    await rowOf("Claude Code");
    const named = (n: string) => screen.getByRole("button", { name: `Open ${n}` });
    expect(named("Claude Code").querySelector("[data-kind]")).toBeNull();
    expect(within(named("Old client")).getByRole("img", { name: "Revoked" })).toBeTruthy();
    expect(within(named("Lapsed client")).getByRole("img", { name: "Expired" })).toBeTruthy();
    expect(within(named("Lapsed client")).getByText(/Never used/)).toBeTruthy();
  });

  it("separates what is connected from what ended", async () => {
    page();
    await rowOf("Claude Code");
    const connected = screen.getByRole("list", { name: "Connected" });
    const ended = screen.getByRole("list", { name: "Ended" });
    expect(within(connected).getAllByRole("button")).toHaveLength(2);
    expect(within(ended).getAllByRole("button")).toHaveLength(2);
  });
});

describe("Connected apps on a phone: the sheet and revoke", () => {
  it("opens from the row with access, scopes, sign-in and expiry, and gives focus back on close", async () => {
    page();
    const row = await rowOf("Claude Code");
    row.focus();
    fireEvent.click(row);
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Claude Code" })).toBeTruthy();
    expect(within(d).getByText("Read and write")).toBeTruthy();
    expect(within(d).getByText("mcp:write")).toBeTruthy();
    expect(within(d).getByText("yehuda").closest("dd")?.getAttribute("dir")).toBe("ltr");
    expect(within(d).getByText("Expires")).toBeTruthy();
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("asks before it revokes, naming the app, and calls the server only after the confirm", async () => {
    page();
    fireEvent.click(await rowOf("Claude Code"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Revoke" }));
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Revoke Claude Code?" })).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    /* Keep goes back to the details and nothing was sent. */
    fireEvent.click(within(d).getByRole("button", { name: "Keep" }));
    expect(await within(await dialog()).findByRole("heading", { name: "Claude Code" })).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    fireEvent.click(within(await dialog()).getByRole("button", { name: "Revoke" }));
    fireEvent.click(within(await dialog()).getByRole("button", { name: "Revoke Claude Code" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(["/api/admin/mcp/grants/g1"]));
    expect(await screen.findByText("Claude Code revoked")).toBeTruthy();
    /* The sheet now shows it as ended: nothing left to revoke. */
    await waitFor(() => expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Revoke" })).toBeNull());
  });

  it("has no Revoke for a grant that already ended", async () => {
    page();
    fireEvent.click(await rowOf("Old client"));
    const d = await dialog();
    expect(within(d).getByText("Revoked")).toBeTruthy();
    expect(within(d).queryByRole("button", { name: "Revoke" })).toBeNull();
  });
});

describe("Connected apps on a phone: Hebrew", () => {
  it("is in Hebrew, with the same rows", async () => {
    lang("he");
    page();
    expect(await screen.findByRole("button", { name: "פתיחת Claude Code" })).toBeTruthy();
    expect(rows()).toHaveLength(GRANTS.length);
    expect(screen.getByRole("list", { name: "מחוברות" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "פתיחת Claude Code" }));
    expect(within(await dialog()).getByRole("button", { name: "ביטול גישה" })).toBeTruthy();
  });
});

describe("Connected apps on a desktop", () => {
  it("is unchanged: the table with its Revoke buttons", async () => {
    undoPhone();
    undoPhone = phone(false);
    page();
    expect(await screen.findAllByRole("button", { name: /^Revoke / })).toHaveLength(2);
    expect(rows()).toHaveLength(0);
  });
});
