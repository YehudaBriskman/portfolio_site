import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsPanel from "../SettingsPanel";
import { DEFAULT_NOTIFY } from "../notify/defaults";
import { DEFAULT_SENDER } from "../sender/defaults";

/*
 * Marketing > Settings on a phone (#678): the flat list of checkboxes and help
 * paragraphs becomes a list of groups, each with ONE live summary line. jsdom
 * cannot see layout, so these pin the structure; the PR's screenshots show it.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const base = () => ({
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: ["build"],
  signature: "",
  channels: ["linkedin", "email"],
  templates: { en: {}, he: {} },
  snippets: [],
  library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } },
  sender: { ...DEFAULT_SENDER, footerIdentity: "Yehuda", identityEmail: "me@example.com", testRecipients: ["me@example.com"] },
  notify: DEFAULT_NOTIFY,
});

let puts: Array<{ body: string }> = [];
function stub(settings: unknown = base()) {
  puts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/admin/announce/settings") {
        if (init?.method === "PUT") {
          puts.push({ body: String(init.body) });
          return json({ ok: true, exists: true, _rev: "2-b", updatedAt: null, settings: JSON.parse(String(init.body)).settings });
        }
        return json({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings });
      }
      if (url.startsWith("/api/admin/announce/budget")) return json({ ok: false }, 500);
      return json({ ok: true });
    }),
  );
}

const realMatchMedia = window.matchMedia;
/** A phone: only the under-600px query matches. */
function asPhone(on = true) {
  window.matchMedia = ((q: string) => ({
    ...realMatchMedia(q),
    matches: on && /max-width:\s*599/.test(q),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
  asPhone();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const panel = (at = "/admin/marketing?tab=settings") => render(<MemoryRouter initialEntries={[at]}><SettingsPanel /></MemoryRouter>);
const groupRow = (id: string) => document.querySelector<HTMLElement>(`[data-settings-group="${id}"]`)!;
const rowButton = (id: string) => within(groupRow(id)).getByRole("button");
const summaryOf = (id: string) => groupRow(id).querySelector("[data-sg-summary]")!.textContent ?? "";
const landing = async () => {
  panel();
  await screen.findByRole("searchbox", { name: "Search settings" });
};

describe("the landing", () => {
  it("shows at least 8 group rows, each with one summary line and no help paragraph", async () => {
    stub();
    await landing();
    const rows = [...document.querySelectorAll("[data-settings-group]")];
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const r of rows) {
      const s = r.querySelector("[data-sg-summary]")!.textContent!;
      expect(s.trim(), r.getAttribute("data-settings-group")!).not.toBe("");
      expect(s).not.toMatch(/\n/);
    }
    expect(document.querySelectorAll(".a-hint").length).toBe(0);
    expect(document.querySelector("input[type=checkbox]:not([role=switch])")).toBeNull();
  });

  it("puts the everyday groups first and Advanced last", async () => {
    stub();
    await landing();
    const ids = [...document.querySelectorAll("[data-settings-group]")].map((r) => r.getAttribute("data-settings-group"));
    expect(ids.slice(0, 3)).toEqual(["mail", "channels", "wording"]);
    expect(ids[ids.length - 1]).toBe("advanced");
  });

  it("searches across the groups from the top", async () => {
    stub();
    await landing();
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toBeTruthy();
  });
});

describe("summaries are live", () => {
  it("name the channels that are on and follow the switches", async () => {
    stub();
    await landing();
    expect(summaryOf("channels")).toMatch(/LinkedIn/);
    expect(summaryOf("channels")).not.toMatch(/Instagram/);
    fireEvent.click(rowButton("channels"));
    fireEvent.click(await screen.findByRole("switch", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    await waitFor(() => expect(summaryOf("channels")).toMatch(/Instagram/));
  });

  it("say whether email and alerts are on", async () => {
    stub();
    await landing();
    expect(summaryOf("mail")).toMatch(/off/i);
    fireEvent.click(rowButton("mail"));
    fireEvent.click(await screen.findByRole("switch", { name: "Event emails" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(summaryOf("mail")).toMatch(/on/i));
  });

  it("show the hashtags", async () => {
    stub();
    await landing();
    expect(summaryOf("wording")).toContain("#build");
  });
});

describe("help stays behind the info button", () => {
  it("a switch row carries no paragraph; the help is in the DOM only while the popover is open", async () => {
    stub();
    await landing();
    fireEvent.click(rowButton("mail"));
    const sw = await screen.findByRole("switch", { name: "Event emails" });
    const row = sw.closest("[data-setting-id]") as HTMLElement;
    expect(row.querySelectorAll(".a-hint").length).toBe(0);
    /* The popover's text is not in the DOM until it opens; the other row's first sentence is only a screen-reader description. */
    const count = () => document.querySelectorAll("p").length;
    const closed = count();
    fireEvent.click(within(row).getByRole("button", { name: "About Event emails" }));
    await waitFor(() => expect(count()).toBe(closed + 1));
    expect(screen.getByText(/One email per event, to the contact address/, { selector: "p" })).toBeTruthy();
  });

  it("an open page shows no help paragraph, only warnings and errors", async () => {
    stub();
    await landing();
    for (const id of ["sender", "limits", "texts", "notices", "advanced", "wording", "channels"]) {
      fireEvent.click(rowButton(id));
      await screen.findByRole("heading", { level: 2 });
      expect(document.querySelectorAll(".a-hint:not([role])").length, id).toBe(0);
      const back = screen.getByRole("button", { name: "Back to settings" });
      fireEvent.click(back);
      await screen.findByRole("searchbox", { name: "Search settings" });
    }
  });
});

describe("opening and closing a group", () => {
  it("a small group is a sheet and focus returns to its row on close", async () => {
    stub();
    await landing();
    const opener = rowButton("mail");
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("switch", { name: "Event emails" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(rowButton("mail")));
  });

  it("a big group is a page with Back, and focus returns to its row", async () => {
    stub();
    await landing();
    fireEvent.click(rowButton("sender"));
    expect(await screen.findByRole("heading", { level: 2, name: "Sender & delivery" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    await waitFor(() => expect(document.activeElement).toBe(rowButton("sender")));
  });

  it("opens the group named in the address (the deep link kept from before)", async () => {
    stub();
    panel("/admin/marketing?tab=settings&section=sender");
    expect(await screen.findByRole("heading", { level: 2, name: "Sender & delivery" })).toBeTruthy();
  });
});

describe("search finds hidden fields and opens them", () => {
  it("finds the UTM switch under Advanced and lands on it", async () => {
    stub();
    await landing();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "utm" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /Tag links to this site/ }))[0]);
    const sw = await screen.findByRole("switch", { name: "Tag links to this site" });
    await waitFor(() => expect(document.activeElement).toBe(sw));
  });

  it("finds a field inside a closed section, opens the section and focuses the field", async () => {
    stub();
    await landing();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "postal" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /Postal address/ }))[0]);
    const field = await screen.findByRole("textbox", { name: /Postal address or P\.O\. box/ });
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.closest("details")!.open).toBe(true);
  });

  it("matches words that are only in the help text", async () => {
    stub();
    await landing();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "{link}" } });
    expect((await screen.findAllByRole("button", { name: /Confirmation message/ })).length).toBeGreaterThan(0);
  });
});

