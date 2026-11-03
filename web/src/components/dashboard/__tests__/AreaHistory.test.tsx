import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BlogArea from "@/pages/BlogArea";
import { noteId } from "@/components/dashboard/history";

/*
 * An area's history (#225) against a stubbed API: day groups, the short ids,
 * the repo facts with their time, the side card, the topic filter in the
 * URL, the share fallback, and j/k.
 */

const at = (d: string, h = 12) => `${d}T${String(h).padStart(2, "0")}:00:00.000Z`;
const post = (slug: string, tags: string[], publishedAt: string, updatedAt: string | null = null) => ({
  slug,
  title: `Note ${slug}`,
  subtitle: null,
  excerpt: `First line of ${slug}.\nSecond line.`,
  publishedAt,
  updatedAt,
  tags,
  collection: "bothy",
  coverImage: null,
  readingMinutes: 4,
  featured: null,
});

const POSTS = [
  post("a", ["dns"], at("2026-11-02", 9), at("2026-11-03")),
  post("b", ["dns", "ci"], at("2026-11-02", 15)),
  post("c", ["ci"], at("2026-10-20")),
];

const BOTHY = {
  slug: "bothy",
  title: "Bothy",
  tagline: "The box's portal.",
  description: "",
  coverImage: null,
  links: [],
  order: 1,
  kind: "project",
  repoUrl: "https://github.com/example/bothy",
  docs: [{ path: "docs/README.md", url: "https://github.com/example/bothy/blob/main/docs/README.md" }],
  stats: {
    stars: 12,
    forks: 3,
    language: "TypeScript",
    license: "MIT",
    pushedAt: at("2026-11-01"),
    latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at("2026-10-28") },
    fetchedAt: at("2026-11-02", 10),
  },
  noteCount: 3,
  lastActivityAt: null,
  topics: [],
};

