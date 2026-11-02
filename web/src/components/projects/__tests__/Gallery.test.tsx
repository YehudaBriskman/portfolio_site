import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Gallery from "@/components/projects/Gallery";
import Filters from "@/components/projects/Filters";
import StatsPanel from "@/components/projects/StatsPanel";
import {
  applyFilters,
  hrefWith,
  kindOf,
  optionsFor,
  sizesOf,
  stackOf,
  summarise,
} from "@/components/projects/catalogue";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout and no scroll timeline, so the wall's arrival and the
 * chart's drawing are checked in a browser (docs/projects-gallery/). What can
 * break silently, and is checked here: every project is on the wall with one
 * link to its page; sizes come from data, not position; the filters narrow
 * by URL and count honestly; and every stylesheet carries all three
 * off-switches. The last is asserted on the stylesheet text, because jsdom
 * resolves neither `@supports` nor the cascade behind it.
 */

const css = (name: string) =>
  readFileSync(resolve(process.cwd(), `src/components/projects/${name}`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

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
    const shown = applyFilters(entries, { state: "Live", stack: "Go" });
    expect(shown.every((e) => e.state === "Live" && stackOf(e).includes("Go"))).toBe(true);
    expect(shown.length).toBeGreaterThan(0);
  });

  it("counts each chip against the other two filters, so a zero is visible before it is pressed", () => {
    const years = optionsFor(entries, "year", { state: "Live" });
    for (const y of years) {
      expect(y.count).toBe(applyFilters(entries, { state: "Live", year: y.value }).length);
    }
    expect(years.map((y) => y.value)).toEqual([...years.map((y) => y.value)].sort().reverse());
  });

  it("keeps a selected value that no chip would offer, so a stale link still shows its choice", () => {
    expect(optionsFor(entries, "stack", { stack: "Cobol" }).map((o) => o.value)).toContain("Cobol");
  });

  it("writes the URL, and pressing the active chip clears its facet", () => {
    expect(hrefWith({ state: "Live" }, "year", "2024")).toBe("/projects?state=Live&year=2024");
    expect(hrefWith({ state: "Live", year: "2024" }, "state", null)).toBe("/projects?year=2024");
    expect(hrefWith({}, "stack", null)).toBe("/projects");
  });

  it("renders one labelled group per facet, with the active chip marked", () => {
    const filters = { state: "Live" };
    render(
      <MemoryRouter>
        <Filters
          filters={filters}
          options={{
            state: optionsFor(entries, "state", filters),
            year: optionsFor(entries, "year", filters),
            stack: optionsFor(entries, "stack", filters),
          }}
        />
      </MemoryRouter>
    );
    for (const name of ["State", "Year", "Stack"]) expect(screen.getByRole("group", { name })).toBeTruthy();
    const live = within(screen.getByRole("group", { name: "State" })).getByRole("link", { current: true });
    expect(live.getAttribute("href")).toBe("/projects");
    expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe("/projects");
  });
});

describe("the panel", () => {
  it("keeps the empty years between the first and the last, and prints every count", () => {
    const entries = [entry(0, { year: "2019" }), entry(1, { year: "2022" }), entry(2, { year: "2022" })];
    const summary = summarise(entries);
    expect(summary.byYear).toEqual([
      { year: 2019, count: 1 },
      { year: 2020, count: 0 },
      { year: 2021, count: 0 },
      { year: 2022, count: 2 },
    ]);
    render(<StatsPanel summary={summary} total={3} activeYear="2022" />);
    const panel = screen.getByRole("region", { name: "The catalogue at a glance" });
    expect(panel.getAttribute("data-chrome")).toBe("dark");
    expect(panel.className).toContain("on-panel");
    expect(panel.textContent).toContain("2 in 2022");
  });

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

describe("the three off-switches", () => {
  it.each([
    ["Gallery.module.css", ".tile"],
    ["StatsPanel.module.css", ".bar"],
  ])("%s cancels the scroll animation under each of them", (file, sel) => {
    const text = css(file);
    for (const gate of [
      /@supports not \(animation-timeline: view\(\)\) \{([\s\S]*?)\n\}/,
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
      /:global\(body\.motion-paused\) ([^{]+)\{[^}]*\}/,
    ]) {
      const block = text.match(gate);
      expect(block, `${file}: ${gate}`).not.toBeNull();
      expect(block![0]).toContain(sel);
      expect(block![0]).toMatch(/animation: none/);
    }
  });

  it("cuts the filter's re-hang under reduced motion and Pause", () => {
    const text = css("Gallery.module.css");
    expect(text).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*::view-transition-group\(\*\)[\s\S]*animation: none/);
    expect(text).toMatch(/:global\(html:has\(body\.motion-paused\)\)::view-transition-group\(\*\)/);
  });
});
