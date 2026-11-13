import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LibraryPanel from "../library/LibraryPanel";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/settings/schema";
import SettingsPanel from "../SettingsPanel";
import type { AnnounceSettings } from "@/services/adminAnnounce";
import { DEFAULT_NOTIFY } from "../notify/defaults";
import "../words";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const baseSettings = () => ({
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: ["web"],
  signature: "",
  channels: ["linkedin", "instagram", "email", "gmail", "x"],
  templates: { en: {}, he: {} },
  snippets: [{ id: "s1", name: "Tags", kind: "hashtags", text: "#one #two" }],
  library: [{ id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}" }],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  notify: DEFAULT_NOTIFY,
});
const view = (settings = baseSettings(), rev = "1-a") => ({ ok: true, exists: true, _rev: rev, updatedAt: null, settings });
const site = () => ({ ok: true, exists: true, _rev: "9-z", version: 1, updatedAt: null, history: [], settings: { ...DEFAULT_SETTINGS, sharing: { ...DEFAULT_SETTINGS.sharing, templates: { en: { x: "Hi {title}" }, he: {} } } } });

type Call = { url: string; method: string; body: { _rev?: string; settings: AnnounceSettings } };
let calls: Call[];
let putStatus = 200;
beforeEach(() => {
  calls = [];
  putStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/admin/announce/settings" && method === "GET") return json(view());
      if (url === "/api/admin/announce/settings" && method === "PUT") return putStatus === 200 ? json(view(body.settings, "2-b")) : json({}, putStatus);
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [{ id: "e1", kind: "post", ref: "hello", title: "Real note", url: "https://s.test/n/hello", langs: ["en"], createdAt: "", readAt: null, done: {}, dismissed: null }] });
      if (url === "/api/admin/announce/e1") return json({ ok: true, kit: {}, event: { id: "e1", kind: "post", ref: "hello", title: "Real note", url: "https://s.test/n/hello", langs: ["en"], summary: "Its own summary", tags: ["alpha"], version: null, createdAt: "", readAt: null, done: {}, dismissed: null } });
      if (url === "/api/admin/settings" && method === "GET") return json(site());
      if (url === "/api/admin/settings" && method === "PUT") return json({ ...site(), _rev: "10-y", settings: body.settings });
      return json({}, 404);
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

const saved = (method = "PUT", url = "/api/admin/announce/settings") => calls.filter((c) => c.method === method && c.url === url);

describe("LibraryPanel", () => {
  it("lists templates, edits one with a live preview that follows the text, and saves with the revision", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    const box = (await screen.findByLabelText("Caption text")) as HTMLTextAreaElement;
    expect(within(screen.getByTestId("live-preview")).getAllByText(/Notes on building in public/)[0]).toBeTruthy();
    fireEvent.change(box, { target: { value: "Hello {first_name}" } });
    await waitFor(() => expect(within(screen.getByTestId("live-preview")).getByText(/Hello Dana/)).toBeTruthy());
    expect(screen.getByText(/characters once filled in/).textContent).toMatch(/\d+ of 3000/);
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0].body._rev).toBe("1-a");
    expect(saved()[0].body.settings.library[0].text).toBe("Hello {first_name}");
  });

  it("inserts a variable and a snippet at the caret", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    const box = (await screen.findByLabelText("Caption text")) as HTMLTextAreaElement;
    box.setSelectionRange(0, 0);
    fireEvent.click(within(screen.getByRole("region", { name: /^Editing/ })).getByRole("button", { name: "Insert {summary}" }));
    await waitFor(() => expect(box.value).toBe("{summary}{title} {url}"));
    fireEvent.change(screen.getByLabelText("Insert a snippet"), { target: { value: "s1" } });
    fireEvent.click(within(screen.getByRole("region", { name: /^Editing/ })).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(box.value).toContain("#one #two"));
  });

  it("previews against a recent real event", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Launch" }));
    const pick = await screen.findByLabelText("Preview with");
    await screen.findByRole("option", { name: "Real note" });
    fireEvent.change(pick, { target: { value: "e1" } });
    await waitFor(() => expect(within(screen.getByTestId("live-preview")).getAllByText(/Real note/).length).toBeGreaterThan(0));
  });

  it("creates, duplicates and deletes (after a confirm)", async () => {
    render(<LibraryPanel />);
    await screen.findByRole("button", { name: "Edit Launch" });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Launch" }));
    expect(screen.getByRole("button", { name: "Edit Launch (copy)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Launch (copy)" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Launch (copy) for good" }));
    expect(screen.queryByRole("button", { name: "Edit Launch (copy)" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "New template" })[0]);
    expect(screen.getAllByRole("button", { name: "Edit New template" }).length).toBe(1);
  });

  it("edits a built-in template and Reset to default drops the override", async () => {
    render(<LibraryPanel />);
    await screen.findByRole("button", { name: "Edit Launch" });
    fireEvent.click(screen.getByRole("button", { name: "Edit X, English" }));
    const box = (await screen.findByLabelText("Caption text")) as HTMLTextAreaElement;
    expect(box.value).toContain("New on the blog");
    expect((screen.getByRole("button", { name: "Reset to default" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "mine {url}" } });
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0].body.settings.templates.en.x).toBe("mine {url}");
    fireEvent.click(await screen.findByRole("button", { name: "Reset to default" }));
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(2));
    expect(saved()[1].body.settings.templates.en.x).toBeUndefined();
  });

  it("sets one default per channel and language; turning one on turns the other off", async () => {
    render(<LibraryPanel />);
    await screen.findByRole("button", { name: "Edit Launch" });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Launch" }));
    const boxes = screen.getAllByRole("checkbox", { name: "Use as default for LinkedIn, English" });
    expect(boxes).toHaveLength(3); /* two rows and the open editor */
    fireEvent.click(boxes[0]);
    expect(screen.getByText("Default", { selector: "strong" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Use as default for LinkedIn, English" })[1]);
    expect(screen.getAllByText("Default", { selector: "strong" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const lib = saved()[0].body.settings.library;
    expect(lib.filter((i) => i.default)).toHaveLength(1);
    expect(lib.find((i) => i.default)?.name).toBe("Launch (copy)");
  });

  it("a duplicate of the default is not itself a default, and the editor names the current one", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Use as default for LinkedIn, English" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Launch" }));
    expect(screen.getAllByText("Default", { selector: "strong" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit Launch (copy)" }));
    expect(await screen.findByText(/Current default: Launch/)).toBeTruthy();
  });

  it("says a template applies only as the default", async () => {
    render(<LibraryPanel />);
    expect(await screen.findByText(/only used when you set it as the default/)).toBeTruthy();
  });

  it("edits snippets", async () => {
    render(<LibraryPanel />);
    fireEvent.change(await screen.findByDisplayValue("#one #two"), { target: { value: "#changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()[0].body.settings.snippets[0].text).toBe("#changed"));
  });

  it("shows the conflict and offers a reload when the revision is stale", async () => {
    putStatus = 409;
    render(<LibraryPanel />);
    fireEvent.change(await screen.findByDisplayValue("#one #two"), { target: { value: "#x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    expect(await screen.findByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("saves visitor templates through the public settings endpoint, on their own", async () => {
    render(<LibraryPanel />);
    const x = await screen.findByLabelText("X", { selector: "textarea" }, { timeout: 3000 });
    expect((x as HTMLTextAreaElement).value).toBe("Hi {title}");
    fireEvent.change(x, { target: { value: "Seen: {title} {url}" } });
    fireEvent.click(screen.getByRole("button", { name: "Save visitor templates" }));
    await waitFor(() => expect(saved("PUT", "/api/admin/settings")).toHaveLength(1));
    expect(saved("PUT", "/api/admin/settings")[0].body._rev).toBe("9-z");
    expect((saved("PUT", "/api/admin/settings")[0].body.settings as unknown as SiteSettings).sharing.templates.en.x).toBe("Seen: {title} {url}");
    expect(saved()).toHaveLength(0);
  });
});

describe("SettingsPanel", () => {
  it("keeps Advanced closed, opens it by filtering, and saves the UTM scheme", async () => {
    render(<SettingsPanel />);
    const adv = (await screen.findByTestId("advanced")) as HTMLDetailsElement;
    expect(adv.open).toBe(false);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Filter advanced settings"), { target: { value: "utm" } });
    expect(adv.open).toBe(true);
    expect(screen.queryByLabelText("Record new events")).toBeNull();
    fireEvent.click(screen.getByLabelText("Tag links to this site"));
    fireEvent.change(screen.getByLabelText("Medium for LinkedIn"), { target: { value: "social" } });
    expect(screen.getByText("Unsaved changes", { selector: "span[role=status]" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const utm = saved()[0].body.settings.advanced.utm;
    expect(utm).toEqual({ enabled: true, source: "announce", mediumByChannel: { linkedin: "social" } });
    expect(saved()[0].body._rev).toBe("1-a");
  });

  it("turns notices on in Everyday and saves per-event, hours and digest choices; nothing in the payload is an address", async () => {
    render(<SettingsPanel />);
    const master = (await screen.findByLabelText("Email me when something needs attention")) as HTMLInputElement;
    expect(master.checked).toBe(false);
    fireEvent.click(master);
    fireEvent.change(screen.getByLabelText("Filter advanced settings"), { target: { value: "notices" } });
    const section = within(screen.getByTestId("notify-section"));
    fireEvent.click(section.getByLabelText("A new confirmed subscriber"));
    fireEvent.click(section.getByLabelText("A hard bounce or a spam complaint"));
    fireEvent.click(section.getByLabelText("One daily summary for bounces, campaigns and new subscribers"));
    fireEvent.change(section.getByLabelText("Send it from hour"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const n = saved()[0].body.settings.notify;
    expect(n.enabled).toBe(true);
    expect(n.events.subscriber.on).toBe(true);
    expect(n.events.bounce.on).toBe(false);
    expect(n.digest).toEqual({ enabled: true, hour: 23 });
    expect(JSON.stringify(n)).not.toContain("@");
  });

  it("disables the per-event choices while the master switch is off, and says it in Hebrew", async () => {
    document.documentElement.lang = "he";
    try {
      render(<SettingsPanel />);
      fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "הודעות" } });
      const section = screen.getByTestId("notify-section");
      expect(within(section).getByLabelText("מנוי חדש אישר הרשמה").matches(":disabled")).toBe(true);
      expect(screen.getByLabelText("שליחת אימייל כשמשהו דורש תשומת לב")).toBeTruthy();
    } finally {
      document.documentElement.lang = "en";
    }
  });

  it("says so when no advanced setting matches", async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "zzzz" } });
    expect(screen.getByText("No advanced setting matches that.")).toBeTruthy();
  });

  it("resets a section to its defaults without touching the other", async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText("Signature"), { target: { value: "-- me" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reset section to defaults" })[0]);
    expect((screen.getByLabelText("Signature") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Default hashtags") as HTMLInputElement).value).toBe("");
  });

  it("refuses a malformed UTM source before Save", async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText("Filter advanced settings"), { target: { value: "utm" } });
    fireEvent.click(screen.getByLabelText("Tag links to this site"));
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Bad Source" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("surfaces a 409", async () => {
    putStatus = 409;
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText("Signature"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Reload" })).toBeTruthy();
  });
});

describe("LibraryPanel starter templates", () => {
  it("merges the pack, marks the library dirty, reports it, and does not save", async () => {
    render(<LibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Add starter templates" }));
    expect(screen.getByText(/^Added \d+, skipped 0$/)).toBeTruthy();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add starter templates" }) as HTMLButtonElement).disabled).toBe(true);
    expect(saved()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const lib = saved()[0].body.settings.library;
    expect(lib[0].id).toBe("t1");
    expect(lib.length).toBe(15);
    expect(lib.some((i) => i.default)).toBe(false);
  });
});
