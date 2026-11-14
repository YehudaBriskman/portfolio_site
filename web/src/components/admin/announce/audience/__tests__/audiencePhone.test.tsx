import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AudienceTab from "../AudienceTab";

/*
 * Marketing > Audience below 600px (#677). jsdom cannot see layout, so these pin the structure and the rules
 * that produce it (the PR carries the screenshots and the measured fold): a row is one button with at most
 * three facts, consent stays required, and no address ever reaches the address bar.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const contact = (o: object = {}) => ({
  hash: "h1", email: "ada@example.com", name: "Ada", lang: "en", groups: ["subscribers"], status: "active", source: "site",
  consentAt: "2026-01-02T00:00:00Z", createdAt: "2026-01-02T00:00:00Z", consentNote: "form v1", topics: { blog: true, releases: true }, ...o,
});
const people = [
  contact(),
  contact({ hash: "h2", email: "dana@example.com", name: null, status: "pending", lang: "he", source: "manual" }),
  contact({ hash: "h3", email: "eli@example.com", name: "אלי", status: "suppressed", lang: "he", source: "import" }),
  contact({ hash: "h4", email: "fay@example.com", name: "Fay", status: "unsubscribed", unsubscribedAt: "2026-02-01T00:00:00Z" }),
  ...Array.from({ length: 8 }, (_, i) => contact({ hash: `x${i}`, email: `p${i}@example.com`, name: `Person ${i}` })),
];
const groups = [
  { slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 10 },
  { slug: "friends", name: "Friends", kind: "manual", total: 3, active: 3 },
];

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function phone(width: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: width && q.includes("max-width: 599px"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/admin/marketing?tab=audience"]}>
      <AudienceTab />
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  calls = [];
  phone(true);
  try {
    window.localStorage.clear();
  } catch {
    /* none */
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/admin/audience/groups" && method === "GET") return json({ ok: true, groups });
      if (url.startsWith("/api/admin/audience/contacts?")) return json({ ok: true, contacts: people, nextCursor: null });
      if (url === "/api/admin/audience/sweep") return json({ ok: true, pendingTtlDays: 7, report: null });
      if (url === "/api/admin/audience/suppression") return json({ ok: true, suppressed: [] });
      if (url === "/api/admin/audience/contacts/import") return json({ ok: true, added: 2, skipped: 0, invalid: [] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

const rows = () => [...document.querySelectorAll<HTMLElement>("[data-record-row]")];
const writes = (m: string) => calls.filter((c) => c.method === m);

describe("Audience on a phone: the list", () => {
  it("draws rows, not a table, and each row is one button with a full name and at most three facts", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    expect(document.querySelector("table")).toBeNull();
    expect(rows().length).toBe(people.length);
    for (const r of rows()) {
      expect(r.tagName).toBe("BUTTON");
      expect(r.querySelector("button, a, input, select")).toBeNull();
      expect(r.getAttribute("aria-label")).toMatch(/^Open \S/);
      expect(r.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(3);
    }
    // A name stands for the person; without one the address is the title, shown whole.
    expect(screen.getByRole("button", { name: "Open dana@example.com" }).querySelector("[data-rr-title]")!.textContent).toBe("dana@example.com");
    expect(screen.getByRole("button", { name: "Open Ada" }).querySelector("[data-rr-title]")!.textContent).toBe("Ada");
  });

  it("draws a status only when the person is not mailable, with a name", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    expect(within(screen.getByRole("button", { name: "Open Ada" })).queryByRole("img")).toBeNull();
    expect(within(screen.getByRole("button", { name: "Open dana@example.com" })).getByRole("img", { name: "Waiting to confirm" })).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Open אלי" })).getByRole("img", { name: "Blocked from mail" })).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Open Fay" })).getByRole("img", { name: "Unsubscribed" })).toBeTruthy();
  });

  it("keeps the desktop table at 600 and up", async () => {
    phone(false);
    mount();
    expect(await screen.findByRole("table", { name: "Contacts" })).toBeTruthy();
    expect(rows().length).toBe(0);
  });

  it("puts groups, the suppression list and the sweep note in sections below the list", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    const list = document.querySelector("[data-audience-list]")!;
    for (const name of ["Groups", "Suppression list"]) {
      const s = screen.getByText(name, { selector: "summary span" }).closest("details")!;
      expect(s.open).toBe(false);
      expect(list.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("Audience on a phone: search and filters", () => {
  it("keeps the fold to search, Select, Add and one Filters entry: no status chips", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    expect(screen.queryByRole("button", { name: "Pending" })).toBeNull();
    expect(screen.queryByRole("toolbar")?.querySelectorAll("button[aria-pressed]").length ?? 0).toBe(0);
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search contacts" })).toBeTruthy();
  });

  it("filters by status from the Filters sheet and keeps no address in the URL, in storage or anywhere but memory", async () => {
    mount();
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search contacts" }), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("radio", { name: /Pending/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: /Show/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("status=pending"));
    const where = screen.getByTestId("where").textContent!;
    expect(where).toContain("tab=audience");
    expect(where).not.toMatch(/@|example|ada|q=/);
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/@|ada/);
    // The server is asked, in the background, with what was typed.
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=pending") && c.url.includes("q=ada%40example.com"))).toBe(true));
  });

  it("offers the group in the Filters sheet and shows it as a removable chip once chosen", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("radio", { name: /Friends/ }));
    fireEvent.click(within(dlg).getByRole("button", { name: /Show/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("group=friends"));
    expect(screen.getByRole("button", { name: /Remove filter Group: Friends/ })).toBeTruthy();
  });

  it("filters by language among the people already loaded", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    fireEvent.click(screen.getByRole("button", { name: "Hebrew" }));
    await waitFor(() => expect(rows().length).toBe(2));
    expect(screen.getByRole("button", { name: "Open dana@example.com" })).toBeTruthy();
  });
});

