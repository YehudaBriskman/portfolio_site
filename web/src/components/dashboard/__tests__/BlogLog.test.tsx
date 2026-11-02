import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BlogLog from "@/pages/BlogLog";
import { dayKey, groupByDay, hrefToggledArea, hrefToggledKind, logFeedHref, readLogFilters } from "@/components/dashboard/log";

/*
 * The channel log (#226): filters in the URL, cursor pagination with
 * "Load more", the day headings and rows, and its states, against a stubbed
 * activity API that filters and pages the way the real one does.
 */

type Ev = { id: string; kind: string; at: string; area: { slug: string; title: string } | null; title: string; href: string; meta: object };

const ev = (id: string, kind: string, at: string, area: string | null, href = `/blog/${id}`): Ev => ({
  id,
  kind,
  at,
  area: area ? { slug: area, title: area === "site" ? "The site" : `Area ${area}` } : null,
  title: `Event ${id}`,
  href,
  meta: {},
});

/* 30 events over a fortnight, newest first: more than one page of 25. */
const ALL: Ev[] = Array.from({ length: 30 }, (_, i) => {
  const kind = ["post", "release", "push", "site", "area"][i % 5];
  const day = String(20 - Math.floor(i / 3)).padStart(2, "0");
  const href = kind === "release" || kind === "push" ? `https://github.com/example/r/${i}` : `/blog/e${i}`;
  return ev(`e${i}`, kind, `2026-10-${day}T12:00:00.000Z`, i % 2 ? "windom" : "site", href);
});

const AREAS = ["site", "windom"].map((slug) => ({
  slug,
  title: slug === "site" ? "The site" : "Area windom",
  tagline: "",
  description: "",
  coverImage: null,
  links: [],
  order: 0,
  kind: slug === "site" ? "site" : "project",
  repoUrl: null,
  stats: null,
  noteCount: 1,
  lastActivityAt: "2026-10-20T00:00:00.000Z",
  topics: [],
}));

type Opts = { events?: Ev[]; fail?: boolean; failMore?: boolean };
let calls: URL[] = [];

function stub(o: Opts = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://x");
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.pathname === "/api/areas") return json({ items: AREAS });
      if (url.pathname === "/api/activity") {
        calls.push(url);
        const before = url.searchParams.get("before");
        if (o.fail || (o.failMore && before)) return json({}, 503);
        const kinds = url.searchParams.get("kind")?.split(",");
        const area = url.searchParams.get("area");
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const matching = (o.events ?? ALL).filter((e) => (!kinds || kinds.includes(e.kind)) && (!area || e.area?.slug === area));
        const start = before ? matching.findIndex((e) => e.id === before) + 1 : 0;
        const items = matching.slice(start, start + limit);
        const next = start + limit < matching.length ? items[items.length - 1].id : null;
        return json({ items, nextCursor: next });
      }
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
        <Route path="/blog/log" element={<BlogLog />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId("where").textContent;
const rows = () => screen.queryAllByRole("listitem").filter((li) => li.hasAttribute("data-kind"));

beforeEach(() => {
  document.documentElement.lang = "en";
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ ...real(q), matches: /min-width/.test(q) }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.lang = "en";
});

describe("the channel log: the URL is the filter", () => {
  it("reads kinds and an area, in the API's order, and drops what it does not know", () => {
    const f = readLogFilters(new URLSearchParams("kind=release&kind=post,bogus&area=windom"));
    expect(f).toEqual({ kinds: ["post", "release"], area: "windom" });
    expect(readLogFilters(new URLSearchParams("area=../etc")).area).toBeNull();
    expect(hrefToggledKind(f, "post")).toBe("/blog/log?kind=release&area=windom");
    expect(hrefToggledKind(f, "push")).toBe("/blog/log?kind=post&kind=release&kind=push&area=windom");
    expect(hrefToggledArea(f, "windom")).toBe("/blog/log?kind=post&kind=release");
    expect(hrefToggledArea(f, "site")).toBe("/blog/log?kind=post&kind=release&area=site");
    expect(logFeedHref(f)).toBe("/api/seo/feed/log.xml?kind=post&kind=release&area=windom");
  });

  it("asks the API for what the URL says, from Work's ?kind=release link", async () => {
    stub();
    renderAt("/blog/log?kind=release");
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(calls[0].searchParams.get("kind")).toBe("release");
    expect(rows().every((r) => r.dataset.kind === "release")).toBe(true);
    const link = screen.getByRole("link", { name: /Releases/ });
    expect(link).toHaveAttribute("aria-current", "true");
  });

  it("a filter is a link: choosing one changes the URL and starts the log again", async () => {
    stub();
    renderAt("/blog/log");
    await waitFor(() => expect(rows()).toHaveLength(25));
    fireEvent.click(screen.getByRole("link", { name: "Pushes" }));
    expect(where()).toBe("/blog/log?kind=push");
    await waitFor(() => expect(rows().every((r) => r.dataset.kind === "push")).toBe(true));
    expect(rows()).toHaveLength(6);

    const areaFilter = screen.getByRole("heading", { name: "Area" }).closest("section")!;
    fireEvent.click(within(areaFilter).getByRole("link", { name: "Area windom" }));
    expect(where()).toBe("/blog/log?kind=push&area=windom");
    await waitFor(() => expect(calls.at(-1)!.searchParams.get("area")).toBe("windom"));

    const kinds = screen.getByRole("heading", { name: "Kind" }).closest("section")!;
    fireEvent.click(within(kinds).getByRole("link", { name: "Any kind" }));
    expect(where()).toBe("/blog/log?area=windom");
  });

  it("advertises the feed of exactly what is shown", async () => {
    stub();
    renderAt("/blog/log?kind=release&area=windom");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const alt = document.querySelector('link[rel="alternate"][type="application/rss+xml"]');
    expect(alt).toHaveAttribute("href", "/api/seo/feed/log.xml?kind=release&area=windom");
    expect(screen.getByRole("link", { name: /Channel log · RSS/ })).toHaveAttribute(
      "href",
      "/api/seo/feed/log.xml?kind=release&area=windom",
    );
  });
});

