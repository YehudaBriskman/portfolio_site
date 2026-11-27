import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Project from "@/pages/Project";

/*
 * The project page's header on a phone (plan W4, issue #801): an image-led
 * card, fewer data points, one floating action. Phone is the `max-width`
 * query matching; above it the page keeps its desktop markup (the compare-wide
 * script holds the pixels). Layout is the browser script's; this holds the
 * structure and the words.
 */

const REPO = "https://github.com/example/bothy";
const STORE = "https://chromewebstore.google.com/detail/x";
const col = (slug: string, title: string, over: Record<string, unknown> = {}) => ({
  slug,
  title,
  tagline: `${title} in one line`,
  description: `${title}, described.`,
  coverImage: null,
  links: [],
  order: 5,
  kind: "project",
  repoUrl: REPO,
  stats: {
    stars: 12,
    forks: 3,
    language: "TypeScript",
    license: null,
    pushedAt: "2026-10-30T10:00:00.000Z",
    latestRelease: { tag: "v1.9.0", url: `${REPO}/releases/tag/v1.9.0`, publishedAt: "2026-10-28T10:00:00.000Z" },
  },
  ...over,
});

let collections: ReturnType<typeof col>[] = [];

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (path === "/api/blog/collections") return json({ items: collections });
      if (path === "/api/blog/posts") return json({ items: [] });
      if (path === "/api/areas") return json({ items: [] });
      if (path === "/api/activity") return json({ items: [], nextCursor: null });
      return json({}, 404);
    }),
  );
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/projects/:project" element={<Project />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function media(phone: boolean) {
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({
    ...real(q),
    matches: /max-width/.test(q) ? phone : /min-width/.test(q) ? !phone : false,
  }));
}