function stub(opts: { posts?: unknown; fail?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (path === "/api/blog/posts") return opts.fail ? json({}, 503) : json({ items: opts.posts ?? POSTS });
      if (path === "/api/areas") return json({ items: [BOTHY] });
      return json({}, 404);
    }),
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
        <Route path="/blog/area/:slug" element={<BlogArea />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.documentElement.lang = "en";
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ ...real(q), matches: /min-width/.test(q) }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("an area's history", () => {
  it("groups notes by day like commits, each with its short id and its first excerpt line", async () => {
    stub();
    renderAt("/blog/area/bothy");
    await screen.findByText("Note a");
    const days = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(days).toEqual(["Notes on 2 Nov 2026", "Notes on 20 Oct 2026"]);
    const first = screen.getByText("Notes on 2 Nov 2026").closest("section")!;
    expect(within(first).getAllByRole("link", { name: /^Note / }).map((l) => l.textContent)).toEqual(["Note b", "Note a"]);
    expect(screen.getByText(noteId("a"))).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("First line of a.")).toBeInTheDocument();
    expect(screen.queryByText(/Second line/)).toBeNull();
  });

  it("marks only the note saved after publishing as updated", async () => {
    stub();
    renderAt("/blog/area/bothy");
    const rowA = (await screen.findByText("Note a")).closest("li")!;
    expect(within(rowA).getByText("Updated")).toBeInTheDocument();
    const rowB = screen.getByText("Note b").closest("li")!;
    expect(within(rowB).queryByText("Updated")).toBeNull();
  });

  it("shows the repo facts from the stored stats, with the time they were read", async () => {
    stub();
    renderAt("/blog/area/bothy");
    const stars = (await screen.findByText("Stars")).closest("div")!;
    expect(stars).toHaveTextContent("12");
    expect(stars.getAttribute("title")).toMatch(/as of 2 November 2026/);
    expect(screen.getByText(/^Repository facts as of 2 November 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v1.9.0" })).toHaveAttribute("href", BOTHY.stats.latestRelease.url);
  });

  it("offers the project, the repo, the area's feed and its docs", async () => {
    stub();
    renderAt("/blog/area/bothy");
    const side = await screen.findByRole("complementary", { name: "About this area" });
    expect(within(side).getByRole("link", { name: "Go to the project" })).toHaveAttribute("href", "/projects/bothy");
    expect(within(side).getByRole("link", { name: /View the repository/ })).toHaveAttribute("href", BOTHY.repoUrl);
    expect(within(side).getByRole("link", { name: "RSS for this area" })).toHaveAttribute("href", "/api/seo/feed/bothy.xml");
    expect(within(side).getByRole("link", { name: "docs/README.md" })).toHaveAttribute("href", BOTHY.docs[0].url);
  });

  it("filters by topic through the URL, and the legend toggles it off again", async () => {
    stub();
    renderAt("/blog/area/bothy?topic=ci");
    await screen.findByText("Note b");
    expect(screen.queryByText("Note a")).toBeNull();
    expect(screen.getByRole("heading", { name: "2 of 3 notes" })).toBeInTheDocument();
    const side = screen.getByRole("complementary", { name: "About this area" });
    const ci = await within(side).findByRole("link", { name: /^ci/ });
    expect(ci).toHaveAttribute("aria-current", "true");
    fireEvent.click(ci);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/blog\/area\/bothy$/));
    expect(await screen.findByText("Note a")).toBeInTheDocument();
  });

  it("shares through the fallback when there is no Web Share", async () => {
    stub();
    renderAt("/blog/area/bothy");
    const share = await screen.findByRole("button", { name: "Share \"Note a\"" });
    fireEvent.click(share);
    await waitFor(() => expect(share).toHaveAttribute("aria-expanded", "true"));
    const menu = document.getElementById(share.getAttribute("aria-controls")!)!;
    expect(within(menu).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /LinkedIn/ }).getAttribute("href")).toContain(
      encodeURIComponent(`${window.location.origin}/blog/a`),
    );
    expect(within(menu).getByRole("link", { name: /^X/ }).getAttribute("href")).toMatch(/^https:\/\/x\.com\/intent\/post\?/);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(share).toHaveAttribute("aria-expanded", "false"));
    expect(share).toHaveFocus();
  });

  it("moves through the notes with j and k without trapping focus", async () => {
    stub();
    renderAt("/blog/area/bothy");
    await screen.findByText("Note a");
    /* Wait for the whole list, not its first row: j/k walk the rendered
       order, and pressing before every note is in made the target race. */
    await screen.findByText("Note b");
    await screen.findByText("Note c");
    const title = (name: string) => screen.getByRole("link", { name });
    fireEvent.keyDown(document.body, { key: "j" });
    expect(title("Note b")).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "j" });
    expect(title("Note a")).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "j" });
    fireEvent.keyDown(document.activeElement!, { key: "j" });
    expect(title("Note c")).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "k" });
    expect(title("Note a")).toHaveFocus();
    /* Enter is the link's own: it is a real link to the note. */
    expect(title("Note a")).toHaveAttribute("href", "/blog/a");
    /* Typing in a field is left alone. */
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(input, { key: "j" });
    expect(input).toHaveFocus();
    input.remove();
  });

  it("says when the notes could not be loaded, and retries", async () => {
    stub({ fail: true });
    renderAt("/blog/area/bothy");
    expect(await screen.findByRole("alert")).toHaveTextContent("The notes couldn’t be loaded.");
    stub();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Note a")).toBeInTheDocument();
  });

  it("an empty area offers its feed; an unknown one says so", async () => {
    stub({ posts: [] });
    const { unmount } = renderAt("/blog/area/bothy");
    expect(await screen.findByRole("heading", { name: "No notes in this area yet." })).toBeInTheDocument();
    unmount();
    renderAt("/blog/area/nowhere");
    expect(await screen.findByRole("heading", { name: "There is no area by that name." })).toBeInTheDocument();
  });

  it("is in Hebrew when the page is", async () => {
    document.documentElement.lang = "he";
    stub();
    renderAt("/blog/area/bothy");
    expect(await screen.findByRole("link", { name: "לפרויקט" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })[0].textContent).toMatch(/^רשימות מ־/);
    document.documentElement.lang = "en";
  });
});