describe("the channel log: pagination", () => {
  it("loads the next page with the cursor, appends it, moves focus to it, and says when it ends", async () => {
    stub();
    renderAt("/blog/log");
    await waitFor(() => expect(rows()).toHaveLength(25));
    expect(screen.getByText("25 events shown")).toHaveAttribute("role", "status");

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(calls.at(-1)!.searchParams.get("before")).toBe("e24");
    expect(document.activeElement).toHaveTextContent("Event e25");
    expect(screen.getByText("30 events shown")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByText("That’s the whole log.")).toBeInTheDocument();
    /* The cursor never reaches the URL. */
    expect(where()).toBe("/blog/log");
  });

  it("keeps the rows it has when the next page fails, and offers to try again", async () => {
    stub({ failMore: true });
    renderAt("/blog/log");
    await waitFor(() => expect(rows()).toHaveLength(25));
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The next events couldn’t be loaded.");
    expect(rows()).toHaveLength(25);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the channel log: days and rows", () => {
  it("puts each day under one heading and gives a row its kind, area, time and link", async () => {
    stub();
    renderAt("/blog/log");
    await waitFor(() => expect(rows()).toHaveLength(25));
    const days = screen.getAllByRole("heading", { level: 2 }).filter((h) => /2026/.test(h.textContent ?? ""));
    expect(days[0]).toHaveTextContent("Tuesday, 20 October 2026");
    const first = within(days[0].closest("section")!).getAllByRole("listitem");
    expect(first).toHaveLength(3);

    const note = rows()[0];
    expect(within(note).getByRole("link", { name: "Event e0" })).toHaveAttribute("href", "/blog/e0");
    expect(note).toHaveTextContent("New note");
    expect(within(note).getByRole("link", { name: "The site" })).toHaveAttribute("href", "/blog/area/site");
    const time = note.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-20T12:00:00.000Z");
    expect(time.getAttribute("title")).toMatch(/20 October 2026/);

    const release = rows()[1];
    const out = within(release).getByRole("link", { name: /Event e1 \(on GitHub\)/ });
    expect(out).toHaveAttribute("href", "https://github.com/example/r/1");
    expect(out).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("groups by the reader's own calendar day", () => {
    expect(dayKey("2026-10-20T23:30:00.000Z", "Asia/Jerusalem")).toBe("2026-10-21");
    expect(dayKey("2026-10-20T23:30:00.000Z", "UTC")).toBe("2026-10-20");
    const days = groupByDay(
      [ev("a", "post", "2026-10-20T23:30:00.000Z", null), ev("b", "post", "2026-10-20T08:00:00.000Z", null)] as never,
      "en",
      "Asia/Jerusalem",
    );
    expect(days.map((d) => d.items.length)).toEqual([1, 1]);
  });
});

describe("the channel log: states", () => {
  it("shows a skeleton while loading", () => {
    stub();
    renderAt("/blog/log");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("an error says so and retries", async () => {
    stub({ fail: true });
    renderAt("/blog/log");
    expect(await screen.findByRole("alert")).toHaveTextContent("The log couldn’t be loaded.");
    stub();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows()).toHaveLength(25));
  });

  it("an empty log, and a filtered log with nothing in it, are different messages", async () => {
    stub({ events: [] });
    const { unmount } = renderAt("/blog/log");
    expect(await screen.findByRole("heading", { name: "Nothing has happened on the site yet." })).toBeInTheDocument();
    unmount();

    stub({ events: [ALL[0]] });
    renderAt("/blog/log?kind=push");
    expect(await screen.findByRole("heading", { name: "No event matches these filters." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear the filters" })).toHaveAttribute("href", "/blog/log");
  });

  it("speaks Hebrew when the page does", async () => {
    document.documentElement.lang = "he";
    stub();
    renderAt("/blog/log");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("יומן הערוץ");
    expect(await screen.findByRole("button", { name: "טעינת עוד" })).toBeInTheDocument();
  });
});