beforeEach(() => {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  collections = [col("bothy", "Bothy", { coverImage: "/img/bothy-cover.jpg" }), col("windom", "WindoM")];
  stub();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const header = async () =>
  waitFor(() => {
    const el = document.querySelector<HTMLElement>('[data-phone-card="header"]');
    expect(el).toBeTruthy();
    return el!;
  });

const dockOf = async () =>
  waitFor(() => {
    const el = document.querySelector<HTMLElement>("[data-phone-pinned]");
    expect(el).toBeTruthy();
    return el!;
  });

describe("the phone header", () => {
  it("lays the cover under the card, hidden from a screen reader", async () => {
    media(true);
    collections = [col("bothy", "Bothy", { coverImage: "/img/bothy-cover.jpg" })];
    renderAt("/projects/bothy");
    const h = await header();
    const cover = h.querySelector<HTMLElement>('[data-phone="head-cover"]');
    expect(cover).toBeTruthy();
    expect(cover!.hasAttribute("data-fallback")).toBe(false);
    expect(cover!.getAttribute("aria-hidden")).toBe("true");
    const img = cover!.querySelector("img");
    expect(img?.getAttribute("src")).toContain("bothy-cover");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("falls back to a tint, never to nothing, when there is no cover", async () => {
    media(true);
    renderAt("/projects/windom");
    const h = await header();
    const cover = h.querySelector<HTMLElement>('[data-phone="head-cover"]');
    expect(cover).toBeTruthy();
    expect(cover!.hasAttribute("data-fallback")).toBe(true);
    expect(cover!.querySelector("img")).toBeNull();
  });

  it("has the title and one tagline, and no crumb, no wave, no figure caption", async () => {
    media(true);
    renderAt("/projects/bothy");
    const h = await header();
    expect(within(h).getByRole("heading", { level: 1 }).textContent).toBe("Bothy");
    // The way back is the circle nav's chip, not a "Work /" crumb in the card.
    expect(within(h).queryByRole("link", { name: "Work" })).toBeNull();
    expect(h.querySelector('[class*="strand" i]')).toBeNull();
    // The tagline is said once on the whole page, and there is no "Fig. 01".
    expect(screen.getAllByText("Bothy in one line")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/fig\.?\s*0?1/i);
  });

  it("marks the title and tagline dir=auto: they are somebody's text", async () => {
    media(true);
    renderAt("/projects/bothy");
    const h = await header();
    expect(within(h).getByRole("heading", { level: 1 }).getAttribute("dir")).toBe("auto");
    expect(within(h).getByText("Bothy in one line").getAttribute("dir")).toBe("auto");
  });

  it("shows each stat as a glyph and a number; the word is for screen readers only", async () => {
    media(true);
    renderAt("/projects/bothy");
    const h = await header();
    const tiles = [...h.querySelectorAll<HTMLElement>('[data-phone="stat-tile"]')];
    // three chips at most (two rows on a 360 phone): language, stars, version. Forks live in Details.
    expect(tiles).toHaveLength(3);
    for (const t of tiles) expect(t.querySelector("svg")).toBeTruthy();
    const texts = tiles.map((t) => t.textContent ?? "");
    for (const want of ["TypeScript", "12", "v1.9.0"]) expect(texts.some((x) => x.includes(want))).toBe(true);
    expect(texts.some((x) => x.includes("Forks"))).toBe(false);
    const stars = tiles.find((t) => (t.textContent ?? "").includes("12"))!;
    expect(within(stars).getByText("Stars").className).toMatch(/sr/);
  });

  it("holds the secondary links and the stack behind ONE closed Details disclosure", async () => {
    media(true);
    collections = [col("bothy", "Bothy", { links: [{ label: "Chrome Web Store", url: STORE }] })];
    renderAt("/projects/bothy");
    const h = await header();
    const details = h.querySelectorAll("details");
    expect(details).toHaveLength(1);
    expect(details[0].open).toBe(false);
    expect(details[0].querySelector("summary")?.textContent).toBe("Details");
    // the repository is secondary here (the store is the primary) and the stack is inside
    expect(details[0].querySelector(`a[href="${REPO}"]`)).toBeTruthy();
    expect(details[0].textContent).toMatch(/React 19/);
    // the primary is the pinned dock's, not the card's
    expect(h.querySelector(`a[href="${STORE}"]`)).toBeNull();
  });

  it("pins the primary in a Dock pill: the store link when there is one, the source when not", async () => {
    media(true);
    collections = [col("bothy", "Bothy", { links: [{ label: "Chrome Web Store", url: STORE }] }), col("windom", "WindoM")];
    const first = renderAt("/projects/bothy");
    const dock = await dockOf();
    expect(dock.getAttribute("role")).toBe("group");
    expect(within(dock).getByRole("link").getAttribute("href")).toBe(STORE);
    expect(document.querySelectorAll("[data-phone-pinned]")).toHaveLength(1);
    first.unmount();
    renderAt("/projects/windom");
    const dock2 = await dockOf();
    expect(within(dock2).getByRole("link").getAttribute("href")).toBe(REPO);
    expect(within(dock2).getByRole("link").textContent).toMatch(/Source/);
  });

  it("keeps the tabs: Notes still selects", async () => {
    media(true);
    renderAt("/projects/bothy");
    await header();
    fireEvent.click(await screen.findByRole("tab", { name: /Notes/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /Notes/ }).getAttribute("aria-selected")).toBe("true"));
  });
});

describe("above the phone breakpoint", () => {
  it("keeps the desktop header: the crumb, the Figure caption and no Details disclosure", async () => {
    media(false);
    renderAt("/projects/bothy");
    const h = await header();
    expect(within(h).getByRole("link", { name: "Work" })).toBeTruthy();
    expect(h.querySelector('[data-phone="head-cover"]')).toBeNull();
    expect(h.querySelector("details")).toBeNull();
    expect(document.body.textContent).toMatch(/fig\.?\s*0?1/i);
  });
});

describe("second polish pass", () => {
  const withCover = () => {
    collections = [col("bothy", "Bothy", { coverImage: "/img/bothy-cover.jpg" }), col("windom", "WindoM")];
  };
  const aboutOf = () =>
    waitFor(() => {
      const el = document.querySelector<HTMLElement>('aside [data-phone="about"]');
      expect(el).toBeTruthy();
      return el!;
    });

  it("puts the title and the tile after the cover in the flow, never on it", async () => {
    media(true);
    withCover();
    renderAt("/projects/bothy");
    const h = await header();
    const cover = h.querySelector('[data-phone="head-cover"]')!;
    const top = h.querySelector('[class*="phoneTop"]')!;
    expect(cover.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cover.contains(top)).toBe(false);
  });

  it("shows the cover once: the Overview has no second picture of it", async () => {
    media(true);
    withCover();
    renderAt("/projects/bothy");
    await header();
    expect(document.querySelectorAll('img[src*="bothy-cover"]')).toHaveLength(1);
    expect(document.querySelector('img[alt$="screenshot"]')).toBeNull();
  });

  it("writes the Overview description in plain ink, direction from its own text", async () => {
    media(true);
    renderAt("/projects/windom");
    const p = await screen.findByText("WindoM, described.");
    expect(p.closest("p")?.getAttribute("dir")).toBe("auto");
    expect(p.closest("p")?.querySelector("[data-word]")).toBeNull();
  });

  it("ends no Elsewhere row on a separator: the parts stack, they are not joined", async () => {
    media(true);
    renderAt("/projects/windom");
    await header();
    const sect = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("#elsewhere-heading")?.closest("section");
      expect(el).toBeTruthy();
      return el!;
    });
    const metas = sect.querySelectorAll("[data-stack]");
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) for (const part of m.children) expect((part.textContent ?? "").trim()).not.toBe("");
  });

  it("About: label/value rows, header and Details data not repeated, links as rows", async () => {
    media(true);
    collections = [
      col("bothy", "Bothy"),
      col("windom", "WindoM", { stats: { stars: 12, forks: 3, language: "TypeScript", license: "MIT", fetchedAt: "2026-11-15T00:33:00.000Z", pushedAt: "2026-10-30T10:00:00.000Z", latestRelease: null } }),
    ];
    renderAt("/projects/windom");
    await header();
    const about = await aboutOf();
    expect([...about.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Last push", "Licence"]);
    for (const dd of about.querySelectorAll("dd")) expect(dd.parentElement?.tagName).toBe("DIV");
    expect(within(about).queryByText(/Language|Stars|Forks/)).toBeNull();
    expect(about.querySelector('dd [dir="ltr"]')?.textContent).toBe("MIT");
    const stamp = about.querySelector("[data-phone='about-stamp']");
    expect(stamp?.textContent).toMatch(/^as of /i);
    expect(stamp?.textContent).not.toMatch(/ at /);
    expect(about.querySelector(`a[href="${REPO}"][data-phone-row]`)).toBeTruthy();
  });

  it("About: an unset value keeps its dash and is named 'Not available'", async () => {
    media(true);
    collections = [col("bothy", "Bothy")]; // licence is null
    renderAt("/projects/bothy");
    await header();
    const about = await aboutOf();
    const dash = within(about).getByText("—");
    expect(dash).toHaveAttribute("role", "img");
    expect(dash).toHaveAttribute("aria-label", "Not available");
  });

  it("About says the repository once: not when Details already holds it", async () => {
    media(true);
    collections = [col("bothy", "Bothy", { links: [{ label: "Chrome Web Store", url: STORE }] })];
    renderAt("/projects/bothy");
    await header();
    const about = await aboutOf();
    expect(about.querySelector(`a[href="${REPO}"]`)).toBeNull();
    expect(document.querySelectorAll(`a[href="${REPO}"]`).length).toBe(1);
  });

  it("puts Forks in Details, once", async () => {
    media(true);
    renderAt("/projects/bothy");
    const h = await header();
    expect(within(h.querySelector("details") as HTMLElement).getByText("Forks")).toBeTruthy();
    expect(screen.getAllByText("Forks")).toHaveLength(1);
  });
});

describe("the figure's drift, wide", () => {
  afterEach(() => document.body.classList.remove("motion-paused"));
  const drifting = () => document.querySelector('[style*="--vh"]');

  it("drifts with the scroll, and stays put under the site's Pause", async () => {
    media(false);
    renderAt("/projects/bothy");
    await waitFor(() => expect(drifting()).toBeTruthy());
    document.body.classList.add("motion-paused");
    await waitFor(() => expect(drifting()).toBeNull());
  });
});
