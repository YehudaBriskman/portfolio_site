import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Blog from "@/pages/Blog";

/*
 * The Blogs dashboard (#224): its two views, its filters and its states,
 * against a stubbed API. The test setup's `matchMedia` answers "no" to every
 * query, which is a phone; most tests here widen the window to the desk.
 */

const at = (d: string) => `${d}T10:00:00.000Z`;
const post = (slug: string, collection: string, tags: string[], date: string, featured: number | null = null) => ({
  slug,
  title: `Note ${slug}`,
  subtitle: null,
  excerpt: `About ${slug}.`,
  publishedAt: at(date),
  tags,
  collection,
  coverImage: null,
  readingMinutes: 4,
  featured,
});

const POSTS = [
  post("a", "site", ["ci"], "2026-11-01"),
  post("b", "bothy", ["dns"], "2026-10-20", 1),
  post("c", "site", ["ci", "css"], "2026-10-02"),
  post("d", "windom", ["rust"], "2025-06-10"),
  post("e", "bothy", ["dns", "ci"], "2025-05-01"),
];

const area = (slug: string, title: string, noteCount: number) => ({
  slug,
  title,
  tagline: "",
  description: "",
  coverImage: null,
  links: [],
  order: 0,
  kind: slug === "site" ? "site" : "project",
  repoUrl: null,
  stats: null,
  noteCount,
  lastActivityAt: null,
  topics: [],
});
const AREAS = [area("bothy", "Bothy", 2), area("site", "The site", 2), area("windom", "WindoM", 1)];
const EVENTS = [
  { id: "1", kind: "post", at: at("2026-11-01"), area: { slug: "site", title: "The site" }, title: "Note a", href: "/blog/a", meta: {} },
  { id: "2", kind: "release", at: at("2026-10-28"), area: { slug: "bothy", title: "Bothy" }, title: "Bothy v1.9.0", href: "https://github.com/example/bothy/releases/tag/v1.9.0", meta: {} },
];

type Answer = { posts?: unknown; failPosts?: boolean; failActivity?: boolean };

function stub(a: Answer = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (path === "/api/blog/posts") return a.failPosts ? json({}, 503) : json({ items: a.posts ?? POSTS });
      if (path === "/api/blog/collections") return json({ items: [] });
      if (path === "/api/areas") return json({ items: AREAS });
      if (path === "/api/activity") return a.failActivity ? json({}, 503) : json({ items: EVENTS, nextCursor: null });
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
        <Route path="/blog" element={<Blog />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );
}

function windowWide(wide: boolean) {
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ ...real(q), matches: wide && /min-width/.test(q) }));
}

beforeEach(() => {
  document.documentElement.lang = "en";
  windowWide(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.lang = "en";
});

describe("the Blogs dashboard: views", () => {
  it("Home: a greeting, top posts with the featured one first, the tree and the latest", async () => {
    stub();
    renderAt("/blog");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Blogs: Good (morning|afternoon|evening|night)$/);
    await screen.findByRole("tree");
    const top = screen.getByRole("heading", { name: "Top posts" });
    const cards = within(top.closest("section")!).getAllByRole("heading", { level: 3 });
    expect(cards.map((c) => c.textContent)).toEqual(["Note b", "Note a", "Note c"]);
    expect(screen.getByRole("tree", { name: "Browse by area" })).toBeInTheDocument();
    const latest = screen.getByRole("heading", { name: "Latest" }).closest("section")!;
    expect(within(latest).getAllByRole("link", { name: /^Note / }).map((l) => l.getAttribute("href"))).toEqual([
      "/blog/a",
      "/blog/b",
      "/blog/c",
      "/blog/d",
      "/blog/e",
    ]);
    /* Home is the current view, and Feed is one link away with the filters kept. */
    const views = screen.getByRole("navigation", { name: "Views" });
    expect(within(views).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(views).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/blog?view=feed");
  });

  it("Feed: every note newest first, under month headings, and Feed is current", async () => {
    stub();
    renderAt("/blog?view=feed");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Feed");
    await screen.findByRole("heading", { name: "November 2026" });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "November 2026",
      "October 2026",
      "June 2025",
      "May 2025",
    ]);
    expect(screen.getByText("5 notes")).toBeInTheDocument();
    const views = screen.getByRole("navigation", { name: "Views" });
    expect(within(views).getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
  });

  it("ranks the top areas by activity and links each to its area page", async () => {
    stub();
    renderAt("/blog");
    await screen.findByRole("link", { name: /^WindoM/ });
    const list = screen.getByRole("heading", { name: "Top areas" }).closest("section")!;
    const links = within(list).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Bothy2", "/blog/area/bothy"],
      ["The site2", "/blog/area/site"],
      ["WindoM1", "/blog/area/windom"],
    ]);
  });

  it("the timeline links to the channel log, and a release leaves the site", async () => {
    stub();
    renderAt("/blog");
    const card = (await screen.findByRole("heading", { name: "Latest on the site" })).closest("section")!;
    await within(card).findByText("Bothy v1.9.0");
    expect(within(card).getByRole("link", { name: /Bothy v1\.9\.0/ })).toHaveAttribute(
      "href",
      "https://github.com/example/bothy/releases/tag/v1.9.0"
    );
    expect(within(card).getByRole("link", { name: /View full channel log/ })).toHaveAttribute("href", "/blog/log");
  });

  it("opening a branch of the tree puts it in the URL", async () => {
    stub();
    renderAt("/blog");
    const bothy = await screen.findByRole("treeitem", { name: /^Bothy/ });
    bothy.focus();
    fireEvent.keyDown(bothy, { key: "ArrowRight" });
    expect(screen.getByTestId("where")).toHaveTextContent("/blog?open=bothy");
    expect(screen.getByRole("tree").querySelector('a[href="/blog/b"]')).toHaveAttribute("role", "treeitem");
  });
});

