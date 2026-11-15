import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LibraryPanel from "../library/LibraryPanel";
import SettingsPanel from "../SettingsPanel";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { DEFAULT_NOTIFY } from "../notify/defaults";
import "../words";

/*
 * Admin design programme round 2, S4 (Library, Marketing settings) on a desktop.
 * Library: one table per list, one drawn action per row, the editor in the side panel (not in the page),
 * one Save at a time. Settings: one heading level under the page title, the help behind info buttons,
 * "Unsaved changes" said once.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const settings = () => ({
  enabled: true,
  email: { enabled: true, events: ["post", "release"] },
  hashtags: ["web"],
  signature: "",
  channels: ["linkedin", "instagram", "email", "gmail", "x"],
  templates: { en: {}, he: {} },
  snippets: [{ id: "s1", name: "Tags", kind: "hashtags", text: "#one #two" }],
  library: [
    { id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}", default: true },
    { id: "t2", name: "Quick", channel: "x", lang: "en", text: "{title}" },
  ],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  notify: DEFAULT_NOTIFY,
});

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/admin/announce/settings" && method === "GET") return json({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings: settings() });
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/settings" && method === "GET") return json({ ok: true, exists: false, _rev: null, version: 1, updatedAt: null, history: [], settings: DEFAULT_SETTINGS });
      return json({}, 404);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

const panel = () => document.querySelector<HTMLElement>("[data-side-panel]");

describe("Library on a desktop (S4)", () => {
  it("lists templates, built-ins and snippets as tables, not as cards with buttons", async () => {
    render(<LibraryPanel />);
    const grid = await screen.findByRole("grid", { name: "Templates" });
    expect(within(grid).getAllByRole("row")).toHaveLength(3); /* header and two templates */
    expect(screen.getByRole("grid", { name: "Built-in templates" })).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Snippets" })).toBeTruthy();
    expect(document.querySelector("section.a-box")).toBeNull();
  });

  it("draws at most one action per row; Duplicate and Delete wait in More, and the default switch is not in the row", async () => {
    render(<LibraryPanel />);
    const grid = await screen.findByRole("grid", { name: "Templates" });
    const rowOf = within(grid).getByRole("row", { name: /Launch/ });
    expect(within(rowOf).queryAllByRole("button").filter((b) => b.getAttribute("aria-haspopup") !== "menu")).toHaveLength(1);
    expect(within(rowOf).queryByRole("button", { name: "Duplicate Launch" })).toBeNull();
    expect(within(rowOf).queryByRole("button", { name: "Delete Launch" })).toBeNull();
    expect(within(rowOf).queryByRole("checkbox")).toBeNull();
    expect(within(rowOf).getByText("Default")).toBeTruthy();
  });

  it("opens the editor in the side panel while the list stays on the page, with ONE Save library", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(within(panel()!).getByRole("heading", { name: "Editing Launch" })).toBeTruthy();
    expect(within(panel()!).getByLabelText("Caption text")).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Templates" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save library" })).toHaveLength(1);
  });

  it("asks 'Discard your changes?' before closing a panel with edits, and Discard puts the text back", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    const box = (await screen.findByLabelText("Caption text")) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "changed" } });
    fireEvent.click(within(panel()!).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(panel()).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    expect(((await screen.findByLabelText("Caption text")) as HTMLTextAreaElement).value).toBe("{title} {url}");
  });

  it("deleting a template names it and the outcome in a confirm", async () => {
    render(<LibraryPanel />);
    const grid = await screen.findByRole("grid", { name: "Templates" });
    await userEvent.click(within(within(grid).getByRole("row", { name: /Quick/ })).getByRole("button", { name: "More" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete Quick" }));
    expect(await screen.findByRole("button", { name: "Delete Quick for good" })).toBeTruthy();
  });

  it("says 'Discard changes' once on the page, not in the bar and again beside it", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Add starter templates" }));
    expect(screen.getAllByText("Discard changes")).toHaveLength(1);
  });
});

describe("Marketing settings on a desktop (S4)", () => {
  it("has no second page title: the hub's heading is the only one above Everyday", async () => {
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    await screen.findByTestId("advanced");
    expect(screen.queryByRole("heading", { name: "Announce settings" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Everyday" })).toBeTruthy();
  });

  it("keeps help behind info buttons: no hint paragraph under a checkbox", async () => {
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    const box = (await screen.findByLabelText("Email me about new events")) as HTMLInputElement;
    expect(box.closest("div")!.querySelector(".a-hint")).toBeNull();
    expect(screen.queryByText(/One email per event, to the contact address/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Email me about new events" }));
    expect(await screen.findByText(/One email per event, to the contact address/)).toBeTruthy();
  });

  it("says 'Unsaved changes' once, in the bar, not also on the Advanced disclosure", async () => {
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Signature"), { target: { value: "-- me" } });
    fireEvent.click(screen.getByTestId("advanced").querySelector("summary")!);
    fireEvent.change(screen.getByLabelText("Filter advanced settings"), { target: { value: "utm" } });
    fireEvent.click(screen.getByLabelText("Tag links to this site"));
    expect(screen.getAllByText("Unsaved changes")).toHaveLength(1);
  });

  it("Sender: only the identity sections are open; test recipients and budget wait until opened", async () => {
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.click((await screen.findByTestId("advanced")).querySelector("summary")!);
    const open = (id: string) => (screen.getByTestId(id).closest("details") ?? screen.getByTestId(id)).hasAttribute("open");
    expect(open("sec-sender")).toBe(true);
    expect(open("sec-footer")).toBe(true);
    expect(open("sec-tests")).toBe(false);
    expect(open("sec-budget")).toBe(false);
  });
});
