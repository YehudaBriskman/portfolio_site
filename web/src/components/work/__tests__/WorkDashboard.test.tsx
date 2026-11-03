import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Projects from "@/pages/Projects";
import Project from "@/pages/Project";
import { eventsByArea, hrefSorted, readSort, readTab, sortEntries } from "@/components/work/order";
import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * Work (#227): the dashboard's pinned cards, its sort in the URL, its
 * filters and states, and the project page's tabs — in the URL and on the
 * APG keyboard, mirrored in Hebrew. Against a stubbed API; the setup's
 * `matchMedia` is widened to the desk.
 */

const at = (d: string) => `${d}T10:00:00.000Z`;
const stats = (pushedAt: string, extra: Record<string, unknown> = {}) => ({
  stars: 0,
  forks: 0,
  language: "TypeScript",
  license: null,
  pushedAt: at(pushedAt),
  latestRelease: null,
  ...extra,
});
const col = (slug: string, title: string, order: number, s: ReturnType<typeof stats> | null) => ({
  slug,
  title,
  tagline: `${title} in one line`,
  description: `${title}, described.`,
  coverImage: null,
  links: [],
  order,
  kind: "project",
  repoUrl: s ? `https://github.com/example/${slug}` : null,
  stats: s,
});

const COLLECTIONS = [
  col("bothy", "Bothy", 11, stats("2026-10-30", {
    language: "Go",
    stars: 12,
    forks: 3,
    latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at("2026-10-28") },
  })),
  col("windom", "WindoM", 10, stats("2026-09-01")),
  col("programming-with-yehuda", "Programming with Yehuda", 50, stats("2026-08-01")),
  col("icaros", "Icaros", 51, stats("2026-10-01")),
];

const area = (slug: string, title: string, noteCount: number) => ({
  ...col(slug, title, 0, null),
  kind: slug === "site" ? "site" : "project",
  noteCount,
  lastActivityAt: null,
  topics: [],
});
const AREAS = [area("bothy", "Bothy", 4), area("site", "The site", 9), area("icaros", "Icaros", 0)];

const ev = (id: string, kind: string, slug: string, title: string, day: string, meta: Record<string, unknown> = {}) => ({
  id,
  kind,
  at: at(day),
  area: { slug, title },
  title,
  href: `https://github.com/example/${slug}`,
  meta,
});
const EVENTS = [
  ev("r1", "release", "bothy", "Bothy v1.9.0", "2026-10-28", { tag: "v1.9.0" }),
  ev("p1", "push", "bothy", "Pushed to Bothy", "2026-10-30"),
  ev("p2", "push", "icaros", "Pushed to Icaros", "2026-10-01"),
];

type Answer = { failActivity?: boolean; posts?: unknown[] };
const calls: string[] = [];

function stub(a: Answer = {}) {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const [path, qs = ""] = url.split("?");
      const q = new URLSearchParams(qs);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (path === "/api/blog/collections") return json({ items: COLLECTIONS });
      if (path === "/api/blog/posts") return json({ items: a.posts ?? [] });
      if (path === "/api/areas") return json({ items: AREAS });
      if (path === "/api/activity") {
        if (a.failActivity) return json({}, 503);
        const kinds = (q.get("kind") ?? "").split(",").filter(Boolean);
        const slug = q.get("area");
        return json({
          items: EVENTS.filter((e) => (!kinds.length || kinds.includes(e.kind)) && (!slug || e.area.slug === slug)),
          nextCursor: null,
        });
      }
      return json({}, 404);
    })
  );
}

