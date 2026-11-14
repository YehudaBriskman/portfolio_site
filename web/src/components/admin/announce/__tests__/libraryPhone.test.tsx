import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import LibraryPanel from "../library/LibraryPanel";
import { DEFAULT_NOTIFY } from "../notify/defaults";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import type { AnnounceSettings } from "@/services/adminAnnounce";
import "../words";

/*
 * Library on phones (#679). jsdom cannot see layout, so the fold and the
 * horizontal scroll are measured in a real browser (numbers in the PR) and
 * pinned here as structure and CSS. Everything else is behaviour.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const css = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const LIBRARY = [
  { id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}", default: true },
  { id: "t2", name: "Quick note", channel: "x", lang: "en", text: "{title}" },
  { id: "t3", name: "Newsletter", channel: "email", lang: "en", text: "Hi\n\n{title}" },
  { id: "t4", name: "Insta", channel: "instagram", lang: "he", text: "{title}" },
  { id: "t5", name: "Gmail one", channel: "gmail", lang: "en", text: "{title}" },
  { id: "t6", name: "Another", channel: "linkedin", lang: "he", text: "{title}" },
  { id: "t7", name: "Seventh", channel: "x", lang: "he", text: "{title}" },
  { id: "t8", name: "Eighth", channel: "linkedin", lang: "en", text: "{title}" },
];

const baseSettings = () => ({
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: ["web"],
  signature: "",
  channels: ["linkedin", "instagram", "email", "gmail", "x"],
  templates: { en: { x: "mine {url}" }, he: {} },
  snippets: [
    { id: "s1", name: "Tags", kind: "hashtags", text: "#one #two" },
    { id: "s2", name: "Sign off", kind: "signature", text: "Yehuda" },
  ],
  library: LIBRARY,
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  notify: DEFAULT_NOTIFY,
});
const view = (settings: unknown = baseSettings(), rev = "1-a") => ({ ok: true, exists: true, _rev: rev, updatedAt: null, settings });

type Call = { url: string; method: string; body: { _rev?: string; settings: AnnounceSettings } };
let calls: Call[];

/* A phone: the width query matches, nothing else does. */
function phone(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: on && query.includes("max-width: 599px"),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  calls = [];
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  phone(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/admin/announce/settings" && method === "GET") return json(view());
      if (url === "/api/admin/announce/settings" && method === "PUT") return json(view(body.settings, "2-b"));
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
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const saved = () => calls.filter((c) => c.method === "PUT" && c.url === "/api/admin/announce/settings");
const rows = () => [...document.querySelectorAll<HTMLElement>("[data-record-row]")];
const row = async (name: RegExp | string) => (await screen.findByRole("button", { name })) as HTMLButtonElement;
const sheet = () => document.querySelector("dialog[open]") as HTMLElement | null;
const openRow = async (name: RegExp | string) => {
  const r = await row(name);
  r.focus();
  fireEvent.click(r);
  return r;
};
const closeSheet = () => fireEvent.click(within(sheet()!).getByRole("button", { name: /^(Close|סגירה)$/ }));

describe("Library on a phone", () => {
  it("lists templates, built-ins and snippets as RecordRows with at most 3 facts and no button inside", async () => {
    render(<LibraryPanel />);
    await row(/Edit Launch/);
    expect(rows().length).toBe(8 + 10 + 2); /* templates, 2 languages x 5 channels, snippets */
    for (const r of rows()) {
      expect(r.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(3);
      expect(r.querySelectorAll("button, input, select, a").length).toBe(0);
    }
    /* Open, Duplicate, Delete and the default switch are in the sheet, not on the list. */
    expect(screen.queryByRole("button", { name: /^Duplicate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("draws the customised dot on an edited built-in only, and the default as a fact", async () => {
    render(<LibraryPanel />);
    const edited = await row(/Edit X, English/);
    expect(within(edited).getByRole("img", { name: "Edited" })).toBeTruthy();
    expect(within(await row(/Edit LinkedIn, English/)).queryByRole("img", { name: "Edited" })).toBeNull();
    expect(within(await row(/Edit Launch/)).getByText("Default")).toBeTruthy();
  });

  it("puts at least 7 rows above the fold: nothing but the chips and one action sits before the list", async () => {
    render(<LibraryPanel />);
    await row(/Edit Launch/);
    const root = screen.getByTestId("library");
    const first = rows()[0];
    const before = [...root.querySelectorAll<HTMLElement>("button, select, input, textarea, summary")].filter((el) => first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
    /* the toolbar's chips (5 channels + 2 languages + 4 kinds), then only New template */
    expect(before.filter((el) => !el.closest('[role="toolbar"]')).length).toBeLessThanOrEqual(1);
    expect(before.filter((el) => el.closest(".a-hint, details")).length).toBe(0);
    const phoneCss = css("src/components/admin/announce/library/LibraryPhone.module.css");
    expect(phoneCss).not.toMatch(/min-(block-)?height:\s*(?:[7-9]\d|\d{3,})px/);
  });

  it("filters by channel and by snippet kind with chips", async () => {
    render(<LibraryPanel />);
    await row(/Edit Launch/);
    const bar = screen.getByRole("toolbar");
    fireEvent.click(within(bar).getByRole("button", { name: "X" }));
    expect(screen.queryByRole("button", { name: /Edit Launch/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Edit Quick note/ })).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: "Signature" }));
    expect(screen.queryByRole("button", { name: /Edit Tags/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Edit Sign off/ })).toBeTruthy();
  });

  it("opens ONE editor at a time, in a full sheet, and a second tap switches it", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    expect(await screen.findAllByLabelText("Caption text")).toHaveLength(1);
    expect(sheet()).toBeTruthy();
    expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);
    fireEvent.click(await row(/Edit Quick note/));
    await waitFor(() => expect((screen.getByLabelText("Caption text") as HTMLTextAreaElement).value).toBe("{title}"));
    expect(screen.getAllByLabelText("Caption text")).toHaveLength(1);
    expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);
  });

  it("returns focus to the row that opened the sheet", async () => {
    render(<LibraryPanel />);
    const r = await openRow(/Edit Launch/);
    await screen.findByLabelText("Caption text");
    closeSheet();
    await waitFor(() => expect(sheet()).toBeNull());
    expect(document.activeElement).toBe(r);
  });

  it("orders the sheet by importance: text and preview first, the rest behind a closed Disclosure", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    const dlg = sheet()!;
    const text = await within(dlg).findByLabelText("Caption text");
    const preview = within(dlg).getByTestId("live-preview");
    const vars = within(dlg).getByRole("button", { name: "Insert {title}" });
    const more = dlg.querySelector("details") as HTMLDetailsElement;
    expect(more.open).toBe(false);
    const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(vars, text)).toBe(true);
    expect(before(text, preview)).toBe(true);
    expect(before(preview, more)).toBe(true);
    expect(more.contains(within(dlg).getByLabelText("Channel"))).toBe(true);
    expect(more.contains(within(dlg).getByRole("button", { name: "Duplicate Launch" }))).toBe(true);
    expect(more.contains(within(dlg).getByRole("button", { name: "Delete Launch" }))).toBe(true);
    expect(within(dlg).getByRole("switch", { name: /Use as default for LinkedIn, English/ })).toBeTruthy();
  });

  it("keeps every field editable and saves the same payload the desktop does", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    const dlg = sheet()!;
    fireEvent.change(await within(dlg).findByLabelText("Name"), { target: { value: "Launch 2" } });
    fireEvent.change(within(dlg).getByLabelText("Channel"), { target: { value: "x" } });
    fireEvent.change(within(dlg).getByLabelText("Language"), { target: { value: "he" } });
    fireEvent.change(within(dlg).getByLabelText("Caption text"), { target: { value: "Hello {title}" } });
    fireEvent.click(within(dlg).getByRole("switch"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const lib = saved()[0].body.settings.library;
    expect(saved()[0].body._rev).toBe("1-a");
    expect(lib[0]).toEqual({ id: "t1", name: "Launch 2", channel: "x", lang: "he", text: "Hello {title}" });
    expect(lib.slice(1)).toEqual(LIBRARY.slice(1));
    expect(saved()[0].body.settings.snippets).toEqual(baseSettings().snippets);
    await waitFor(() => expect(sheet()).toBeNull());
  });

  it("inserts a snippet and previews against the counter", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    const dlg = sheet()!;
    const box = (await within(dlg).findByLabelText("Caption text")) as HTMLTextAreaElement;
    fireEvent.change(within(dlg).getByLabelText("Insert a snippet"), { target: { value: "s1" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(box.value).toContain("#one #two"));
    expect(within(dlg).getByText(/characters once filled in/)).toBeTruthy();
  });

  it("asks before closing a sheet with edits in it, and Discard puts everything back", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    let dlg = sheet()!;
    fireEvent.change(await within(dlg).findByLabelText("Caption text"), { target: { value: "changed" } });
    closeSheet();
    const alert = await within(sheet()!).findByRole("alertdialog");
    expect(within(alert).getByText("Discard your changes?")).toBeTruthy();
    expect(document.activeElement).toBe(within(alert).getByRole("button", { name: "Keep editing" }));
    fireEvent.click(within(alert).getByRole("button", { name: "Keep editing" }));
    expect(sheet()).toBeTruthy();
    expect((within(sheet()!).getByLabelText("Caption text") as HTMLTextAreaElement).value).toBe("changed");
    closeSheet();
    fireEvent.click(await within(sheet()!).findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    fireEvent.click(await row(/Edit Launch/));
    dlg = sheet()!;
    expect((await within(dlg).findByLabelText("Caption text") as HTMLTextAreaElement).value).toBe("{title} {url}");
    expect(saved()).toHaveLength(0);
  });

  it("closes without asking when nothing changed", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Launch/);
    await screen.findByLabelText("Caption text");
    closeSheet();
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Reset to default drops a built-in override, and saves that", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit X, English/);
    const dlg = sheet()!;
    expect((await within(dlg).findByLabelText("Caption text") as HTMLTextAreaElement).value).toBe("mine {url}");
    const reset = within(dlg).getByRole("button", { name: "Reset to default" }) as HTMLButtonElement;
    expect(reset.disabled).toBe(false);
    fireEvent.click(reset);
    await waitFor(() => expect((within(dlg).getByLabelText("Caption text") as HTMLTextAreaElement).value).toContain("New on the blog"));
    expect((within(dlg).getByRole("button", { name: "Reset to default" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dlg).getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0].body.settings.templates.en.x).toBeUndefined();
  });

  it("duplicates and deletes (after a confirm) from inside the sheet", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Quick note/);
    let dlg = sheet()!;
    await within(dlg).findByLabelText("Caption text");
    fireEvent.click(within(dlg).getByRole("button", { name: "Duplicate Quick note" }));
    await waitFor(() => expect((sheet()!.querySelector("input[id$='-n']") as HTMLInputElement).value).toBe("Quick note (copy)"));
    dlg = sheet()!;
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete Quick note (copy)" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete Quick note (copy) for good" }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.queryByRole("button", { name: /Edit Quick note \(copy\)/ })).toBeNull();
  });

  it("edits a snippet in the same sheet", async () => {
    render(<LibraryPanel />);
    await openRow(/Edit Tags/);
    const dlg = sheet()!;
    fireEvent.change(await within(dlg).findByLabelText("Text"), { target: { value: "#new" } });
    fireEvent.change(within(dlg).getByLabelText("Type"), { target: { value: "cta" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0].body.settings.snippets[0]).toEqual({ id: "s1", name: "Tags", kind: "cta", text: "#new" });
  });

  it("is Hebrew in /he: words, the row name, and an LTR-isolated name", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    render(<LibraryPanel />);
    const r = await row(/עריכת Launch/);
    expect(r.querySelector("[data-rr-title] bdi")?.textContent).toBe("Launch");
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: "לינקדאין" })).toBeTruthy();
    r.focus();
    fireEvent.click(r);
    const dlg = sheet()!;
    expect(await within(dlg).findByLabelText("טקסט הכיתוב")).toBeTruthy();
    expect(dlg.querySelector("details")).toBeTruthy();
    expect(within(dlg).getByRole("button", { name: "שכפול Launch" })).toBeTruthy();
    expect(within(dlg).getByRole("button", { name: "שמירת הספרייה" })).toBeTruthy();
    closeSheet();
    await waitFor(() => expect(sheet()).toBeNull());
  });

  it("holds no horizontal scroll: every text box can shrink, nothing has a fixed width", () => {
    const phoneCss = css("src/components/admin/announce/library/LibraryPhone.module.css");
    expect(phoneCss).toMatch(/min-inline-size:\s*0/);
    expect(phoneCss).not.toMatch(/overflow-x:\s*(scroll|auto)/);
    expect(phoneCss).not.toMatch(/\b(?:inline-)?width:\s*\d+px/);
    expect(phoneCss).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
  });
});

describe("Library at 600px and over", () => {
  it("is the desktop layout: no sheet, no RecordRows, the inline editor opens in the page", async () => {
    phone(false);
    render(<LibraryPanel />);
    await screen.findByRole("button", { name: "Edit Launch" });
    expect(rows()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit Launch" }));
    expect(await screen.findByRole("region", { name: /^Editing/ })).toBeTruthy();
    expect(document.querySelector("dialog")).toBeNull();
  });
});
