import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    /* Through the stage and its held frame, because the section head's
       hairline is aria-hidden too and is the first match in document order. */
    const scene = container.querySelector('[data-city] > div > [aria-hidden="true"]');
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

  it("carries BOTH halves of a dark act, because one without the other is silent", async () => {
    /*
     * The year is the page's second dark act, and the two classes that make
     * one are not interchangeable.
     *
     * `.on-panel` re-points the palette AND restates `color`, which is the
     * half that matters: `color` inherits as a computed value, so redefining
     * `--ink` on a subtree does not re-ink text that already resolved on
     * `<body>`. Without it the act is near-black type on a near-black ground.
     *
     * `data-chrome="dark"` is the hook `nav/useDarkChrome.ts` observes to
     * switch the nav island's material as the section passes under it.
     * Without it the bar stays in its paper material over the dark act.
     *
     * Neither failure throws, and the first one is invisible in jsdom, which
     * is the whole reason this assertion is on the markup.
     */
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));

    const section = container.querySelector("section#year");
    expect(section).not.toBeNull();
    expect(section).toHaveClass("on-panel");
    expect(section).toHaveAttribute("data-chrome", "dark");

    /* And the measure is one level in, not on the section itself. With
       `.on-panel` and `.wrap` on one element the dark ground would be a
       1152px rectangle standing on paper instead of dropping out from under
       the act edge to edge — the argument is in `Work.tsx`. */
    expect(section).not.toHaveClass("wrap");
    expect(section?.querySelector(":scope > .wrap")).not.toBeNull();
  });

  it("puts one focus stop on the year, and none in the scene", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
    /* The frame is the one stop (#190); the arrows rove inside it. 365 tab
       stops is not access to a chart. */
    const stops = container.querySelectorAll("a, button, [tabindex]");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute("tabindex", "0");
    expect(stops[0]).toHaveAttribute("role", "group");
    expect(stops[0].getAttribute("aria-label")).toMatch(/Arrow keys/);
    expect(container.querySelector('[aria-hidden="true"] [tabindex]')).toBeNull();
    expect(container.querySelectorAll("summary")).toHaveLength(1);
  });

  it("reads a day from the keyboard into the tooltip and the status line", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
    const frame = container.querySelector<HTMLElement>("[tabindex]")!;
    const status = screen.getByRole("status");

    /* End is the last day of the fixture, 10 January 2026, at 6. */
    fireEvent.keyDown(frame, { key: "End" });
    expect(frame).toHaveAttribute("data-reading");
    expect(status.textContent).toBe("Sat, 10 Jan 2026 · 6 contributions");
    expect(container.querySelector("[data-hot]")).toHaveAttribute("data-date", "2026-01-10");
    expect(frame.textContent).toContain("Sat, 10 Jan 2026 · 6 contributions");

    /* Up is the day before; Home the first. */
    fireEvent.keyDown(frame, { key: "ArrowUp" });
    expect(container.querySelector("[data-hot]")).toHaveAttribute("data-date", "2026-01-09");
    fireEvent.keyDown(frame, { key: "Home" });
    expect(container.querySelector("[data-hot]")).toHaveAttribute("data-date", "2026-01-04");

    /* Escape puts it away, and leaving the frame does too. */
    fireEvent.keyDown(frame, { key: "Escape" });
    expect(frame).not.toHaveAttribute("data-reading");
    expect(container.querySelector("[data-hot]")).toBeNull();
  });

  it("speaks Hebrew when the document is in Hebrew", async () => {
    document.documentElement.lang = "he";
    try {
      fetchYear.mockResolvedValue(YEAR);
      const { container } = mount();
      await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
      const frame = container.querySelector<HTMLElement>("[tabindex]")!;
      fireEvent.keyDown(frame, { key: "End" });
      expect(screen.getByRole("status").textContent).toMatch(/· 6 תרומות$/);
    } finally {
      document.documentElement.lang = "en";
    }
  });

  it("gives the hand one readout, hidden with the scene it describes", async () => {
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
    /* One readout for 365 columns, never one per column — and outside the
       accessibility tree, because the caption and the table already say all
       of it in text. A hint about dragging is noise to a reader who cannot. */
    const readouts = container.querySelectorAll("[data-hint]");
    expect(readouts).toHaveLength(2);
    const readout = readouts[0].parentElement;
    expect(readout?.closest('[aria-hidden="true"]')).toBe(readout);
    expect(readout?.getAttribute("aria-live")).toBeNull();
    /* Every real cell carries what the readout prints, so it can never
       disagree with the column it lit. */
    for (const cell of container.querySelectorAll("[data-step]")) {
      expect(cell.getAttribute("data-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cell.getAttribute("data-count")).toMatch(/^\d+$/);
    }
  });

  it("offers nothing to read or turn when the year is absent", async () => {
    fetchYear.mockResolvedValue(UNAVAILABLE);
    const { container } = mount();
    await screen.findByText(UNAVAILABLE.error as string);
    expect(container.querySelectorAll("[data-hint]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-date]")).toHaveLength(0);
  });
});

