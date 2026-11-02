import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LatestNotes from "@/components/LatestNotes";
import { blog, type PostSummary } from "@/services/blog";

/*
 * jsdom has no layout, no scroll container and no scroll-driven animation, so
 * the pan itself is verified in a browser. Three things can be checked here,
 * and all three are the parts that break without anyone noticing.
 *
 * The markup contract, which the whole device rests on: a list of links, every
 * note present, no ARIA carousel. If that stops being true then the argument
 * for all three fallbacks landing on "the vertical list it already is" stops
 * being true with it.
 *
 * The label, which has to be the schema's three parts and not a hand-rolled
 * row — and in particular the field line, whose order is load-bearing because
 * a travelling card is read cropped.
 *
 * And the three off-switches, asserted against the stylesheet text for the
 * reason the pile's suite gives at length: they are at-rules, jsdom resolves
 * none of them, and the failure they prevent — a shelf welded to a scroll
 * position that will never tick — is invisible to a DOM query.
 */

vi.mock("@/services/blog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/blog")>();
  return { ...actual, blog: { ...actual.blog, posts: vi.fn() } };
});

const posts = vi.mocked(blog.posts);

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/LatestNotes.module.css"),
  "utf8"
);

/* Comments out. This stylesheet explains at length why there is no duration
   and no snap, so a check for either has to be a check on the declarations
   and not on the prose about them. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

const note = (over: Partial<PostSummary> = {}): PostSummary => ({
  slug: "sticky-timelines",
  title: "Why sticky breaks a scroll timeline",
  subtitle: "What a pinned element does to a view timeline",
  excerpt: "A pinned element stops moving relative to the scrollport. Everything after that follows.",
  publishedAt: "2026-03-18T00:00:00.000Z",
  tags: [],
  collection: "site",
  coverImage: null,
  readingMinutes: 6,
  ...over,
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LatestNotes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("the notes shelf", () => {
  it("is a list of links and not a carousel", async () => {
    posts.mockResolvedValue([
      note(),
      note({ slug: "paper", title: "Paper, and what it costs", subtitle: "A ground that is not a gradient" }),
    ]);

    mount();

    const links = await screen.findAllByRole("link", { name: /Why sticky|Paper, and/ });
    expect(links).toHaveLength(2);

    /* Every note in the tab order, in document order, with nothing hidden —
       the opposite of the tabbed-carousel pattern, which would have handed a
       screen reader one note and a set of controls for revealing the rest.
       The track is a list and so is every label's field line, so this asks
       which list the cards are in rather than asserting there is only one. */
    expect(screen.getAllByRole("list")[0]).toContainElement(links[0]);
    expect(document.querySelector("[aria-roledescription]")).toBeNull();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
    expect(document.querySelectorAll("[aria-hidden='true'] a")).toHaveLength(0);
  });

  it("labels each note through the object schema, field line last", async () => {
    posts.mockResolvedValue([note()]);
    mount();

    expect(
      await screen.findByRole("heading", { level: 3, name: "Why sticky breaks a scroll timeline" })
    ).toBeInTheDocument();
    expect(screen.getByText("What a pinned element does to a view timeline")).toBeInTheDocument();

    /* Where it lives, how long it takes, when it landed — in that order,
       because the first field is the one still on screen when the card is
       half past the edge. */
    const fields = screen
      .getAllByRole("listitem")
      .flatMap((li) => Array.from(li.querySelectorAll("li")).map((f) => f.textContent));
    expect(fields).toEqual(["Notes", "6 min", "Mar 2026"]);
  });

  it("falls back to one sentence of the excerpt, never a paragraph", async () => {
    posts.mockResolvedValue([note({ subtitle: null })]);
    mount();

    expect(
      await screen.findByText("A pinned element stops moving relative to the scrollport.")
    ).toBeInTheDocument();
  });

  it("keeps the heading and the way out when the fetch fails", async () => {
    posts.mockRejectedValue(new Error("down"));
    mount();

    /* The index page's answer to a failed fetch used to be one grey sentence
       in a void. `/blog` has shipped its error card as the most-seen state on
       the page before, so the door has to survive the shelf. */
    expect(screen.getByRole("heading", { level: 2, name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All notes/ })).toBeInTheDocument();
    /* Three seconds, because the query keeps one retry of its own — the
       component asks for it, and a test that reconfigured that away would be
       timing a different component. */
    await waitFor(
      () => expect(screen.getByText(/The notes aren't loading just now/)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it("has all three off-switches, and each cancels rather than shortens", () => {
    expect(CSS).toContain("@supports not (animation-timeline: view())");
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
    expect(CSS).toContain(":global(body.motion-paused)");

    /* Three blocks, each choosing the vertical list and each cancelling the
       two animations by name. `animation-name: none` rather than a shorter
       duration: a view timeline ignores duration, so shortening it would
       leave the track welded to the scroll position.

       By name, and not through the property switch the layout uses, because
       CSS Modules cannot rewrite a keyframes name inside a `var()` fallback —
       the first build of this file did exactly that and the shelf never
       moved. A test that only counted the custom properties would have
       passed. */
    expect(CSS.match(/animation-name:\s*none/g)).toHaveLength(3);
    expect(CSS.match(/--shelf-direction:\s*column/g)).toHaveLength(3);
    expect(CSS.match(/--shelf-tilt:\s*0deg/g)).toHaveLength(3);
    expect(CSS).not.toMatch(/animation-name:\s*var\(/);
  });

  it("drives the pan from a named timeline and never from a duration", () => {
    /* `view()` inside the shelf would be measured against the shelf — a box
       that does not scroll vertically — so the name is declared on the static
       section and read from inside it. */
    expect(CSS).toContain("view-timeline-name: --notes-shelf");
    expect(CSS).toContain("animation-timeline: --notes-shelf");
    expect(CSS).not.toMatch(/animation-duration/);
    expect(CSS).not.toMatch(/animation-delay/);

    /* Six ranges, not six delays: a delay is ignored under a progress
       timeline, so a stagger written that way silently does nothing. */
    expect(CSS.match(/animation-range:/g)?.length).toBeGreaterThanOrEqual(7);

    /* No scroll-snap anywhere. A snap area is the transformed border box, so
       snap points on a track the page is translating would move while the
       scroller tried to land on them. */
    expect(CSS).not.toMatch(/scroll-snap/);
  });

  it("shows a skeleton shelf while the notes are on their way", async () => {
    /* Held pending on purpose: a promise that never settles is the only way
       to look at the loading state, and it is the state a reader on a cold
       connection spends the longest in. */
    posts.mockReturnValue(new Promise(() => {}));
    const { container } = mount();

    /* Six placeholders, because the shelf shows six and a skeleton that
       reserves fewer is a shelf that grows a card when the request lands. */
    await waitFor(() =>
      expect(container.querySelectorAll('[data-sk-block="name"]')).toHaveLength(6)
    );

    /* The schema's three parts, in the placeholder as in the label. */
    for (const block of ["name", "fact", "fields"]) {
      expect(container.querySelector(`[data-sk-block="${block}"]`)).not.toBeNull();
    }
  });

  it("announces nothing at all while it is loading", async () => {
    posts.mockReturnValue(new Promise(() => {}));
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-sk-line]")).not.toBeNull());

    /* Every line is under a hidden box: thirty shimmering divs entering the
       accessibility tree and leaving it a second later is noise a reader
       cannot turn down. Asked as "has a hidden ancestor" rather than
       "is inside the first hidden element", because the section head's own
       hairline is `aria-hidden` and comes first in document order — the
       same trap the city's suite documents. */
    for (const line of container.querySelectorAll("[data-sk-line]")) {
      expect(line.closest('[aria-hidden="true"]')).not.toBeNull();
    }

    /* And the scroller's own semantics are withheld until there is
       something in it. A `role="group"` named "Notes shelf" that a reader
       can tab into and find empty is worse than no region at all. */
    expect(screen.queryByRole("group", { name: "Notes shelf" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("switches the skeleton's wrapped lines off wherever the shelf becomes a list", () => {
    /*
     * The fallback card is the full page measure where the shelf's is
     * `clamp(16rem, 76vw, 23rem)`, so the name and the fact each fit on one
     * line in the list and wrap to two on the shelf. Measured at 1440x900:
     * every shelf card is 180.55px and every fallback card 136.70px, and a
     * skeleton drawing the shelf's line counts in the list over-reserved by
     * 263px across the six.
     *
     * It is the seventh thing the three exits switch, and like the other
     * six it is a custom property rather than three copies of a rule —
     * `@supports not`, `@media` and a body class cannot be written as one
     * selector, so the alternative is three chances to be right in two of
     * them.
     */
    expect(CSS.match(/--shelf-ghost-extra:\s*none/g)).toHaveLength(3);
    expect(CSS).toContain("--shelf-ghost-extra: block");
    expect(CSS).toMatch(/display:\s*var\(--shelf-ghost-extra/);

    /* Never the field row. Its three capsules are siblings of one another,
       so `:not(:first-child)` there would delete two thirds of the field
       line rather than a wrapped second row. */
    expect(CSS).not.toMatch(/data-sk-block="fields"\]\s*\[data-sk-line\]:not/);
  });
});
