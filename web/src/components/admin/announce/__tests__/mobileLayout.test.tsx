import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminAnnounce from "@/pages/AdminAnnounce";
import Email from "../audience/Email";
import AddContact from "../audience/AddContact";
import ContactEditor from "../audience/ContactEditor";
import ImportDialog from "../audience/ImportDialog";
import AudienceTab from "../audience/AudienceTab";

/*
 * Marketing on phones (#656). jsdom cannot see layout, so these pin the structure and the rules that produce it;
 * the screenshots in the PR show the result.
 */

const css = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (sheet: string, selector: string) => {
  const at = sheet.indexOf(`${selector} {`);
  expect(at, `${selector} rule`).toBeGreaterThan(-1);
  return sheet.slice(sheet.indexOf("{", at) + 1, sheet.indexOf("}", at));
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: false, _rev: null, updatedAt: null, settings: { enabled: true, email: { enabled: false, events: ["post", "release"] }, hashtags: [], signature: "", channels: ["linkedin", "instagram", "email", "gmail", "x"], templates: { en: {}, he: {} } } });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [] });
      if (url.startsWith("/api/admin/audience/contacts?")) return json({ ok: true, contacts: [], nextCursor: null });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals(), document.documentElement.removeAttribute("lang"), document.documentElement.removeAttribute("dir")));

describe("inbox (M10, M13)", () => {
  const inbox = css("src/components/admin/announce/inbox/inbox.css");

  it("hides the keyboard hint on a coarse pointer", () => {
    const m = /@media \(pointer:\s*coarse\)\s*\{([^@]*?\.mk-keys\s*\{[^}]*\})/.exec(inbox);
    expect(m, "pointer: coarse block for .mk-keys").not.toBeNull();
    expect(m![1]).toMatch(/display:\s*none/);
  });
});

describe("audience (M12)", () => {
  it("never breaks inside the local part of an address, only before the domain", () => {
    const { container } = render(<Email value="ada.lovelace@example.co.uk" />);
    const addr = container.querySelector("bdi")!;
    expect(addr.querySelectorAll("wbr")).toHaveLength(1);
    expect(addr.childNodes[0].textContent).toBe("ada.lovelace");
    expect(addr.childNodes[1].nodeName).toBe("WBR");
    expect(addr.childNodes[2].textContent).toBe("@example.co.uk");
    expect(addr.className).toMatch(/overflow-wrap:anywhere/);
  });

  it.each(["en", "he"])("puts search first and the status and group filters as chips in %s", async (lang) => {
    document.documentElement.lang = lang;
    render(<MemoryRouter><AudienceTab /></MemoryRouter>);
    const search = await screen.findByRole("searchbox");
    const bar = search.parentElement!.parentElement!;
    expect(bar.firstElementChild!.contains(search)).toBe(true);
    expect(within(bar).getAllByRole("group")).toHaveLength(2);
  });
});

describe("dialogs (M14)", () => {
  const props = { groups: [], onClose: () => {}, onDone: () => {} };
  const contact = { hash: "h", email: "a@b.co", name: "A", lang: "en", groups: [], status: "active", source: "site", consentAt: "2026-01-02T00:00:00Z", consentNote: "x", topics: {} } as never;
  const cases: Array<[string, () => React.ReactElement, RegExp]> = [
    ["add contact", () => <AddContact {...props} />, /^Add/i],
    ["edit contact", () => <ContactEditor {...props} open contact={contact} />, /^Save/i],
  ];

  /* Adding and editing are side panels (A21): the footer is the panel's own and holds the primary button. */
  it.each(cases)("%s: a side panel with a footer holding the primary button", (_n, make, name) => {
    render(make());
    const panel = screen.getByRole("dialog");
    expect(panel.hasAttribute("data-side-panel")).toBe(true);
    const foot = panel.querySelector("footer");
    expect(foot, "footer").not.toBeNull();
    expect(within(foot as HTMLElement).getAllByRole("button").some((b) => name.test(b.textContent ?? ""))).toBe(true);
  });

  it("import: capped height and a scrolling body", () => {
    render(<ImportDialog {...props} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    const body = dialog.querySelector("[data-modal-body]");
    expect(body?.className).toMatch(/overflow-y-auto/);
    expect(body?.className).toMatch(/overscroll-contain/);
  });
});
