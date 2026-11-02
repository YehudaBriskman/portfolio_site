import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import ContributionCity from "@/components/city/ContributionCity";
import { contributionYear, type ContributionYear } from "@/services/contributions";

/*
 * jsdom has no layout, no 3D and no scroll-driven animation, so the city
 * itself is verified in a browser and photographed in `docs/`. Three things
 * can be checked here, and all three are the ones that break silently.
 *
 * That the chart has a text equivalent at all, and that it stays attached to
 * the same numbers the scene is drawn from. A `aria-hidden` scene with a
 * caption that has drifted is a chart with no accessible content, and nothing
 * on screen would show it.
 *
 * That an unavailable year draws the empty lattice and says why, rather than
 * drawing nothing or drawing a year of noughts.
 *
 * And the three off-switches, asserted against the stylesheet text for the
 * reason the pile's suite gives at length: every one of them is an at-rule,
 * jsdom resolves none of them, and the failure they exist to prevent — a city
 * welded to a scroll position that will never tick — is invisible to a DOM
 * query.
 */

vi.mock("@/services/contributions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/contributions")>();
  return { ...actual, contributionYear: vi.fn() };
});

const fetchYear = vi.mocked(contributionYear);

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/city/ContributionCity.module.css"),
  "utf8",
);

/* Comments out. This stylesheet argues at length about what it does not do,
   so a check for a declaration has to be a check on the declarations and not
   on the prose beside them. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

function days(counts: number[], start = "2026-01-04") {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return counts.map((count, i) => ({
    date: new Date(t0 + i * 86400000).toISOString().slice(0, 10),
    count,
  }));
}

const YEAR: ContributionYear = {
  from: "2026-01-04",
  to: "2026-01-10",
  total: 21,
  days: days([0, 1, 2, 3, 4, 5, 6]),
  fetchedAt: "2026-11-01T00:00:00.000Z",
  error: null,
};

const UNAVAILABLE: ContributionYear = {
  from: null,
  to: null,
  total: null,
  days: [],
  fetchedAt: "2026-11-01T00:00:00.000Z",
  error: "The contribution year could not be read from GitHub.",
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ContributionCity />
    </QueryClientProvider>,
  );
}

describe("ContributionCity", () => {
  it("draws one cell per real day and invents none", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
  });

  it("keeps the scene out of the accessibility tree and the numbers in it", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();

    await screen.findByText(/21 contributions over 7 days/);
    /* Every cell is inside the hidden scene: 365 unlabelled divs are not a
       chart's accessible content and must not pretend to be. */
    /* Through the frame, because the section head's hairline is aria-hidden
       too and is the first match in document order. */
    const scene = container.querySelector('[data-city] > [aria-hidden="true"]');
    expect(scene).not.toBeNull();
    for (const cell of container.querySelectorAll("[data-step]")) {
      expect(scene?.contains(cell)).toBe(true);
    }
  });

  it("names the window and the busiest day in the caption", async () => {
    fetchYear.mockResolvedValue(YEAR);
    mount();
    /* 10 January is the last day of the fixture and its busiest, at 6. */
    await screen.findByText(/4 January 2026 to 10 January 2026/);
    await screen.findByText(/busiest is 10 January 2026, at 6/);
  });

  it("offers the year as a table, open to anyone rather than hidden from sight", async () => {
    fetchYear.mockResolvedValue(YEAR);
    mount();
    await screen.findByText("The year as a table");
    const row = (await screen.findByRole("rowheader", { name: "January 2026" })).closest("tr");
    expect(row?.textContent).toContain("21");
  });

  it("draws the empty lattice and the server's own sentence when the year is absent", async () => {
    fetchYear.mockResolvedValue(UNAVAILABLE);
    const { container } = mount();

    await screen.findByText("The contribution year could not be read from GitHub.");
    /* 53 weeks of paving, because the empty state is this chart with no data
       in it and not a missing chart. */
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(53 * 7));
    expect(container.querySelectorAll('[data-step]:not([data-step="0"])')).toHaveLength(0);
    /* And the act is switched off from the data side: there is nothing to
       raise, so a camera move over an empty plane would be the chart
       performing the absence of its own data. */
    expect(container.querySelector('[data-city="empty"]')).not.toBeNull();
  });

  it("offers no table when there is no year to tabulate", async () => {
    fetchYear.mockResolvedValue(UNAVAILABLE);
    mount();
    await screen.findByText("The contribution year could not be read from GitHub.");
    expect(screen.queryByText("The year as a table")).toBeNull();
  });

  it("puts no focus stop in the scene", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
    /* The only thing a reader can tab to in this section is the table's own
       control. 365 tab stops is not access to a chart. */
    expect(container.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
    expect(container.querySelectorAll("summary")).toHaveLength(1);
  });
});

