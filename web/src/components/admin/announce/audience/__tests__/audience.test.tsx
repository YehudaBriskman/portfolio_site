import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AudienceTab from "../AudienceTab";
import { previewCsv } from "../csv";
import { whyOf } from "../why";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const contact = (o: object = {}) => ({
  hash: "h1", email: "ada@example.com", name: "Ada", lang: "en", groups: ["subscribers"], status: "active", source: "site",
  consentAt: "2026-01-02T00:00:00Z", consentNote: "form v1", topics: { blog: true, releases: true }, ...o,
});
// Shapes copied from the backend's groupView (+ counts), view and GET /suppression in admin.route.ts.
const groups = [
  { slug: "subscribers", name: "Subscribers", kind: "system", createdAt: "2026-01-01T00:00:00Z", total: 12, active: 10 },
  { slug: "friends", name: "Friends", kind: "manual", createdAt: "2026-01-01T00:00:00Z", total: 3, active: 3 },
];

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
let pages: Record<string, unknown>;
beforeEach(() => {
  calls = [];
  pages = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/admin/audience/groups" && method === "GET") return json({ ok: true, groups });
      if (url.startsWith("/api/admin/audience/contacts?")) return json(pages[url] ?? { ok: true, contacts: [contact(), contact({ hash: "h2", email: "dana@example.com", name: null, status: "pending" })], nextCursor: "contact:h2" });
      if (url === "/api/admin/audience/suppression") return json({ ok: true, suppressed: [{ hash: "s1", email: "gone@example.com", since: "2026-03-05T10:00:00Z" }] });
      if (url === "/api/admin/audience/contacts/import") return json({ ok: true, added: 2, skipped: 1, invalid: [{ row: 4, reason: "Not a valid email address" }] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("pure helpers", () => {
  it("says why a person cannot be mailed", () => {
    const t = { blog: true, releases: true };
    expect(whyOf({ status: "active", topics: t }).mailable).toBe(true);
    expect(whyOf({ status: "active", topics: { blog: false, releases: false } }).key).toBe("activeNoTopics");
    expect(whyOf({ status: "pending", topics: t }).key).toBe("pending");
    expect(whyOf({ status: "suppressed", topics: t }).key).toBe("suppressed");
  });
  it("previews a CSV with a header, quotes and a bad row", () => {
    const rows = previewCsv('Email,Name\n"a@b.co","Smith, J"\nnope\n');
    expect(rows).toEqual([
      { email: "a@b.co", name: "Smith, J", lang: "", valid: true },
      { email: "nope", name: "", lang: "", valid: false },
    ]);
  });
});

describe("AudienceTab", () => {
  it("reads the group size from total and shows the suppression date from since", async () => {
    render(<AudienceTab />);
    expect(await screen.findByRole("option", { name: "Subscribers (12)" })).toBeTruthy();
    fireEvent.click(screen.getByText("Suppression list"));
    expect(await screen.findByText("gone@example.com")).toBeTruthy();
    expect(await screen.findByText(/Since 5 Mar 2026/)).toBeTruthy();
  });

  it("gives a name cell its own direction and lets an address break before @ and dots", async () => {
    pages["/api/admin/audience/contacts?limit=25"] = { ok: true, contacts: [contact({ name: "דנה", email: "person.long@example.com" })], nextCursor: null };
    const { container } = render(<AudienceTab />);
    const cell = (await screen.findByText("דנה")).closest("td")!;
    expect(cell.getAttribute("dir")).toBe("auto");
    const addr = container.querySelector("tbody bdi[dir=ltr]")!;
    expect(addr.textContent).toBe("person.long@example.com");
    expect(addr.querySelectorAll("wbr").length).toBe(3);
  });

  it("lists contacts with the why line, loads more by cursor and filters", async () => {
    render(<AudienceTab />);
    expect(await screen.findByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Can be mailed.")).toBeTruthy();
    expect(screen.getByText(/Waiting for them to confirm/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(calls.some((c) => c.url.includes("cursor=contact%3Ah2"))).toBe(true));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=pending"))).toBe(true));
  });

  it("edits a contact and erases only after a confirm", async () => {
    render(<AudienceTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit ada@example.com" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Name"), { target: { value: "Ada L" } });
    fireEvent.click(within(dlg).getByLabelText("Friends"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ name: "Ada L", groups: ["subscribers", "friends"], status: "active" }));

    fireEvent.click(await screen.findByRole("button", { name: "Edit ada@example.com" }));
    const d2 = await screen.findByRole("dialog");
    fireEvent.click(within(d2).getByRole("button", { name: "Erase contact" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(within(d2).getByRole("button", { name: /Erase ada@example.com for good/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE")?.url).toBe("/api/admin/audience/contacts/h1"));
  });

  it("requires a consent note to add a contact", async () => {
    render(<AudienceTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Add contact" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Email address"), { target: { value: "x@y.co" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.change(within(dlg).getByLabelText(/Consent note/), { target: { value: "asked in person" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/contacts") && c.method === "POST")?.body).toMatchObject({ email: "x@y.co", consentNote: "asked in person", groups: [] }));
  });

  it("imports only with the consent checkbox and a note, and shows the summary", async () => {
    render(<AudienceTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("CSV"), { target: { value: "a@b.co\nbad" } });
    expect(within(dlg).getByText("1 look valid, 1 do not")).toBeTruthy();
    const run = within(dlg).getByRole("button", { name: "Import" }) as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.click(within(dlg).getByRole("checkbox", { name: /agreed to receive/ }));
    fireEvent.change(within(dlg).getByLabelText(/How they agreed/), { target: { value: "workshop list" } });
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    expect(await within(dlg).findByText("2 added, 1 skipped.")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/import"))?.body).toMatchObject({ consentConfirmed: true, consentNote: "workshop list" });
  });

  it("locks system groups", async () => {
    render(<AudienceTab />);
    await screen.findByText("ada@example.com");
    fireEvent.click(screen.getByText("Groups", { selector: "summary" }));
    expect(await screen.findByText("System group, locked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Subscribers" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Friends" })).toBeTruthy();
  });
});
