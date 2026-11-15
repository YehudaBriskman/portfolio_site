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

  it.each(["en", "he"])("lays the filters out as the same grid in %s", async (lang) => {
    document.documentElement.lang = lang;
    render(<AudienceTab />);
    const filters = await screen.findByTestId("audience-filters");
    expect(filters.className).toMatch(/\bgrid\b/);
    expect(filters.className).toMatch(/grid-cols-2/);
    expect(within(filters).getAllByRole("combobox")).toHaveLength(2);
  });
});

describe("dialogs (M14)", () => {
  const props = { groups: [], onClose: () => {}, onDone: () => {} };
  const contact = { hash: "h", email: "a@b.co", name: "A", lang: "en", groups: [], status: "active", source: "site", consentAt: "2026-01-02T00:00:00Z", consentNote: "x", topics: {} } as never;
  const cases: Array<[string, () => React.ReactElement, RegExp]> = [
    ["add contact", () => <AddContact {...props} />, /^Add/i],
    ["edit contact", () => <ContactEditor {...props} contact={contact} />, /^Save/i],
    ["import", () => <ImportDialog {...props} />, /import/i],
  ];

  it.each(cases)("%s: capped height, scrolling body, sticky footer holding the primary button", (n, make, name) => {
    render(make());
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    const body = dialog.querySelector("[data-modal-body]");
    expect(body?.className).toMatch(/overflow-y-auto/);
    expect(body?.className).toMatch(/overscroll-contain/);
    if (n === "import") return; // its footer only exists once a file is chosen
    const foot = dialog.querySelector("[data-modal-footer]");
    expect(foot, "footer").not.toBeNull();
    expect(foot!.className).toMatch(/sticky/);
    expect(within(foot as HTMLElement).getAllByRole("button", { hidden: true }).some((b) => name.test(b.textContent ?? ""))).toBe(true);
  });
});