describe("Audience on a phone: bulk actions", () => {
  const select = async (...names: string[]) => {
    await screen.findByRole("button", { name: "Open Ada" });
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    // In select mode a row is a checkbox named by the person, not "Open".
    for (const n of names) fireEvent.click(screen.getByRole("checkbox", { name: n.replace(/^Open /, "") }));
  };

  it("shows the bar once something is chosen and adds the chosen people to a group", async () => {
    mount();
    await select("Open Ada", "Open Fay");
    const bar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(within(bar).getByText("2 selected")).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: "Add to group" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Friends" }));
    await waitFor(() => expect(writes("PATCH").length).toBe(2));
    expect(writes("PATCH").map((c) => c.url).sort()).toEqual(["/api/admin/audience/contacts/h1", "/api/admin/audience/contacts/h4"]);
    expect(writes("PATCH")[0].body).toEqual({ groups: ["subscribers", "friends"] });
  });

  it("suppresses only after a confirm that names the count, and never offers to make anyone mailable", async () => {
    mount();
    await select("Open Ada", "Open Fay");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const more = await screen.findByRole("dialog");
    expect(within(more).queryByRole("button", { name: /activate|resubscribe|mailable/i })).toBeNull();
    fireEvent.click(within(more).getByRole("button", { name: /^Suppress/ }));
    expect(writes("PATCH").length).toBe(0);
    const confirm = await screen.findByRole("button", { name: "Suppress 2 contacts" });
    fireEvent.click(confirm);
    await waitFor(() => expect(writes("PATCH").length).toBe(2));
    expect(writes("PATCH").every((c) => (c.body as { status: string }).status === "suppressed")).toBe(true);
  });

  it("deletes behind a confirm and an Undo window: nothing is erased while Undo is open, and Undo erases nothing", async () => {
    mount();
    await select("Open Ada");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const more = await screen.findByRole("dialog");
    fireEvent.click(within(more).getByRole("button", { name: /^Delete/ }));
    expect(writes("DELETE").length).toBe(0);
    fireEvent.click(await screen.findByRole("button", { name: "Delete 1 contact" }));
    const toast = await screen.findByTestId("undo-toast");
    expect(screen.queryByRole("button", { name: "Open Ada" })).toBeNull();
    expect(writes("DELETE").length).toBe(0);
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Open Ada" })).toBeTruthy();
    expect(writes("DELETE").length).toBe(0);
  });

  it("exports the chosen people as a CSV file without a request", async () => {
    const make = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: make, revokeObjectURL: () => {} }));
    mount();
    await select("Open Ada");
    const before = calls.length;
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Export selected/ }));
    await waitFor(() => expect(make).toHaveBeenCalled());
    expect(calls.length).toBe(before);
  });
});