describe("the stylesheet's three off-switches", () => {
  /*
   * Each has to cancel the animation outright AND take the storey to zero. The
   * second half is the one that is easy to lose: cancelling the animation
   * flattens the scene's own turn and does nothing to 365 children each
   * carrying a static `translateZ`, which with the perspective still in place
   * would stand them out of the page toward the reader.
   */
  const switches: [string, RegExp][] = [
    ["@supports not (animation-timeline: view())", /@supports not \(animation-timeline: view\(\)\)/],
    ["prefers-reduced-motion", /@media \(prefers-reduced-motion: reduce\)/],
    ["body.motion-paused", /body\.motion-paused/],
  ];

  for (const [name, re] of switches) {
    it(`${name} exists`, () => {
      expect(CSS).toMatch(re);
    });
  }

  it("every block that cancels the animation also flattens the storey", () => {
    const cancels = CSS.split(/\banimation-name:\s*none\b/).length - 1;
    const flattens = CSS.split(/--city-storey:\s*0px/).length - 1;
    /* Four of each: the three switches plus the data-side exit for an
       unavailable year, and the forced-colors block makes five. They are
       counted together rather than parsed into rules because the failure
       being guarded is one of them being added without the other. */
    expect(cancels).toBeGreaterThanOrEqual(3);
    expect(cancels).toBe(flattens);
  });

  it("names its keyframes in a literal animation-name and never through a var()", () => {
    /* CSS Modules scopes `@keyframes` identifiers and rewrites the bare
       `animation-name` declarations it can see. A name written inside `var()`
       survives that rewrite verbatim and then points at a keyframe that no
       longer exists — silently, with the timeline and the range both correct
       and the transform `none` at every point. */
    expect(CSS).toMatch(/animation-name:\s*city-raise/);
    expect(CSS).not.toMatch(/animation-name:\s*var\(/);
  });

  it("has no duration and no delay on a progress-driven animation", () => {
    /* Both are ignored outright under a view timeline — the range is the
       clock — so either one appearing here is a line someone wrote believing
       it did something. */
    expect(CSS).not.toMatch(/animation-duration:/);
    expect(CSS).not.toMatch(/animation-delay:/);
  });

  it("flattens with a scale that is small rather than one that is singular", () => {
    /* `scaleZ(0)` has no inverse, and a singular matrix on a `preserve-3d`
       subtree leaves everything below it undefined rather than flat. */
    expect(CSS).toMatch(/--city-flat:\s*0\.001/);
    expect(CSS).not.toMatch(/scaleZ\(0\)/);
  });

  it("tells a year that is coming apart from one that is not", async () => {
    /*
     * The distinction this section turns on. Both states draw the flat
     * lattice, because that is what this chart looks like with no data in
     * it — but a year still on its way reserves the room the city will
     * stand in and a year that could not be read does not, and the only
     * thing carrying that difference is this attribute.
     */
    fetchYear.mockReturnValue(new Promise(() => {}));
    const { container } = mount();
    await waitFor(() =>
      expect(container.querySelector("[data-city]")?.getAttribute("data-city")).toBe("pending")
    );
    /* The lattice, at its full 53 weeks, in the pending state as in the
       empty one: a skeleton of a chart is the chart with the data taken
       out, not a grey box where the chart goes. */
    expect(container.querySelectorAll("[data-step]")).toHaveLength(53 * 7);
  });

  it("holds the disclosure's place while the year is coming, and promises nothing", async () => {
    /*
     * 36.19px of control plus 36px of margin at 1440x900, measured — the
     * largest of the three things this section grows by when the request
     * lands. Reserved as a line of skeleton rather than as an empty
     * `details`: the rule in the component is that a disclosure opening
     * onto nothing is worse than no control at all, so what stands here is
     * the box with a capsule in it and no control for a reader to find.
     */
    fetchYear.mockReturnValue(new Promise(() => {}));
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-sk-line]")).not.toBeNull());

    expect(screen.queryByText("The year as a table")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    for (const line of container.querySelectorAll("[data-sk-line]")) {
      expect(line.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("says a year could not be read rather than that one is coming", async () => {
    fetchYear.mockResolvedValue(UNAVAILABLE);
    const { container } = mount();
    await screen.findByText(UNAVAILABLE.error as string);
    expect(container.querySelector("[data-city]")?.getAttribute("data-city")).toBe("empty");
    /* And nothing is still waiting: the placeholder for the disclosure goes
       with the pending state, because the table is not coming either. */
    expect(container.querySelector("[data-sk-line]")).toBeNull();
  });

  it("gives up the city's height only when the year is not coming", () => {
    /*
     * The whole of the difference between the two flat states, and the
     * shift it removes: the frame is `clamp(140px, 16vw, 240px)` with a
     * year in it and `auto` without, which at 1440x900 is 230.39px against
     * 121.70px. Reserving it while pending is 108.69px that the arriving
     * city no longer drops on everything below it.
     *
     * So `pending` shares the three act-off declarations and must NOT share
     * `height: auto`. A rule that lumps the two together is the regression
     * this is guarding, and it would look entirely reasonable.
     */
    expect(CSS).toMatch(/\.frame\[data-city="empty"\],\s*\.frame\[data-city="pending"\]/);
    const collapse = CSS.slice(CSS.indexOf('.frame[data-city="empty"] {'));
    expect(collapse.slice(0, collapse.indexOf("}"))).toContain("height: auto");
    expect(CSS).not.toMatch(/\.frame\[data-city="pending"\][^{]*\{[^}]*height:\s*auto/);
  });

  it("stops the waiting band under both off-switches rather than slowing it", () => {
    /* A sweep is motion. Both standing conditions cancel it and remove the
       gradient with it — a stopped sweep that keeps its band is a highlight
       parked on a surface nothing is happening to. */
    const waiting = CSS.slice(CSS.indexOf('.frame[data-city="pending"]::after'));
    for (const guard of ["@media (prefers-reduced-motion: reduce)", "body.motion-paused"]) {
      const at = waiting.indexOf(guard);
      expect(at).toBeGreaterThan(-1);
      const block = waiting.slice(at, at + 260);
      expect(block).toContain("animation: none");
      expect(block).toContain("background-image: none");
    }
  });
});