describe("save semantics are unchanged", () => {
  it("shows the dirty bar after an edit, and Discard puts it back", async () => {
    stub();
    await landing();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(rowButton("mail"));
    fireEvent.click(await screen.findByRole("switch", { name: "Event emails" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const save = (await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(screen.getAllByText("Unsaved changes").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).toBeNull());
  });

  it("sends the same settings:announce payload as the desktop form for the same edits", async () => {
    /* Desktop first: the form as it was. */
    asPhone(false);
    stub();
    panel();
    fireEvent.click(await screen.findByLabelText("Email me about new events"));
    fireEvent.change(screen.getByLabelText("Signature"), { target: { value: "Yehuda" } });
    fireEvent.change(screen.getByLabelText("Default hashtags"), { target: { value: "build, ship" } });
    fireEvent.click(screen.getByLabelText("Instagram"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    const desktop = puts[0].body;
    cleanup();

    asPhone(true);
    stub();
    await landing();
    fireEvent.click(rowButton("mail"));
    fireEvent.click(await screen.findByRole("switch", { name: "Event emails" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(rowButton("wording"));
    fireEvent.change(await screen.findByLabelText("Signature"), { target: { value: "Yehuda" } });
    fireEvent.change(screen.getByLabelText("Default hashtags"), { target: { value: "build, ship" } });
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    fireEvent.click(rowButton("channels"));
    fireEvent.click(await screen.findByRole("switch", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0].body).toBe(desktop);
  });

  it("refuses what the server refuses: a hashtag with a hyphen disables Save and says why", async () => {
    stub();
    await landing();
    fireEvent.click(rowButton("wording"));
    const box = await screen.findByLabelText("Default hashtags");
    fireEvent.change(box, { target: { value: "#build-in-public" } });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/#build-in-public.*letters, digits/)).toBeTruthy();
    expect(((await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    expect(summaryOf("wording")).toBeTruthy();
    expect(groupRow("wording").querySelector("[role=alert]")).not.toBeNull();
  });

  it("resets a group to its defaults from inside the group", async () => {
    stub();
    await landing();
    fireEvent.click(rowButton("wording"));
    fireEvent.click(await screen.findByRole("button", { name: "Reset section to defaults" }));
    expect((screen.getByLabelText("Default hashtags") as HTMLInputElement).value).toBe("");
  });

  it("never offers a mail account credential", async () => {
    stub();
    await landing();
    for (const id of ["sender", "limits", "texts", "notices", "advanced", "mail", "channels", "wording"]) {
      fireEvent.click(rowButton(id));
      await waitFor(() => expect(document.querySelector("[data-surface]")).not.toBeNull());
      expect(document.querySelector("input[type=password]")).toBeNull();
      expect(document.body.textContent).not.toMatch(/smtp|password/i);
      const back = screen.queryByRole("button", { name: "Back to settings" }) ?? screen.getByRole("button", { name: "Close" });
      fireEvent.click(back);
      await screen.findByRole("searchbox", { name: "Search settings" });
    }
  });
});

describe("Hebrew, right to left", () => {
  it("shows every row in Hebrew and opens a group", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    stub();
    panel();
    await screen.findByRole("searchbox", { name: "חיפוש בהגדרות" });
    const rows = [...document.querySelectorAll("[data-settings-group]")];
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const r of rows) {
      expect(r.textContent, r.getAttribute("data-settings-group")!).toMatch(/[֐-׿]/);
      expect(r.textContent).not.toMatch(/Sender|Channels|Advanced|Hashtags/);
    }
    fireEvent.click(rowButton("channels"));
    expect(await screen.findByRole("button", { name: "חזרה להגדרות" })).toBeTruthy();
  });
});
