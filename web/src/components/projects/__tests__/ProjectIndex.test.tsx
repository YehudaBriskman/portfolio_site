import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectIndex from "@/components/projects/ProjectIndex";
import { FILTER_FROM, filterEarnsPlace, statesOf } from "@/components/projects/catalogue";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout and no scroll timeline, so the riffle itself is checked
 * in a browser (docs/projects-index/). What can break silently and is checked
 * here: the register is a list holding every project with one link each, and
 * the stylesheet carries all three off-switches, each cancelling the
 * animation outright and restating the arrived state. Asserted against the
 * stylesheet text because jsdom resolves neither `@supports` nor the cascade
 * behind it — see the same argument in ProjectRun.test.tsx.
 */

const CSS = readFileSync(
  resolve(process.cwd(), "src/components/projects/ProjectIndex.module.css"),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const collection = (over: Partial<Collection> = {}): Collection => ({
  slug: "windom",
  title: "WindoM",
  tagline: "Every new tab becomes a dashboard",
  description: "A Chrome extension.",
  coverImage: null,
  links: [],
  order: 10,
  kind: "project",
  repoUrl: null,
  stats: null,
  ...over,
});

const entry = (i: number, over: Partial<ProjectEntry> = {}): ProjectEntry => ({
  collection: collection({ slug: `p${i}`, title: `Project ${i}`, order: 50 + i }),
  live: false,
  state: i % 2 ? "Live" : "In use",
  status: "Live",
  year: String(2020 + (i % 6)),
  tech: ["TypeScript", "React"],
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

function renderIndex(entries: ProjectEntry[]) {
  return render(
    <MemoryRouter>
      <ProjectIndex entries={entries} label="All projects" />
    </MemoryRouter>
  );
}

describe("ProjectIndex", () => {
  it.each([4, 40])("lists all %i projects, one link and one heading each", (n) => {
    renderIndex(Array.from({ length: n }, (_, i) => entry(i)));
    const list = screen.getByRole("list", { name: "All projects" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(n);
    for (const [i, item] of items.entries()) {
      const links = within(item).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toBe(`/projects/p${i}`);
      expect(within(item).getByRole("heading", { level: 2 }).textContent).toBe(`Project ${i}`);
    }
  });

  it("falls back to the last push for a year, and says when there is none", () => {
    renderIndex([
      entry(0, {
        year: null,
        collection: collection({
          slug: "api",
          stats: {
            stars: null,
            language: null,
            license: null,
            pushedAt: "2023-05-01T00:00:00Z",
            latestRelease: null,
          } as unknown as Collection["stats"],
        }),
      }),
      entry(1, { year: null }),
    ]);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("2023");
    expect(within(items[1]).getByText("Year not recorded")).toBeTruthy();
  });

  it("renders nothing for an empty list", () => {
    const { container } = renderIndex([]);
    expect(container.querySelector("ol")).toBeNull();
  });
});

describe("the riffle's stylesheet", () => {
  it("is scrubbed by each row's own view timeline, with no duration or delay", () => {
    expect(CSS).toMatch(/view-timeline-name:\s*--leaf/);
    expect(CSS).toMatch(/animation-timeline:\s*--leaf/);
    expect(CSS).not.toMatch(/animation-(duration|delay)\s*:/);
    expect(CSS).not.toMatch(/position:\s*sticky/);
  });

  const blocks = {
    "no animation-timeline": /@supports not \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n\}/,
    "reduced motion": /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/,
  };
  it.each(Object.entries(blocks))("%s lands on the upright leaf", (_, re) => {
    const body = CSS.match(re)?.[1] ?? "";
    expect(body).toMatch(/animation:\s*none/);
    expect(body).toMatch(/transform:\s*none/);
    expect(body).toMatch(/opacity:\s*0/);
    expect(body).not.toMatch(/play-state/);
  });

  it("Pause lands on the upright leaf", () => {
    const paused = CSS.split("\n")
      .join(" ")
      .match(/:global\(body\.motion-paused\)[^{]*\{[^}]*\}/g)
      ?.join(" ");
    expect(paused).toMatch(/animation:\s*none/);
    expect(paused).toMatch(/transform:\s*none/);
    expect(paused).toMatch(/opacity:\s*0/);
  });

  it("mirrors the rule's drawing edge in a right-to-left document", () => {
    expect(CSS).toMatch(/html\[dir="rtl"\]\) \.row::before\s*\{\s*transform-origin:\s*right/);
  });
});

describe("the state filter", () => {
  it("does not appear until the register stops fitting in a glance", () => {
    const few = Array.from({ length: FILTER_FROM - 1 }, (_, i) => entry(i));
    const many = Array.from({ length: FILTER_FROM }, (_, i) => entry(i));
    expect(filterEarnsPlace(few.length, statesOf(few))).toBe(false);
    expect(filterEarnsPlace(many.length, statesOf(many))).toBe(true);
    const one = many.map((e) => ({ ...e, state: "Live" }));
    expect(filterEarnsPlace(one.length, statesOf(one))).toBe(false);
  });

  it("counts states in the order the register shows them", () => {
    expect(statesOf([{ state: "In use" }, { state: "Live" }, { state: "In use" }])).toEqual([
      { state: "In use", count: 2 },
      { state: "Live", count: 1 },
    ]);
  });
});