describe("the Blogs dashboard: filters", () => {
  it("narrows the feed by topic and year from the URL, as the gallery's links did", async () => {
    stub();
    renderAt("/blog?view=feed&tag=ci&year=2026");
    await screen.findByText("2 of 5 notes");
    const feed = screen.getByRole("heading", { name: "Every note" }).closest("section")!;
    expect(within(feed).getAllByRole("link", { name: /^Note / }).map((l) => l.textContent)).toEqual([
      "Note a",
      "Note c",
    ]);
    /* The gallery's control, with the choices as removable tokens. */
    expect(screen.getByRole("list", { name: "Active filters" })).toHaveTextContent(/Topic\s*ci/);
  });

  it("the old ?collection= links still filter, and show as an Area token", async () => {
    stub();
    renderAt("/blog?view=feed&collection=bothy");
    await screen.findByText("2 of 5 notes");
    expect(screen.getByRole("list", { name: "Active filters" })).toHaveTextContent(/Area\s*Bothy/);
  });

  it("the search box turns #topic and @area into filters on the Feed", async () => {
    stub();
    renderAt("/blog");
    await screen.findByRole("tree");
    const box = screen.getByRole("textbox", { name: "Search the notes" });
    fireEvent.change(box, { target: { value: "note #ci @bothy" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/blog?view=feed&q=note&tag=ci&collection=bothy");
    await screen.findByText("1 of 5 notes");
  });

  it("offers the matching topics while a # word is typed", async () => {
    stub();
    renderAt("/blog");
    await screen.findByRole("tree");
    const box = screen.getByRole("textbox", { name: "Search the notes" });
    fireEvent.change(box, { target: { value: "#c" } });
    const offers = screen.getByRole("list", { name: "Suggestions" });
    expect(within(offers).getAllByRole("button").map((b) => b.textContent)).toEqual(["#ci", "#css"]);
    fireEvent.click(within(offers).getByRole("button", { name: /css/ }));
    expect(box).toHaveValue("#css ");
  });

  it("an empty result says so and offers the way out", async () => {
    stub();
    renderAt("/blog?view=feed&tag=rust&year=2026");
    await screen.findByRole("heading", { name: "No note matches these filters." });
    expect(screen.getByRole("link", { name: "Clear the filters" })).toHaveAttribute("href", "/blog?view=feed");
  });
});

describe("the Blogs dashboard: on a phone", () => {
  it("puts the rail behind a Browse button", async () => {
    vi.restoreAllMocks();
    windowWide(false);
    stub();
    renderAt("/blog");
    await screen.findByRole("tree");
    expect(screen.getByRole("button", { name: /Browse/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Views" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Latest on the site" })).toBeInTheDocument();
  });
});

describe("the Blogs dashboard: states", () => {
  it("a dead notes API is an error with a retry, and the timeline still draws", async () => {
    stub({ failPosts: true });
    renderAt("/blog");
    await screen.findByRole("heading", { name: "The notes couldn’t be loaded." });
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(await screen.findByText("Bothy v1.9.0")).toBeInTheDocument();
  });

  it("a dead activity API costs the timeline only", async () => {
    stub({ failActivity: true });
    renderAt("/blog");
    await screen.findByText("The activity couldn’t be loaded.");
    expect(await screen.findByRole("tree")).toBeInTheDocument();
  });

  it("no notes at all is an empty state, not an empty page", async () => {
    stub({ posts: [] });
    renderAt("/blog");
    await screen.findByRole("heading", { name: "Nothing published yet." });
  });

  it("with three notes or fewer, top posts is not drawn: the notes are said once", async () => {
    stub({ posts: POSTS.slice(0, 2) });
    renderAt("/blog");
    await screen.findByText("That’s every note so far.");
    expect(screen.queryByRole("heading", { name: "Top posts" })).toBeNull();
  });

  it("the chrome speaks Hebrew when the page does", async () => {
    document.documentElement.lang = "he";
    stub();
    renderAt("/blog?view=feed");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("פיד");
    await screen.findByText("5 רשימות");
    expect(screen.getByRole("navigation", { name: "תצוגות" })).toBeInTheDocument();
  });
});