function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}`}</output>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:project" element={<Project />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );
}

beforeEach(() => {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ ...real(q), matches: /min-width/.test(q) }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});

const names = (section: HTMLElement) =>
  within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
/* The middle column's section by its heading; the rail has a "Pinned" too. */
const sectionOf = (name: string) =>
  screen
    .getAllByRole("heading", { level: 2, name })
    .find((h) => !h.closest("aside"))!
    .closest("section")!;

describe("Work: the dashboard", () => {
  it("pins the curated projects first, as repository cards with their facts", async () => {
    stub();
    renderAt("/projects");
    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    await waitFor(() => expect(within(sectionOf("Pinned")).getByText("v1.9.0")).toBeInTheDocument());
    expect(names(sectionOf("Pinned"))).toEqual(["WindoM", "Bothy"]);

    const bothy = within(sectionOf("Pinned")).getByRole("heading", { name: "Bothy" }).closest("article")!;
    expect(within(bothy).getByRole("link", { name: "Bothy" })).toHaveAttribute("href", "/projects/bothy");
    expect(within(bothy).getByRole("link", { name: "Notes on Bothy" })).toHaveAttribute("href", "/blog/area/bothy");
    expect(within(bothy).getByText("Open source")).toBeInTheDocument();
    expect(within(bothy).getByText("Go")).toBeInTheDocument();
    expect(bothy).toHaveTextContent("12 stars");
    expect(bothy).toHaveTextContent("3 forks");
    expect(within(bothy).getByRole("link", { name: /Latest release: v1\.9\.0/ })).toHaveAttribute(
      "href",
      "https://github.com/example/bothy/releases/tag/v1.9.0"
    );
    expect(within(bothy).getByText(/^Updated /)).toBeInTheDocument();
    /* The strip: this project's pushes and releases from the activity API. */
    const strip = await within(bothy).findByRole("list", { name: "Recent pushes and releases" });
    expect(within(strip).getAllByRole("listitem")).toHaveLength(2);
  });

  it("asks the activity API for pushes and releases, and for releases alone for the aside", async () => {
    stub();
    renderAt("/projects");
    await waitFor(() => expect(calls.some((c) => c.includes("kind=push%2Crelease") || c.includes("kind=push,release"))).toBe(true));
    expect(calls.some((c) => /\/api\/activity\?limit=6&kind=release$/.test(c))).toBe(true);
    const aside = screen.getByRole("complementary", { name: "Latest releases" });
    expect(await within(aside).findByRole("link", { name: /Bothy v1\.9\.0/ })).toBeInTheDocument();
    expect(within(aside).getByRole("link", { name: /View full channel log/ })).toHaveAttribute(
      "href",
      "/blog/log?kind=release"
    );
  });

  it("does not offer a notes link for a project whose area has no notes", async () => {
    stub();
    renderAt("/projects");
    await screen.findAllByText("v1.9.0");
    const change = screen.getByRole("heading", { name: "Programming with Yehuda" }).closest("article")!;
    expect(within(change).queryByRole("link", { name: /^Notes on/ })).toBeNull();
  });

  it("the rail: the filter control, Pinned and the areas with notes", async () => {
    stub();
    renderAt("/projects");
    const rail = screen.getByRole("complementary", { name: "Browse the work" });
    expect(within(rail).getByRole("heading", { name: "Filter" })).toBeInTheDocument();
    const pins = within(rail).getByRole("navigation", { name: "Pinned" });
    expect(within(pins).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/projects/windom",
      "/projects/bothy",
    ]);
    await waitFor(() =>
      expect(within(rail).getByRole("heading", { name: "Areas with notes" }).closest("section")).not.toBeNull()
    );
    const areas = within(rail).getByRole("heading", { name: "Areas with notes" });
    const list = within(areas.closest("section")!).getAllByRole("link");
    /* Project areas with notes only: the site's own shelf and a silent area are not here. */
    expect(list.map((l) => l.getAttribute("href"))).toEqual(["/blog/area/bothy"]);
  });
});

describe("Work: the sort is the URL", () => {
  it("defaults to recently updated, with no parameter", async () => {
    stub();
    renderAt("/projects");
    await screen.findAllByText("v1.9.0");
    const list = sectionOf("Projects");
    expect(within(list).getByRole("link", { name: "Recently updated" })).toHaveAttribute("aria-current", "true");
    expect(names(list).slice(0, 2)).toEqual(["Icaros", "Programming with Yehuda"]);
  });

  it("choosing Name writes ?sort=name, keeps the filters, and re-sorts", async () => {
    stub();
    renderAt("/projects?year=2025");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Icaros" }).closest("article")).toHaveTextContent(/Updated/)
    );
    fireEvent.click(within(sectionOf("Projects")).getByRole("link", { name: "Name" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/projects?year=2025&sort=name");
    const list = sectionOf("Projects");
    expect(within(list).getByRole("link", { name: "Name" })).toHaveAttribute("aria-current", "true");
    const shown = names(list);
    expect(shown).toEqual([...shown].sort((a, b) => a!.localeCompare(b!)));
  });

  it("reads a linked sort, and ignores one it does not know", async () => {
    stub();
    renderAt("/projects?sort=newest");
    await screen.findAllByText("v1.9.0");
    expect(within(sectionOf("Projects")).getByRole("link", { name: "Newest" })).toHaveAttribute("aria-current", "true");
    expect(readSort(new URLSearchParams("sort=stars"))).toBe("updated");
    expect(hrefSorted("?sort=name&state=Live", "updated")).toBe("/projects?state=Live");
  });
});

describe("Work: states", () => {
  it("a filter that matches nothing says so and offers the way back", async () => {
    stub();
    renderAt("/projects?stack=COBOL");
    expect(await screen.findByRole("heading", { name: "No project matches these filters." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show every project" })).toHaveAttribute("href", "/projects");
  });

  it("a dead activity API costs the strips and the aside, not the cards", async () => {
    stub({ failActivity: true });
    renderAt("/projects");
    await screen.findAllByText("v1.9.0");
    const aside = screen.getByRole("complementary", { name: "Latest releases" });
    expect(await within(aside).findByRole("alert")).toHaveTextContent("The activity couldn’t be loaded.");
    expect(names(sectionOf("Pinned"))).toEqual(["WindoM", "Bothy"]);
    expect(screen.queryByRole("list", { name: "Recent pushes and releases" })).toBeNull();
  });

  it("Hebrew: the chrome is translated and the dates go through Intl", async () => {
    document.documentElement.lang = "he";
    stub();
    renderAt("/projects");
    expect(screen.getByRole("heading", { level: 1, name: "פרויקטים" })).toBeInTheDocument();
    await screen.findAllByText("v1.9.0");
    expect(within(sectionOf("פרויקטים")).getByRole("link", { name: "שם" })).toBeInTheDocument();
    expect(screen.getAllByText(/^עודכן לפני/).length).toBeGreaterThan(0);
  });
});

describe("the project page: tabs", () => {
  const POSTS = [
    { slug: "n1", title: "A note on Bothy", subtitle: null, excerpt: "x", publishedAt: at("2026-10-01"), tags: ["dns"], collection: "bothy", coverImage: null, readingMinutes: 3 },
    { slug: "d1", title: "Install guide", subtitle: "From the repo", excerpt: "x", publishedAt: at("2026-09-01"), tags: ["doc"], collection: "bothy", coverImage: null, readingMinutes: 3 },
  ];

  it("Overview is the default and is no parameter; the tab is in the URL", async () => {
    stub({ posts: POSTS });
    renderAt("/projects/bothy");
    const list = await screen.findByRole("tablist", { name: "Project sections" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ""))).toEqual(["Overview", "Notes", "Releases", "Docs"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs[0].id);

    fireEvent.click(tabs[2]);
    expect(screen.getByTestId("where")).toHaveTextContent("/projects/bothy?tab=releases");
    const panel = screen.getByRole("tabpanel", { name: /Releases/ });
    expect(await within(panel).findByText("v1.9.0")).toBeInTheDocument();
  });

  it("opens on the tab a link names: Notes links on to the area, Docs lists the published docs", async () => {
    stub({ posts: POSTS });
    renderAt("/projects/bothy?tab=notes");
    const notes = await screen.findByRole("tabpanel", { name: /Notes/ });
    expect(await within(notes).findByText("A note on Bothy")).toBeInTheDocument();
    expect(within(notes).queryByText("Install guide")).toBeNull();
    expect(within(notes).getByRole("link", { name: /Open the area’s full history/ })).toHaveAttribute(
      "href",
      "/blog/area/bothy"
    );

    fireEvent.click(screen.getByRole("tab", { name: /Docs/ }));
    const docs = screen.getByRole("tabpanel", { name: /Docs/ });
    expect(within(docs).getByRole("link", { name: /Install guide/ })).toHaveAttribute("href", "/blog/d1");
  });

  it("the keyboard: one tab stop, arrows move and select, Home and End, wrapping", async () => {
    stub({ posts: POSTS });
    renderAt("/projects/bothy");
    const tabs = within(await screen.findByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("where")).toHaveTextContent("/projects/bothy?tab=notes");

    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(document.activeElement).toBe(tabs[3]);
    expect(screen.getByTestId("where")).toHaveTextContent("?tab=docs");

    fireEvent.keyDown(tabs[3], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    expect(screen.getByTestId("where")).toHaveTextContent(/\/projects\/bothy$/);

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[3]);

    fireEvent.keyDown(tabs[3], { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("in Hebrew the arrows are mirrored with the row", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    stub({ posts: POSTS });
    renderAt("/projects/bothy");
    const tabs = within(await screen.findByRole("tablist")).getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByTestId("where")).toHaveTextContent("?tab=notes");
    fireEvent.keyDown(tabs[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("stands on the dashboard: a GitHub-style header, the pinned rail and an About aside with as-of facts", async () => {
    stub({ posts: POSTS });
    renderAt("/projects/bothy");
    const h1 = await screen.findByRole("heading", { level: 1, name: "Bothy" });
    const header = h1.closest("header")!;
    expect(within(header).getByRole("link", { name: "Work" })).toHaveAttribute("href", "/projects");
    expect(within(header).getByRole("link", { name: /Source/ })).toHaveAttribute("href", "https://github.com/example/bothy");
    expect(within(header).getByRole("link", { name: /v1\.9\.0/ })).toHaveAttribute(
      "href",
      "https://github.com/example/bothy/releases/tag/v1.9.0"
    );

    const rail = screen.getByRole("complementary", { name: "Browse the work" });
    expect(within(rail).getByRole("link", { name: /Bothy/ })).toHaveAttribute("aria-current", "page");
    expect(within(rail).getByRole("link", { name: /WindoM/ })).not.toHaveAttribute("aria-current");

    const about = screen.getByRole("complementary", { name: "About" });
    expect(within(about).getByText("Go")).toBeInTheDocument();
    expect(within(about).getByText("12")).toBeInTheDocument();
    /* The release is the header's button and is not said again here. */
    expect(within(about).queryByText("v1.9.0")).toBeNull();
    expect(await within(about).findByRole("link", { name: /Notes in this area/ })).toHaveAttribute("href", "/blog/area/bothy");
  });

  it("a slug that is not a project says so, with the way back, under one h1", async () => {
    stub();
    renderAt("/projects/nothing-here");
    expect(await screen.findByRole("heading", { level: 1, name: "Not here" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See everything" })).toHaveAttribute("href", "/projects");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("an unknown tab in a link falls back to Overview", () => {
    expect(readTab(new URLSearchParams("tab=wiki"))).toBe("overview");
  });
});

describe("Work: the order", () => {
  const entry = (slug: string, title: string, order: number, pushedAt: string | null, year: string | null = null) =>
    ({
      collection: { ...col(slug, title, order, pushedAt ? stats(pushedAt) : null) },
      year,
      tech: [],
      state: "Live",
    }) as unknown as ProjectEntry;

  it("recently updated puts the undated last, in the curated order", () => {
    const list = [entry("a", "Alpha", 60, null), entry("b", "Beta", 55, null), entry("c", "Gamma", 70, "2026-01-01")];
    expect(sortEntries(list, "updated").map((e) => e.collection.slug)).toEqual(["c", "b", "a"]);
  });

  it("newest is by year, then by the last push", () => {
    const list = [entry("a", "Alpha", 60, "2026-05-01", "2024"), entry("b", "Beta", 55, "2025-01-01", "2026")];
    expect(sortEntries(list, "newest").map((e) => e.collection.slug)).toEqual(["b", "a"]);
  });

  it("groups the feed's pushes and releases by area, newest first, and drops the rest", () => {
    const grouped = eventsByArea([
      ...(EVENTS as Parameters<typeof eventsByArea>[0]),
      { id: "n", kind: "post", at: at("2026-11-01"), area: { slug: "bothy", title: "Bothy" }, title: "x", href: "/blog/x", meta: {} },
    ]);
    expect(grouped.get("bothy")!.map((e) => e.id)).toEqual(["p1", "r1"]);
    expect(grouped.get("icaros")!.map((e) => e.id)).toEqual(["p2"]);
  });
});
