import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AdminSettings from "@/pages/AdminSettings";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/settings/schema";
import { resetSettings } from "@/settings/store";
import { controlsIn, factsOf, json, lang, phone, rows } from "@/components/admin/phone/__tests__/helpers";

/*
 * /admin/settings below 600px (#682): the page's controls as a list of groups,
 * the save history as compact rows that open a sheet with the diff, and the
 * same Save / dirty / payload semantics as the desktop form.
 */

const viewOf = (settings: SiteSettings, version: number, history: unknown[]) => ({
  ok: true, exists: version > 0, _rev: `${version}-abc`, version, updatedAt: "2026-11-01T10:00:00.000Z", settings, history,
});

const changed = (f: (s: SiteSettings) => void) => {
  const s = structuredClone(DEFAULT_SETTINGS);
  f(s);
  return s;
};
/* Seven earlier saves, so "never 7 full cards" is a real number. */
const HISTORY = [
  { version: 0, at: "2026-10-01T09:00:00.000Z", settings: DEFAULT_SETTINGS },
  ...[1, 2, 3, 4, 5, 6].map((v) => ({
    version: v, at: `2026-10-0${v + 1}T09:00:00.000Z`,
    settings: changed((s) => {
      s.visuals.accent = v % 2 ? "pine" : DEFAULT_SETTINGS.visuals.accent;
      s.home.sections[v % 5].visible = false;
    }),
  })),
].reverse();

type Call = { url: string; method: string; body: { settings?: SiteSettings; version?: number; _rev?: string } | null };
function stub() {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (call.method === "GET") return json(viewOf(structuredClone(DEFAULT_SETTINGS), 7, HISTORY));
      if (url.endsWith("/revert")) return json(viewOf(DEFAULT_SETTINGS, 8, HISTORY));
      return json(viewOf(call.body!.settings!, 8, HISTORY));
    }),
  );
  return calls;
}

let undoPhone: () => void;
beforeEach(() => {
  undoPhone = phone(true);
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  resetSettings();
  lang("en");
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const page = (at = "/admin/settings") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminSettings />
      <Where />
    </MemoryRouter>,
  );
const group = (name: RegExp) => screen.findByRole("button", { name });
const save = () => screen.getAllByRole("button", { name: "Save" })[0];

describe("Settings on a phone: groups", () => {
  it("lists the controls as groups, each with one summary line, and no desktop form", async () => {
    stub();
    page();
    for (const n of [/Home page order/, /Look and feel/, /Sharing menu/, /Link tags/, /Share texts/]) expect(await group(n)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/Hero, always first/)).toBeNull();
  });

  it("keeps the open group in the address and hands focus back to its row", async () => {
    stub();
    page();
    const row = await group(/Look and feel/);
    row.focus();
    fireEvent.click(row);
    expect(screen.getByTestId("where").textContent).toBe("/admin/settings?group=look");
    fireEvent.click(await screen.findByRole("button", { name: "Back to settings" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Look and feel/ })));
  });

  it("sends exactly the payload the desktop form sends for the same edits", async () => {
    const calls = stub();
    page();
    expect(save()).toBeDisabled();
    fireEvent.click(await group(/Home page order/));
    fireEvent.click(await screen.findByRole("button", { name: "Move Specs up" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("settings-stack-up"));
    fireEvent.click(screen.getByRole("switch", { name: "Contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    fireEvent.click(await group(/Look and feel/));
    fireEvent.click(await screen.findByRole("radio", { name: "Pine" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    fireEvent.click(await group(/Sharing menu/));
    fireEvent.click(await screen.findByRole("switch", { name: "WhatsApp" }));
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    const expected = structuredClone(DEFAULT_SETTINGS);
    const [stack] = expected.home.sections.splice(4, 1);
    expected.home.sections.splice(3, 0, stack);
    expected.home.sections.find((s) => s.id === "contact")!.visible = false;
    expected.visuals.accent = "pine";
    expected.sharing.channels = expected.sharing.channels.filter((c) => c !== "whatsapp");
    expect(put.body).toEqual({ settings: expected, _rev: "7-abc" });
  });

  it("refuses to send what the ledger rule forbids, and says so beside the row", async () => {
    const calls = stub();
    page();
    fireEvent.click(await group(/Home page order/));
    fireEvent.click(await screen.findByRole("switch", { name: "How I work" }));
    expect(await screen.findByText(/read as one section/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("writes share texts in a closed section per language, and counts the characters", async () => {
    const calls = stub();
    page();
    fireEvent.click(await group(/Share texts/));
    fireEvent.click(await screen.findByText("English templates"));
    fireEvent.change(screen.getByLabelText("LinkedIn", { selector: "#settings-template-en-linkedin" }), { target: { value: "Seen: {title} {url}" } });
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    fireEvent.click(save());
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body!.settings!.sharing.templates.en.linkedin).toBe("Seen: {title} {url}");
  });
});

describe("Settings on a phone: history", () => {
  const open = async () => {
    fireEvent.click(await screen.findByText(/7 saved versions/));
  };

  it("is one closed section of compact rows, never seven cards", async () => {
    stub();
    page();
    const details = (await screen.findByText(/7 saved versions/)).closest("details")!;
    expect(details.open).toBe(false);
    await open();
    expect(details.open).toBe(true);
    const list = rows();
    expect(list).toHaveLength(8);
    for (const r of list) {
      expect(controlsIn(r)).toBe(1);
      expect(factsOf(r).length).toBeLessThanOrEqual(2);
    }
    expect(document.querySelectorAll(".a-card")).toHaveLength(0);
  });

  it("opens a sheet with the diff, and the count on the row is the number of lines in it", async () => {
    stub();
    page();
    await open();
    const row = screen.getByRole("button", { name: "Open Version 3" });
    row.focus();
    fireEvent.click(row);
    const d = await screen.findByRole("dialog");
    const lines = within(d).getByRole("list", { name: "How it differs from the live version" });
    const n = within(lines).getAllByRole("listitem").length;
    expect(n).toBeGreaterThan(0);
    expect(within(row).getByText(new RegExp(`^${n} changes?$`))).toBeTruthy();
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("puts an earlier version back with the revision it read", async () => {
    const calls = stub();
    page();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Open Built-in defaults" }));
    const d = await screen.findByRole("dialog");
    fireEvent.click(within(d).getByRole("button", { name: "Put back Built-in defaults" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/revert"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/revert"))!.body).toEqual({ version: 0, _rev: "7-abc" });
  });
});

describe("Settings in Hebrew on a phone", () => {
  it("has the same groups and rows, in Hebrew", async () => {
    lang("he");
    stub();
    page();
    expect(await screen.findByRole("button", { name: /סדר דף הבית/ })).toBeTruthy();
    fireEvent.click(await screen.findByText(/7 גרסאות שמורות/));
    expect(rows()).toHaveLength(8);
  });
});

describe("Settings on a desktop", () => {
  it("is unchanged: the full form and one card per saved version", async () => {
    undoPhone();
    undoPhone = phone(false);
    stub();
    page();
    expect(await screen.findAllByRole("radio")).not.toHaveLength(0);
    expect(rows()).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /^Put back/ })).toHaveLength(7);
  });
});