describe("the stylesheet's three off-switches", () => {
  /*
   * Each has to cancel BOTH animations outright, and land somewhere a reader
   * can read. Before #111 that somewhere was the flat lattice, and every
   * switch took the storey to zero with it. Since #111 the motion switches
   * land on the RISEN city instead — the issue asks for exactly that, and a
   * reader who has asked for no motion is owed the finished chart, not its
   * empty first frame (§4: an off-switch lands on the finished state). So the
   * invariant is no longer "cancels implies flattens"; it is that every
   * motion switch writes the risen transform by hand and gives the runway
   * back, and that only the DATA exits (pending, empty) and forced colours
   * flatten.
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

  /**
   * The switch's text, from `opener` to the end of its `.dolly` rule — the
   * last of the four boxes each switch has to touch, in source order.
   */
  function blockAfter(opener: string): string {
    const at = CSS.indexOf(opener);
    expect(at).toBeGreaterThan(-1);
    const dolly = CSS.indexOf(".dolly {", at);
    expect(dolly).toBeGreaterThan(at);
    return CSS.slice(at, CSS.indexOf("}", dolly) + 1);
  }

  for (const [name, opener] of [
    ["@supports not", "@supports not (animation-timeline: view())"],
    ["reduced motion", "@media (prefers-reduced-motion: reduce) {\n  .stage {"],
    ["Pause", ":global(body.motion-paused) .stage {"],
  ] as const) {
    it(`${name} lands on the risen city, still, and gives the runway back`, () => {
      const block = blockAfter(opener);
      /* Both animated boxes cancelled — cancelling one leaves the other
         welded to a clock that may never tick. */
      expect(block.split(/animation-name:\s*none/).length - 1).toBeGreaterThanOrEqual(2);
      /* The finished state, written out: tilted, turned, full height. */
      expect(block).toMatch(/rotateX\(var\(--city-tilt\)\) rotateZ\(var\(--city-turn\)\) scaleZ\(1\)/);
      /* And no held frame over a runway nothing will play on. */
      expect(block).toMatch(/height:\s*auto/);
      expect(block).toMatch(/position:\s*relative/);
      /* Not flattened: that is the data exits' job, not the motion switches'. */
      expect(block).not.toMatch(/--city-storey:\s*0px/);
    });
  }

  it("flattens only where there is no year to stand up, or no colour to read", () => {
    /* The data exits and forced colours: two declarations, no more. A third
       would be a motion switch that has gone back to the empty lattice. */
    expect(CSS.split(/--city-storey:\s*0px/).length - 1).toBe(2);
    expect(CSS).toMatch(
      /\.stage\[data-city="empty"\],\s*\.stage\[data-city="pending"\]\s*\{\s*--city-storey:\s*0px/,
    );
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

  it("carries a second measured ramp for the dark ground it now stands on", () => {
    /*
     * The grid's cells are ink over the ground, so the ramp inverts when the
     * ground does — and two things do not invert with it. The empty day is a
     * literal recess, and the wall composites a fixed overlay over the band.
     * Both are checked here because both fail as a DRAWING rather than as an
     * error: an empty day lighter than its first band reverses the first step
     * of a five-swatch scale, and a wall lighter than its own roof draws lit
     * sides under dark tops.
     */
    expect(CSS).toMatch(/background:\s*rgb\(var\(--canvas-3\)\)/);
    expect(CSS).not.toMatch(/var\(--paper-3\)/);

    /* The wall, on paper: the band with 0.45 of the INK over it. On the dark
       act: the band with 0.45 of the GROUND over it, written as the same
       0.45 read the other way. */
    expect(CSS).toMatch(/--city-shade:\s*calc\(var\(--city-a\) \+ 0\.45/);
    expect(CSS).toMatch(/--city-shade:\s*calc\(var\(--city-a\) \* 0\.55\)/);

    /* Four bands on each ground, and the dark ramp is keyed on the ground
       rather than on an attribute of this component's own. */
    const paper = CSS.match(/^\.cell\[data-step="\d"\] \{ --city-a: [\d.]+; \}$/gm) ?? [];
    const panel = CSS.match(/^:global\(\.on-panel\) \.cell\[data-step="\d"\] \{ --city-a: [\d.]+; \}$/gm) ?? [];
    expect(paper).toHaveLength(4);
    expect(panel).toHaveLength(4);

    /* Monotonic on both, which is what makes a taller column always a busier
       day on either ground. */
    for (const set of [paper, panel]) {
      const alphas = set.map((rule) => Number(rule.match(/--city-a: ([\d.]+)/)![1]));
      expect(alphas).toEqual([...alphas].sort((a, b) => a - b));
    }
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

  it("holds the disclosure's place in a box the dark act will not re-lead", async () => {
    /*
     * The reserved row has to be the height of the control it stands in for,
     * and on this ground the element type decides that.
     *
     * `index.css` carries a leading and tracking compensation for body copy
     * on the dark act — `.on-panel :is(p, li, dd, .body)` at
     * `line-height: 1.68` — at a specificity `.eyebrow` cannot beat. The
     * control here is a `summary`, which is not in that list and keeps the
     * eyebrow's 1.6. So a `p` holding this place is 20.16px where the summary
     * is 19.19px, and the row 37.16px against 36.19px: a 0.97px shift that
     * the whole point of this placeholder is to not have. Measured at
     * 1440x900 in the rendered page.
     *
     * Asserted on the tag rather than on a height, because a height is what
     * this file has no layout to check — and because the fault is silent: the
     * placeholder looks right and is one line box too tall.
     */
    fetchYear.mockReturnValue(new Promise(() => {}));
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-sk-line]")).not.toBeNull());

    const holder = container.querySelector("[data-sk-line]")?.closest(".eyebrow");
    expect(holder).not.toBeNull();
    expect(holder?.tagName).toBe("DIV");
    /* And nothing above it is a `p` either, or the rule applies one level up. */
    expect(container.querySelector('[aria-hidden="true"] p [data-sk-line]')).toBeNull();
  });

  it("gives up the city's height only when the year is not coming", () => {
    /*
     * The whole of the difference between the two flat states, and the
     * shift it removes. Before #111 it was the frame's own height (108.69px
     * at 1440x900); since #111 it is the held frame plus its runway, well
     * over a screen, and dropping that on everything below when the year
     * lands would be a far worse shift than the one this was written for.
     *
     * So `pending` shares the act-off declarations and must NOT share
     * `height: auto`, on the stage or on the frame. A rule that lumps the two
     * together is the regression this is guarding, and it would look
     * entirely reasonable.
     */
    expect(CSS).toMatch(/\.stage\[data-city="empty"\],\s*\.stage\[data-city="pending"\]/);
    const collapse = CSS.slice(CSS.indexOf('.stage[data-city="empty"] {'));
    expect(collapse.slice(0, collapse.indexOf("}"))).toContain("height: auto");
    const frame = CSS.slice(CSS.indexOf('.stage[data-city="empty"] .frame {'));
    expect(frame.slice(0, frame.indexOf("}"))).toContain("height: auto");
    expect(CSS).not.toMatch(/\.stage\[data-city="pending"\][^{,]*\{[^}]*height:\s*auto/);
  });

  it("re-solves the waiting band for the ground, rather than carrying paper's alpha over", () => {
    /*
     * The band is `rgb(var(--ink) / a)`, so `.on-panel` re-points `--ink` and
     * the band darkens the lattice on paper and lightens it on the dark act
     * with no second declaration. The ALPHA does not carry over, and it fails
     * in the direction nobody expects: against `--panel-3` the same 0.05 is a
     * step of dL* 4.77 where on `--paper-3` it is 3.44 — 1.39x too strong, so
     * the placeholder out-shouts the chart it is standing in for rather than
     * disappearing into the dark.
     *
     * 0.035 is the solve, and both metrics agree on it: matching paper's dL*
     * gives 0.0349 and matching paper's WCAG ratio gives 0.0365. This is a
     * number that is right only for this ground, which is exactly the kind
     * that gets silently inherited the next time the ground moves — hence an
     * assertion rather than only a comment.
     */
    const band = CSS.slice(CSS.indexOf('.stage[data-city="pending"] .frame::after'));
    const decl = band.slice(0, band.indexOf("}"));
    expect(decl).toMatch(/rgb\(var\(--ink\) \/ 0\.035\)/);
    expect(decl).not.toMatch(/rgb\(var\(--ink\) \/ 0\.05\)/);
  });

  it("stops the waiting band under both off-switches rather than slowing it", () => {
    /* A sweep is motion. Both standing conditions cancel it and remove the
       gradient with it — a stopped sweep that keeps its band is a highlight
       parked on a surface nothing is happening to. */
    const waiting = CSS.slice(CSS.indexOf('.stage[data-city="pending"] .frame::after'));
    for (const guard of ["@media (prefers-reduced-motion: reduce)", "body.motion-paused"]) {
      const at = waiting.indexOf(guard);
      expect(at).toBeGreaterThan(-1);
      const block = waiting.slice(at, at + 260);
      expect(block).toContain("animation: none");
      expect(block).toContain("background-image: none");
    }
  });

  it("gives the table's summary a chevron and a 44px target, and the skeleton the same box", async () => {
    /* The summary was bare text 19px tall with no glyph: nothing said it
       opens, and it was a thin target on a phone. jsdom has no layout, so the
       size is read from the stylesheet; the skeleton must reserve the same
       box or the row lands as a shift. */
    fetchYear.mockResolvedValue(YEAR);
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll("[data-step]")).toHaveLength(7));
    const summary = container.querySelector("summary");
    expect(summary?.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(summary?.firstElementChild).toHaveAttribute("aria-hidden", "true");

    const rule = CSS.slice(CSS.indexOf(".summary {"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/min-height:\s*2\.75rem/);
    const holder = CSS.slice(CSS.indexOf(".table {"));
    expect(holder.slice(0, holder.indexOf("}"))).toMatch(/min-height:\s*2\.75rem/);
  });

  it("mirrors the chevron in Hebrew and moves it only when motion is allowed", () => {
    expect(CSS).toMatch(/:dir\(rtl\)/);
    const guard = CSS.indexOf("@media (prefers-reduced-motion: no-preference)", CSS.indexOf(".chevron"));
    expect(guard).toBeGreaterThan(-1);
    expect(CSS.slice(guard, guard + 300)).toMatch(/\.chevron[\s\S]*transition/);
    /* No transition on the chevron outside that block. */
    expect(CSS.slice(0, guard)).not.toMatch(/\.chevron[^{]*\{[^}]*transition/);
  });
});
