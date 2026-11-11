import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import FilterControl, { type FacetSpec } from "@/components/gallery/FilterControl";
import RailLayout from "@/components/gallery/Rail";
import Wall from "@/components/gallery/Wall";
import {
  facetOptions,
  hrefCleared,
  hrefToggled,
  hrefWithValues,
  readSelection,
} from "@/components/gallery/facets";
import { byYear, filterNotes, noteOptions, sizesOfNotes } from "@/components/notes/shelf";
import type { PostSummary } from "@/services/blog";

/*
 * The shared gallery (#193): the facet rules, the filter control's listbox
 * behaviour (APG), the rail, the wall, and the notes' shelf rules. Layout and
 * the scroll timeline are jsdom-blind and checked in a browser
 * (docs/gallery-filters/); the off-switches are asserted on the stylesheet
 * text, because jsdom resolves neither `@supports` nor the cascade.
 */

const css = (path: string) =>
  readFileSync(resolve(process.cwd(), `src/components/${path}`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("facets in the URL", () => {
  it("reads repeated parameters as several values, and a single one as one", () => {
    const sel = readSelection(new URLSearchParams("stack=Go&stack=Rust&year=2024&q=x"), ["stack", "year", "state"]);
    expect(sel).toEqual({ stack: ["Go", "Rust"], year: ["2024"] });
  });

  it("adds a value, takes it off again, and keeps every other parameter", () => {
    expect(hrefToggled("/blog", "?q=ci&tag=go", "tag", "rust")).toBe("/blog?q=ci&tag=go&tag=rust");
    expect(hrefToggled("/blog", "?q=ci&tag=go", "tag", "go")).toBe("/blog?q=ci");
    expect(hrefWithValues("/projects", "", "year", [])).toBe("/projects");
    expect(hrefCleared("/blog", "?tag=a&year=2024&q=x", ["tag", "year"])).toBe("/blog?q=x");
  });

  it("orders by count and drops the singletons unless one is chosen", () => {
    const items = [["a", "b"], ["a"], ["a", "c"]];
    const values = (i: string[]) => i;
    expect(facetOptions(items, "t", {}, ["t"], values, { order: "count", min: 2 })).toEqual([{ value: "a", count: 3 }]);
    expect(
      facetOptions(items, "t", { t: ["c"] }, ["t"], values, { order: "count", min: 2 }).map((o) => o.value)
    ).toEqual(["a", "c"]);
  });
});

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

const FACETS: FacetSpec[] = [
  {
    key: "state",
    label: "State",
    options: [
      { value: "Live", count: 3 },
      { value: "Archive", count: 2 },
      { value: "In use", count: 0 },
    ],
  },
  { key: "year", label: "Year", options: [{ value: "2024", count: 4 }] },
];

function renderControl(search = "") {
  const sel = readSelection(new URLSearchParams(search), ["state", "year"]);
  return render(
    <MemoryRouter initialEntries={[`/projects${search}`]}>
      <FilterControl
        title="Filter projects"
        facets={FACETS}
        selection={sel}
        path="/projects"
        shown={5}
        total={5}
        noun="projects"
      />
      <Where />
    </MemoryRouter>
  );
}

describe("the filter control", () => {
  it("is a button that opens a multi-selectable listbox, on the first option, and closes on Escape", () => {
    renderControl();
    const trigger = screen.getByRole("button", { name: /State/ });
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = screen.getByRole("listbox", { name: "State" });
    expect(list.getAttribute("aria-multiselectable")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const options = within(list).getAllByRole("option");
    expect(document.activeElement).toBe(options[0]);

    fireEvent.keyDown(options[0], { key: "End" });
    expect(document.activeElement).toBe(within(list).getAllByRole("option")[2]);
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    fireEvent.keyDown(document.activeElement!, { key: "a" });
    expect(document.activeElement?.textContent).toContain("Archive");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("toggles a value into the URL with Space and keeps the list open", () => {
    renderControl();
    fireEvent.keyDown(screen.getByRole("button", { name: /State/ }), { key: "Enter" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(screen.getByTestId("where").textContent).toBe("/projects?state=Archive");
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("marks the chosen values, shows them as removable tokens, and offers Clear all", () => {
    renderControl("?state=Live&state=Archive&year=2024");
    expect(screen.getByRole("button", { name: /State.*2 chosen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /State/ }));
    const chosen = within(screen.getByRole("listbox")).getAllByRole("option", { selected: true });
    expect(chosen.map((o) => o.textContent)).toEqual([expect.stringContaining("Live"), expect.stringContaining("Archive")]);

    const tokens = within(screen.getByRole("list", { name: "Active filters" })).getAllByRole("link");
    expect(tokens).toHaveLength(3);
    expect(tokens[0].getAttribute("href")).toBe("/projects?year=2024&state=Archive");
    expect(screen.getByRole("link", { name: "Clear all" }).getAttribute("href")).toBe("/projects");
  });

  it("closes on a press outside", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: /Year/ }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("the rail", () => {
  /* jsdom's `matchMedia` (setupTests) matches nothing, so this is the
     narrow layout: the rail is a sheet behind a button. */
  it("is a button that opens the rail as a modal sheet on a narrow screen, with the count on it", () => {
    render(
      <MemoryRouter>
        <RailLayout label="Filter notes" count={2} done="Show 3 notes" rail={<p>rail</p>} bar={<p>tokens</p>}>
          <p>wall</p>
        </RailLayout>
      </MemoryRouter>
    );
    const open = screen.getByRole("button", { name: "Filter, 2 on" });
    expect(open.getAttribute("aria-haspopup")).toBe("dialog");
    const sheet = document.querySelector("dialog")!;
    expect(sheet.getAttribute("aria-labelledby")).toBeTruthy();
    expect(sheet.textContent).toContain("rail");
    expect(sheet.textContent).toContain("Show 3 notes");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("the wall", () => {
  it("hangs every item in a named list with its size, and nothing else", () => {
    render(
      <Wall
        label="All notes"
        name="n"
        items={[
          { key: "a", size: "lead", node: <span>A</span> },
          { key: "b", size: "tile", node: <span>B</span> },
        ]}
      />
    );
    const items = within(screen.getByRole("list", { name: "All notes" })).getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-size"))).toEqual(["lead", "tile"]);
  });

  it("cancels the arrival under each of the three off-switches, and the re-hang under two", () => {
    const text = css("gallery/Wall.module.css");
    for (const gate of [
      /@supports not \(animation-timeline: view\(\)\) \{([\s\S]*?)\n\}/,
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
      /:global\(body\.motion-paused\) ([^{]+)\{[^}]*\}/,
    ]) {
      const block = text.match(gate);
      expect(block, String(gate)).not.toBeNull();
      expect(block![0]).toContain(".piece");
      expect(block![0]).toMatch(/animation: none/);
    }
    expect(text).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*::view-transition-group\(\*\)[\s\S]*animation: none/);
    expect(text).toMatch(/:global\(html:has\(body\.motion-paused\)\)::view-transition-group\(\*\)/);
  });

  it("is the only place the gallery animates: the pieces' stylesheets carry no keyframes", () => {
    for (const f of ["notes/NoteTile.module.css", "gallery/Filter.module.css", "gallery/Rail.module.css"]) {
      expect(css(f), f).not.toMatch(/@keyframes|animation:/);
    }
  });
});

const post = (i: number, over: Partial<PostSummary> = {}): PostSummary => ({
  slug: `n${i}`,
  title: `Note ${i}`,
  subtitle: null,
  excerpt: i % 2 ? "About continuous integration" : "About the database",
  publishedAt: `${2022 + (i % 3)}-03-0${1 + (i % 8)}T00:00:00Z`,
  tags: i % 2 ? ["ci", "testing"] : ["postgres"],
  collection: i % 4 ? "site" : "windom",
  coverImage: i === 3 ? "/c.png" : null,
  readingMinutes: 4,
  ...over,
});

describe("the notes' shelf", () => {
  const posts = Array.from({ length: 9 }, (_, i) => post(i));

  it("filters by topic, year and collection, and searches every word typed", () => {
    expect(filterNotes(posts, { tag: ["ci"] }, "").every((p) => p.tags.includes("ci"))).toBe(true);
    expect(filterNotes(posts, { year: ["2024"] }, "").every((p) => p.publishedAt!.startsWith("2024"))).toBe(true);
    expect(filterNotes(posts, { collection: ["windom"] }, "").map((p) => p.slug)).toEqual(["n0", "n4", "n8"]);
    expect(filterNotes(posts, {}, "continuous ci")).toHaveLength(4);
    expect(filterNotes(posts, {}, "continuous postgres")).toHaveLength(0);
  });

  it("counts topics against the search too, so a count agrees with the wall", () => {
    const tags = noteOptions(posts, "tag", {}, "database");
    expect(tags.find((t) => t.value === "ci")?.count).toBe(0);
    expect(tags.find((t) => t.value === "postgres")?.count).toBe(5);
  });

  it("hangs the newest note as the lead and a covered note wide, whatever the filter", () => {
    const sizes = sizesOfNotes(posts);
    const newest = [...posts].sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))[0].slug;
    expect(sizes.get(newest)).toBe("lead");
    expect(sizes.get("n3")).toBe(newest === "n3" ? "lead" : "wide");
    expect([...sizes.values()].filter((s) => s === "lead")).toHaveLength(1);
  });

  it("indexes by year, newest first, undated last", () => {
    const groups = byYear([...posts, post(99, { publishedAt: null })]);
    expect(groups.map((g) => g.label)).toEqual(["2024", "2023", "2022", "Undated"]);
  });
});