describe("Audience on a phone: sheets", () => {
  it("opens a contact in a sheet with the status and the consent first, and returns focus to the row", async () => {
    mount();
    const row = await screen.findByRole("button", { name: "Open Ada" });
    row.focus();
    fireEvent.click(row);
    const dlg = await screen.findByRole("dialog", { name: "Ada" });
    const text = dlg.textContent!;
    expect(text.indexOf("Can be mailed")).toBeGreaterThan(-1);
    expect(text.indexOf("Can be mailed")).toBeLessThan(text.indexOf("Topics"));
    expect(text.indexOf("Site signup")).toBeLessThan(text.indexOf("Topics"));
    expect(within(dlg).getByText("ada@example.com").closest("[dir=ltr]")).toBeTruthy();
    // Topics, groups and the consent history wait inside closed sections.
    for (const name of ["Details", "Topics and groups", "Consent history", "Erase contact"]) {
      expect((within(dlg).getByText(name, { selector: "summary span" }).closest("details") as HTMLDetailsElement).open).toBe(false);
    }
    fireEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("saves edits made inside the sheet with the same payload as the dialog", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Open Ada" }));
    const dlg = await screen.findByRole("dialog", { name: "Ada" });
    fireEvent.click(within(dlg).getByText("Details", { selector: "summary span" }));
    fireEvent.change(within(dlg).getByLabelText("Name"), { target: { value: "Ada L" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("PATCH")[0]?.body).toMatchObject({ name: "Ada L", groups: ["subscribers"], status: "active" }));
  });

  it("requires the consent note to add a contact", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    fireEvent.click(screen.getByRole("button", { name: "Add people" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add contact" }));
    const dlg = await screen.findByRole("dialog", { name: "Add a contact" });
    fireEvent.change(within(dlg).getByLabelText("Email address"), { target: { value: "x@y.co" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    expect(writes("POST").length).toBe(0);
    expect(within(dlg).getByLabelText(/Consent note/).getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(within(dlg).getByLabelText(/Consent note/), { target: { value: "asked in person" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(writes("POST")[0]?.body).toMatchObject({ email: "x@y.co", consentNote: "asked in person" }));
  });

  it("imports only with the consent checkbox and a note, exactly as the dialog does", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Ada" });
    fireEvent.click(screen.getByRole("button", { name: "Add people" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dlg = await screen.findByRole("dialog", { name: "Import contacts from CSV" });
    fireEvent.change(within(dlg).getByLabelText("CSV"), { target: { value: "a@b.co\nc@d.co" } });
    const run = within(dlg).getByRole("button", { name: "Import" }) as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText(/How they agreed/), { target: { value: "workshop list" } });
    expect(run.disabled).toBe(true);
    fireEvent.click(within(dlg).getByRole("checkbox", { name: "I confirm these people agreed to receive this mail" }));
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    expect(await within(dlg).findByText("2 added, 0 skipped.")).toBeTruthy();
    expect(writes("POST")[0].body).toMatchObject({ consentConfirmed: true, consentNote: "workshop list" });
  });
});

describe("Audience on a phone: Hebrew", () => {
  it("reads right to left, in Hebrew, with addresses kept left to right", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    mount();
    const row = await screen.findByRole("button", { name: "פתיחת dana@example.com" });
    expect(row.querySelector("[data-rr-title] bdi")!.textContent).toBe("dana@example.com");
    expect(screen.getByRole("button", { name: "בחירה" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "חיפוש אנשי קשר" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "מצב" })).getByRole("button", { name: "ממתין" })).toBeTruthy();
    fireEvent.click(row);
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("dana@example.com").closest("[dir=ltr]")).toBeTruthy();
    expect(dlg.textContent).toContain("נוסף ידנית");
    expect(dlg.textContent).not.toMatch(/Site signup|Added by hand|Topics/);
  });
});

describe("export of the chosen people", () => {
  it("quotes what needs it and defuses a cell a spreadsheet would run as a formula", async () => {
    const { toCsv } = await import("../csv");
    expect(toCsv([["a@b.co", '=HYPERLINK("x")', "Smith, J"]])).toBe(`a@b.co,"'=HYPERLINK(""x"")","Smith, J"\r\n`);
  });
});
