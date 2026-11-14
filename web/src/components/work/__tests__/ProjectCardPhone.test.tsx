import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Projects from "@/pages/Projects";

/*
 * The phone Projects list is cover-led: each card is ONE link holding a 16:10
 * cover (a deterministic glyph tile when there is none), the name, a status
 * mark that is not colour alone, and at most three stat chips. The rows that
 * stay on the project page (description, forks, updated, tag, notes, the
 * status pill) are not on the phone card.
 */

const at = (d: string) => `${d}T10:00:00.000Z`;
const stats = (extra: Record<string, unknown> = {}) => ({
  stars: 12,
  forks: 3,
  language: "Go",
  license: null,
  pushedAt: at("2026-10-30"),
  latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at("2026-10-28") },
  ...extra,
});
const col = (slug: string, title: string, order: number, cover: string | null) => ({
  slug,
  title,
  tagline: `${title} in one line`,
  description: `${title}, described at length.`,
  coverImage: cover,
  links: [],
  order,
  kind: "project",
  repoUrl: `https://github.com/example/${slug}`,
  stats: stats(),
});
const COLLECTIONS = [col("bothy", "Bothy", 11, "/projects/bothy.jpg"), col("windom", "WindoM", 10, null), col("icaros", "Icaros", 60, null)];

beforeEach(() => {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ ...real(q), matches: /max-width: 639px/.test(q) }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
      if (path === "/api/blog/collections") return json({ items: COLLECTIONS });
      if (path === "/api/blog/posts") return json({ items: [] });
      if (path === "/api/areas") return json({ items: [{ ...COLLECTIONS[0], kind: "project", noteCount: 4, lastActivityAt: null, topics: [] }] });
      if (path === "/api/activity") return json({ items: [], nextCursor: null });
      return json({}, 404);
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function cards() {
  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(document.querySelector("[data-project-card]")).not.toBeNull());
  return Array.from(document.querySelectorAll<HTMLElement>("[data-project-card]"));
}

describe("phone project card", () => {
  it("is one link per card, with no second link inside", async () => {
    const list = await cards();
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const c of list) expect(within(c).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /notes/i })).toBeNull();
  });

  it("leads with a cover: the picture when there is one, a glyph tile when not", async () => {
    const list = await cards();
    const bothy = list.find((c) => c.textContent?.includes("Bothy"))!;
    expect(bothy.querySelector("img")?.getAttribute("src")).toContain("bothy");
    const windom = list.find((c) => c.textContent?.includes("WindoM"))!;
    expect(windom.querySelector("img")).toBeNull();
    expect(windom.querySelector("[data-cover='glyph']")).not.toBeNull();
    for (const c of list) expect(c.querySelector("[data-cover]")).not.toBeNull();
  });

  it("has at most three stat chips and drops the desktop rows", async () => {
    const list = await cards();
    for (const c of list) {
      expect(c.querySelectorAll("[data-stat]").length).toBeLessThanOrEqual(3);
      expect(c.textContent).not.toMatch(/Updated|described at length|in one line/);
      expect(c.textContent).not.toMatch(/forks|פיצולים/);
    }
    const bothy = list.find((c) => c.textContent?.includes("Bothy"))!;
    expect(bothy.textContent).toContain("v1.9.0");
    expect(bothy.textContent).toContain("Go");
  });

  it("says the status with a shape and a spoken word, not a text pill or colour alone", async () => {
    const list = await cards();
    for (const c of list) {
      const mark = c.querySelector("[data-status]")!;
      expect(mark.getAttribute("data-shape")).toBeTruthy();
      expect(mark.querySelector(".sr-only")?.textContent).toBeTruthy();
    }
  });

  it("lets the content direction follow its own script", async () => {
    const list = await cards();
    for (const c of list) expect(c.querySelector("h3")?.getAttribute("dir")).toBe("auto");
  });
});
