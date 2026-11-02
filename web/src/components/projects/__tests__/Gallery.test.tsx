import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Gallery from "@/components/projects/Gallery";
import { applyFilters, kindOf, optionsFor, sizesOf, stackOf } from "@/components/projects/catalogue";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout and no scroll timeline, so the wall's arrival is
 * checked in a browser (docs/projects-gallery/, docs/gallery-filters/). What
 * can break silently, and is checked here: every project is on the wall with
 * one link to its page; sizes come from data, not position; the filters
 * narrow and count honestly. The wall's off-switches and the filter control
 * are the shared gallery's, tested in `gallery/__tests__/Gallery.test.tsx`.
 */

const collection = (over: Partial<Collection> = {}): Collection => ({
  slug: "windom",
  title: "WindoM",
  tagline: "Every new tab becomes a dashboard",
  description: "A Chrome extension.",
  coverImage: null,
  links: [],
  order: 50,
  kind: "project",
  repoUrl: null,
  stats: null,
  ...over,
});

const entry = (i: number, over: Partial<ProjectEntry> = {}, col: Partial<Collection> = {}): ProjectEntry => ({
  collection: collection({ slug: `p${i}`, title: `Project ${i}`, order: 50 + i, ...col }),
  live: false,
  state: i % 2 ? "Live" : "Archive",
  status: "Live",
  year: String(2020 + (i % 6)),
  tech: i % 3 ? ["TypeScript", "React"] : ["Go"],
  highlights: [],
  fields: [],
  tint: null,
  problem: null,
  role: null,
  outcome: null,
  decisions: [],
  primaryLink: null,
  otherLinks: [],
  ...over,
});

const many = (n: number) => Array.from({ length: n }, (_, i) => entry(i));

describe("Gallery", () => {
  it.each([4, 40])("hangs all %i projects, one link to its page and one heading each", (n) => {
    const entries = many(n);
    render(
      <MemoryRouter>
        <Gallery entries={entries} sizes={sizesOf(entries)} label="All projects" />
      </MemoryRouter>
    );
    const items = within(screen.getByRole("list", { name: "All projects" })).getAllByRole("listitem", {
      name: (_, el) => el.parentElement?.getAttribute("aria-label") === "All projects",
    });
    expect(items).toHaveLength(n);
    for (const [i, item] of items.entries()) {
      const links = within(item).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toBe(`/projects/p${i}`);
      expect(within(item).getByRole("heading", { level: 2 }).textContent).toBe(`Project ${i}`);
    }
  });

  it("offers the product and the source beside the project link, each named for its project", () => {
    const e = entry(1, { primaryLink: { label: "Visit", url: "https://example.com" } }, { repoUrl: "https://github.com/x/y" });
    render(
      <MemoryRouter>
        <Gallery entries={[e]} sizes={new Map([["p1", "lead"]])} label="All projects" />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /Visit for Project 1/ }).getAttribute("href")).toBe("https://example.com");
    expect(screen.getByRole("link", { name: /Source for Project 1/ }).getAttribute("href")).toBe("https://github.com/x/y");
  });
});

describe("sizes come from the project, not its position", () => {
  it("hangs featured recent work as a lead, active recent work wide, and the rest as tiles", () => {
    const entries = [
      entry(0, { year: "2026", state: "In use" }, { order: 10 }),
      entry(1, { year: "2025", state: "Live" }),
      entry(2, { year: "2019", state: "Live" }),
      entry(3, { year: "2018", state: "In use" }, { order: 11 }),
      entry(4, { year: "2026", state: "Archive" }),
    ];
    const sizes = sizesOf(entries);
    expect([...sizes.values()]).toEqual(["lead", "wide", "tile", "wide", "tile"]);
    /* The same project is the same size wherever it lands. */
    expect(sizesOf([...entries].reverse()).get("p1")).toBe("wide");
  });
});

describe("filters", () => {
  const entries = many(12);

  it("narrows by every facet at once", () => {
    const shown = applyFilters(entries, { state: ["Live"], stack: ["Go"] });
    expect(shown.every((e) => e.state === "Live" && stackOf(e).includes("Go"))).toBe(true);
    expect(shown.length).toBeGreaterThan(0);
  });

  it("reads two values in one facet as either, and two facets as both", () => {
    expect(applyFilters(entries, { stack: ["Go", "React"] })).toHaveLength(entries.length);
    const both = applyFilters(entries, { stack: ["Go", "React"], state: ["Archive"] });
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((e) => e.state === "Archive")).toBe(true);
  });

  it("counts each option against the other two filters, so a zero is visible before it is pressed", () => {
    const years = optionsFor(entries, "year", { state: ["Live"] });
    for (const y of years) {
      expect(y.count).toBe(applyFilters(entries, { state: ["Live"], year: [y.value] }).length);
    }
    expect(years.map((y) => y.value)).toEqual([...years.map((y) => y.value)].sort().reverse());
  });

  it("keeps a selected value that no option would offer, so a stale link still shows its choice", () => {
    expect(optionsFor(entries, "stack", { stack: ["Cobol"] }).map((o) => o.value)).toContain("Cobol");
  });
});

describe("states", () => {
  it("groups states into families for the dot, and leaves the word to say which", () => {
    expect(["Live", "In use", "Open source", "v2.1.0", "Archive"].map(kindOf)).toEqual([
      "live",
      "use",
      "open",
      "release",
      "rest",
    ]);
  });
});
