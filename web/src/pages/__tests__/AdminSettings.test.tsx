import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSettings from "@/pages/AdminSettings";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/settings/schema";
import { resetSettings } from "@/settings/store";

/*
 * /admin/settings (#254): reorder and hide with buttons, the ledger rule
 * shown before anything is sent, the visual presets, save with the revision
 * read, and putting an earlier version back.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const viewOf = (settings: SiteSettings, version = 1, history: unknown[] = []) => ({
  ok: true,
  exists: version > 0,
  _rev: `${version}-abc`,
  version,
  updatedAt: "2026-11-01T10:00:00.000Z",
  settings,
  history,
});

type Call = { url: string; method: string; body: { settings?: SiteSettings; version?: number; _rev?: string } | null };

function stub(initial = viewOf(structuredClone(DEFAULT_SETTINGS), 1, [{ version: 0, at: "2026-11-01T09:00:00.000Z", settings: DEFAULT_SETTINGS }])) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (call.method === "GET") return json(initial);
      if (url.endsWith("/revert")) return json(viewOf(DEFAULT_SETTINGS, 2, [{ version: 1, at: initial.updatedAt, settings: initial.settings }]));
      return json(viewOf(call.body!.settings!, 2, [{ version: 1, at: initial.updatedAt, settings: initial.settings }]));
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetSettings();
});

const page = () => render(<MemoryRouter><AdminSettings /></MemoryRouter>);

describe("/admin/settings", () => {
  it("moves a section, hides one, and saves with the revision it read", async () => {
    const calls = stub();
    page();
    const up = await screen.findByRole("button", { name: "Move Specs up" });
    fireEvent.click(up);
    /* Focus stays with the row it moved. */
    await waitFor(() => expect(document.activeElement?.id).toBe("settings-stack-up"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Contact" }));
    fireEvent.click(screen.getByLabelText("Pine"));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body!._rev).toBe("1-abc");
    expect(put.body!.settings!.home.sections.map((s) => s.id)).toEqual(["work", "approach", "city", "stack", "notes", "contact"]);
    expect(put.body!.settings!.home.sections.find((s) => s.id === "contact")!.visible).toBe(false);
    expect(put.body!.settings!.visuals.accent).toBe("pine");
  });

  it("shows the ledger rule beside the row and refuses to send", async () => {
    const calls = stub();
    page();
    /* Hiding How I work puts Work and The year side by side. */
    fireEvent.click(await screen.findByRole("checkbox", { name: "Show How I work" }));
    expect(await screen.findByText(/read as one section/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save" })[0]).toBeDisabled();
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("puts an earlier version back", async () => {
    const calls = stub();
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Put back Built-in defaults" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/revert"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/revert"))!.body).toEqual({ version: 0, _rev: "1-abc" });
    expect(await screen.findByText(/Version 2/)).toBeInTheDocument();
  });

  it("edits sharing with a keyboard-reachable control set and saves it with the revision", async () => {
    const calls = stub();
    page();
    const sw = await screen.findByRole("switch", { name: "Show the share menu to visitors" });
    expect(sw).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Notes" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "WhatsApp" }));
    fireEvent.change(screen.getByLabelText("Source name"), { target: { value: "site" } });
    fireEvent.change(screen.getByLabelText("LinkedIn", { selector: "#settings-template-en-linkedin" }), { target: { value: "Seen: {title} {url}" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body!._rev).toBe("1-abc");
    const sharing = put.body!.settings!.sharing;
    expect(sharing.surfaces).toEqual(["post", "project", "area", "story", "home"]);
    expect(sharing.channels).not.toContain("whatsapp");
    expect(sharing.utm.source).toBe("site");
    expect(sharing.templates.en.linkedin).toBe("Seen: {title} {url}");
  });

  it("refuses a template with markup before anything is sent", async () => {
    const calls = stub();
    page();
    await screen.findByRole("switch", { name: "Show the share menu to visitors" });
    fireEvent.change(screen.getByLabelText("Gmail", { selector: "#settings-template-en-gmail" }), { target: { value: "<b>hi</b>" } });
    expect(await screen.findByText(/plain text: remove anything/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save" })[0]).toBeDisabled();
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });
});
