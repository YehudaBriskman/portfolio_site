import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AdminTranslations from "@/pages/AdminTranslations";
import { invalidateTranslations, type TranslationItem } from "@/services/translations";
import { controlsIn, factsOf, json, lang, phone, rows, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * Translations below 600px (#682): a row per item with the Hebrew status as
 * one glyph, the five statuses as chips, the type and visibility in the
 * Filters sheet, and a lifecycle stepper plus the fields that need work in
 * the item's sheet. Above 600px nothing changes.
 */

const unit = (path: string, status: TranslationItem["units"][number]["status"], primary = true) => ({
  path, status, primary, en: path, he: status === "missing" || status === "draft" ? null : "עברית", draftHe: status === "draft" ? "טיוטה" : null,
});
const item = (o: Partial<TranslationItem> & Pick<TranslationItem, "id" | "title" | "type" | "status" | "units">): TranslationItem => ({
  route: `/${o.id}`, rank: 0, visibility: "public", ...o,
});
const ITEMS: TranslationItem[] = [
  item({ type: "site-copy", id: "hero", title: "Home · hero", route: "/", status: "missing", units: [unit("title", "missing"), unit("phrases.0", "missing"), unit("phrases.1", "missing")] }),
  item({ type: "project", id: "windom", title: "WindoM", route: "/projects/windom", status: "stale", units: [unit("fact", "stale"), unit("decisions.0.body", "missing", false), unit("decisions.1.body", "missing", false)] }),
  item({ type: "story", id: "start", title: "Story · start", route: "/story", status: "unverified", units: [unit("title", "unverified")] }),
  item({ type: "area", id: "bothy", title: "Bothy", route: "/blog/area/bothy", status: "translated", units: [unit("title", "translated")] }),
  item({ type: "post", id: "a-draft", title: "A draft note with a deliberately long title that has to wrap on a phone", route: "/blog/a-draft", visibility: "private", status: "draft", units: [unit("title", "draft")] }),
  item({ type: "post", id: "fixture-post", title: "A fixture note", route: "/blog/fixture-post", status: "missing", units: [unit("title", "missing")] }),
];

let undoPhone: () => void;
beforeEach(() => {
  invalidateTranslations();
  window.localStorage.clear();
  undoPhone = phone(true);
  stubFetch((url) =>
    url.startsWith("/api/admin/translations")
      ? json({ ok: true, counts: { missing: 3, draft: 1, stale: 1, unverified: 1, translated: 1 }, coverage: 40, items: ITEMS })
      : undefined,
  );
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  lang("en");
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const page = (at = "/admin/translations") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminTranslations />
      <Where />
    </MemoryRouter>,
  );
const rowOf = (name: string) => screen.findByRole("button", { name: `Open ${name}` });
const dialog = () => screen.findByRole("dialog");

describe("Translations on a phone: the list", () => {
  it("shows what still needs Hebrew as rows, not a table, with no Edit buttons and no selects", async () => {
    page();
    await rowOf("Home · hero");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Edit/ })).toBeNull();
    /* Finished and private items are out of the way until asked for. */
    expect(rows().map((r) => r.getAttribute("aria-label"))).toEqual([
      "Open Home · hero", "Open WindoM", "Open Story · start", "Open A fixture note",
    ]);
  });

  it("each row is one button with at most two facts and one named glyph", async () => {
    page();
    await rowOf("Home · hero");
    for (const row of rows()) {
      expect(controlsIn(row)).toBe(1);
      expect(factsOf(row).length).toBeLessThanOrEqual(2);
      expect(row.querySelectorAll("[data-kind]").length).toBe(1);
    }
    expect(within(await rowOf("Home · hero")).getByRole("img", { name: "Hebrew missing" })).toBeTruthy();
    expect(within(await rowOf("WindoM")).getByRole("img", { name: "Hebrew out of date" })).toBeTruthy();
    expect(within(await rowOf("Story · start")).getByRole("img", { name: "Hebrew not verified" })).toBeTruthy();
  });

  it("offers the five statuses as chips and filters by one, in the address", async () => {
    page();
    await rowOf("Home · hero");
    const chips = screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent);
    for (const name of ["Missing", "Out of date", "In a draft", "Not verified", "Done"]) expect(chips).toContain(name);
    fireEvent.click(screen.getByRole("button", { name: "Out of date" }));
    await waitFor(() => expect(rows().map((r) => r.getAttribute("aria-label"))).toEqual(["Open WindoM"]));
    expect(screen.getByTestId("where").textContent).toBe("/admin/translations?status=stale");
  });

  it("puts type and visibility in the Filters sheet, and private items stay out until asked for", async () => {
    page();
    await rowOf("Home · hero");
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const d = await dialog();
    fireEvent.click(within(d).getByRole("checkbox", { name: "Include private items" }));
    fireEvent.click(within(d).getByRole("button", { name: /^Show/ }));
    await waitFor(() => expect(rows().map((r) => r.getAttribute("aria-label"))).toContain("Open A draft note with a deliberately long title that has to wrap on a phone"));
  });

  it("says so when a filter leaves nothing", async () => {
    page("/admin/translations?status=draft");
    expect(await screen.findByText("No item matches these filters.")).toBeTruthy();
  });
});

describe("Translations on a phone: the sheet", () => {
  it("opens from the row with a lifecycle stepper, the fields that need work and one way to edit", async () => {
    page();
    const row = await rowOf("Home · hero");
    row.focus();
    fireEvent.click(row);
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Home · hero" })).toBeTruthy();
    const steps = within(d).getByRole("list", { name: "Where this Hebrew is" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getByText("Missing").closest("li")?.getAttribute("aria-current")).toBe("step");
    expect(within(d).getByText("title")).toBeTruthy();
    expect(within(d).getByText("phrases ×2")).toBeTruthy();
    expect(within(d).getByRole("link", { name: "Edit the Hebrew" })).toHaveAttribute("href", "/admin/site-copy#field=hero.title");
    expect(within(d).getByText("/he").closest("dd")?.getAttribute("dir")).toBe("ltr");
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("explains stale Hebrew and keeps the finished step current", async () => {
    page();
    fireEvent.click(await rowOf("WindoM"));
    const d = await dialog();
    expect(within(d).getByText(/English changed after this Hebrew was written/)).toBeTruthy();
    expect(within(within(d).getByRole("list", { name: "Where this Hebrew is" })).getByText("Done").closest("li")?.getAttribute("aria-current")).toBe("step");
  });
});

describe("Translations on a phone: Hebrew", () => {
  it("is in Hebrew with the same rows", async () => {
    lang("he");
    page();
    expect(await screen.findByRole("button", { name: "פתיחת Home · hero" })).toBeTruthy();
    expect(rows()).toHaveLength(4);
    expect(screen.getByRole("button", { name: "חסרה" })).toBeTruthy();
    expect(screen.queryByText("Missing")).toBeNull();
  });
});

describe("Translations on a desktop", () => {
  it("is unchanged: the table, the selects and the Edit links", async () => {
    undoPhone();
    undoPhone = phone(false);
    page();
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(rows()).toHaveLength(0);
  });
});
