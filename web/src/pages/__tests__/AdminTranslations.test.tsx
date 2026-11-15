import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTranslations from "@/pages/AdminTranslations";
import TranslationPill from "@/components/admin/TranslationPill";
import { editHref, invalidateTranslations, tabOf, toDo, type TranslationItem, type TranslationReport } from "@/services/translations";

/*
 * The Translations page and the Hebrew pill (#302): the report's units as
 * tabs, filtered by type and visibility, each row linked to its field.
 */

const unit = (path: string, status: TranslationItem["units"][number]["status"], primary = true) => ({
  path,
  status,
  primary,
  en: path,
  he: status === "missing" || status === "draft" ? null : "עברית",
  draftHe: status === "draft" ? "טיוטה" : null,
});

const ITEMS: TranslationItem[] = [
  { type: "site-copy", id: "hero", title: "Home · hero", route: "/", rank: 0, visibility: "public", status: "missing", units: [unit("title", "missing"), unit("phrases.0", "missing")] },
  {
    type: "project",
    id: "windom",
    title: "WindoM",
    route: "/projects/windom",
    rank: 10,
    visibility: "public",
    status: "stale",
    units: [unit("fact", "stale"), unit("decisions.0.body", "missing", false), unit("decisions.1.body", "missing", false)],
  },
  { type: "area", id: "bothy", title: "Bothy", route: "/blog/area/bothy", rank: 50, visibility: "public", status: "translated", units: [unit("title", "translated")] },
  { type: "post", id: "a-draft", title: "A draft", route: "/blog/a-draft", rank: 100, visibility: "private", status: "draft", units: [unit("title", "draft")] },
];

const report = (): TranslationReport => ({
  counts: { missing: 4, draft: 1, stale: 1, unverified: 0, translated: 1 },
  coverage: 29,
  items: ITEMS,
});

beforeEach(() => {
  invalidateTranslations();
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.startsWith("/api/admin/translations") ? { ok: true, ...report() } : { ok: true, login: "owner", email: null };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const page = (at = "/admin/translations") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminTranslations />
    </MemoryRouter>,
  );

describe("the Translations page", () => {
  it("opens on what is missing in public, in reading order, with a count per tab", async () => {
    page();
    const table = await screen.findByRole("grid");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("link")[0].textContent)).toEqual(["Home · hero", "WindoM"]);
    // Status once: the tab says it, so no row carries a Hebrew status pill, and the path is shown once.
    expect(table.querySelector(".a-he")).toBeNull();
    expect(within(rows[1]).getAllByText("/he/projects/windom")).toHaveLength(1);
    expect(within(rows[1]).getByText("decisions ×2")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Missing/ })).toHaveAttribute("aria-selected", "true");
    // A tab counts rows, not fields: WindoM's three fields are one row.
    expect(screen.getByRole("tab", { name: /Missing/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Done/ })).toHaveTextContent("1");
    // The private draft is not counted until private items are shown.
    expect(screen.getByRole("tab", { name: /Draft/ })).toHaveTextContent("0");
    expect(screen.getByText(/Hebrew coverage/)).toHaveTextContent("Hebrew coverage 33%");
  });

  it("links each row to the field it is about", async () => {
    page();
    const link = await screen.findByRole("link", { name: "WindoM" });
    expect(link).toHaveAttribute("href", "/admin/projects?project=windom#field=decisions.0.body");
    expect(screen.getByRole("link", { name: "Home · hero" })).toHaveAttribute("href", "/admin/site-copy#field=hero.title");
  });

  it("counts on each tab exactly the rows that tab shows, under every filter", async () => {
    for (const at of ["/admin/translations", "/admin/translations?visibility=all", "/admin/translations?visibility=all&type=post"]) {
      const { unmount } = page(at);
      await screen.findByRole("tab", { name: /Missing/ });
      for (const name of ["Missing", "Stale", "Draft", "Done"]) {
        const tab = screen.getByRole("tab", { name: new RegExp(name) });
        fireEvent.click(tab);
        const table = screen.queryByRole("grid");
        const shown = table ? table.querySelectorAll("tr[data-row]").length : 0;
        expect(tab.textContent?.replace(/\D/g, ""), `${at} ${name}`).toBe(String(shown));
      }
      unmount();
    }
  });

  it("filters by tab, type and visibility", async () => {
    page("/admin/translations?visibility=all");
    fireEvent.click(await screen.findByRole("tab", { name: /Draft/ }));
    expect(screen.getByRole("link", { name: "A draft" })).toHaveAttribute("href", "/admin/posts/a-draft#field=title");
    fireEvent.click(screen.getByRole("button", { name: "Areas" }));
    expect(await screen.findByText("No Hebrew is waiting in a draft.")).toBeInTheDocument();
  });
});

describe("the Translations page, row actions and states", () => {
  it("gives each row Open as its first icon; fewer than three actions stay inline, with no More (D2)", async () => {
    page();
    const table = await screen.findByRole("grid");
    const row = table.querySelectorAll<HTMLElement>("tr[data-row]")[1];
    expect(within(row).getByRole("button", { name: /^Open/ })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("searches items and says why a list is empty", async () => {
    page("/admin/translations?q=zzz");
    expect(await screen.findByText("Nothing matches those filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(await screen.findByRole("link", { name: "WindoM" })).toBeInTheDocument();
  });

  it("shows a skeleton while the report loads", () => {
    page();
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull();
  });
});

describe("the Hebrew pill", () => {
  it("says the state in words, and renders nothing when there is nothing to translate", () => {
    const { container, rerender } = render(<TranslationPill status="stale" />);
    expect(container.textContent).toContain("HE stale");
    expect(screen.getByText("Hebrew written for an older English")).toHaveClass("sr-only");
    rerender(<TranslationPill status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the report helpers", () => {
  it("counts unverified Hebrew as done, and only public missing or stale units as to do", () => {
    expect(tabOf("unverified")).toBe("done");
    expect(tabOf("stale")).toBe("stale");
    // Items, not fields: the hero and WindoM; the private draft is not counted.
    expect(toDo(report())).toBe(2);
  });

  it("opens a story role by its id", () => {
    const role: TranslationItem = { ...ITEMS[0], type: "story", id: "role:lead", units: [unit("lines.0", "missing")] };
    expect(editHref(role, role.units[0])).toBe("/admin/story?role=lead#field=lines.0");
    expect(editHref({ ...role, id: "start" }, role.units[0])).toBe("/admin/story#field=start.lines.0");
  });
});
