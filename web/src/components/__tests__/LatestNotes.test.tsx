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

    /* Three blocks, each giving the runway back, un-pinning the frame,
       choosing the vertical list and cancelling the pan by name.
       `animation-name: none` rather than a shorter duration: a view timeline
       ignores duration, so shortening it would leave the track welded to the
       scroll position. */
    expect(CSS.match(/animation-name:\s*none/g)).toHaveLength(3);
    expect(CSS.match(/flex-direction:\s*column/g)?.length).toBeGreaterThanOrEqual(3);
    expect(CSS.match(/position:\s*static/g)).toHaveLength(3);
    expect(CSS.match(/height:\s*auto/g)?.length).toBeGreaterThanOrEqual(6);
    expect(CSS).not.toMatch(/animation-name:\s*var\(/);
  });

  it("pins like the run: a static stage owns the timeline, a sticky frame is held inside it", () => {
    /* The run's mechanism (#57), not a second one. `view()` on anything in
       the held frame would stall the moment it pins, so the name is declared
       on the static stage and read from inside it. */
    expect(CSS).toContain("view-timeline-name: --notes-shelf");
    expect(CSS).toContain("animation-timeline: --notes-shelf");
    expect(CSS).toMatch(/\.frame\s*\{[^}]*position:\s*sticky/);
    expect(CSS).toMatch(/\.frame\s*\{[^}]*overflow:\s*clip/);
    expect(CSS).toContain("animation-range: contain 0% contain 100%");
    expect(CSS).not.toMatch(/animation-duration/);
    expect(CSS).not.toMatch(/animation-delay/);

    /* The document is the one scroll container: no second scroller inside
       the held frame, and nothing to snap. */
    expect(CSS).not.toMatch(/overflow-x:\s*auto/);
    expect(CSS).not.toMatch(/scroll-snap/);
  });

  it("gives every note a marker, a keyboard way past, and no extra list items", async () => {
    posts.mockResolvedValue([
      note(),
      note({ slug: "paper", title: "Paper, and what it costs" }),
    ]);
    const { container } = mount();
    await screen.findAllByRole("link", { name: /Why sticky|Paper, and/ });

    /* One marker per note, hidden and outside the list. */
    const marks = container.querySelectorAll("[data-shelf-mark]");
    expect(marks).toHaveLength(2);
    for (const m of marks) expect(m.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("list", { name: "Latest notes" }).children).toHaveLength(2);

    /* The skip link names its target, and the target exists. */
    const skip = screen.getByRole("link", { name: "Skip past the notes" });
    const id = skip.getAttribute("href")!.slice(1);
    expect(document.getElementById(id)).not.toBeNull();
  });

  it("shows a cover only when the note has one, and never as a second name", async () => {
    posts.mockResolvedValue([
      note({ slug: "with", title: "With a cover", coverImage: "https://example.com/c.jpg" }),
      note({ slug: "without", title: "Without one" }),
    ]);
    const { container } = mount();
    await screen.findByRole("heading", { level: 3, name: "With a cover" });

    const cards = container.querySelectorAll("[data-shelf-i] a");
    expect(cards[0].querySelectorAll("img")).toHaveLength(1);
    expect(cards[0].querySelector("img")!.getAttribute("alt")).toBe("");
    expect(cards[1].querySelectorAll("img")).toHaveLength(0);

    /* The pale washed card is gone: no hue cycle, no paper-card surface. */
    expect(container.querySelector(".card-paper")).toBeNull();
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
    /* A shelf card is 23rem and its name and fact wrap to two lines; the
       list card is 40rem and they do not. Drawn the shelf's way in the list,
       the skeleton over-reserves and the page shrinks when the notes land. */
    expect(CSS.match(/--shelf-ghost-extra:\s*none/g)).toHaveLength(3);
    expect(CSS).toMatch(/display:\s*var\(--shelf-ghost-extra/);
    expect(CSS).not.toMatch(/data-sk-block="fields"\]\s*\[data-sk-line\]:not/);
  });

  /* #179: dark cards on paper, one height, and the card that opens. */

  it("keeps the section on paper and makes each card dark", async () => {
    posts.mockResolvedValue([note(), note({ slug: "paper", title: "Paper, and what it costs" })]);
    const { container } = mount();
    await screen.findByRole("heading", { level: 3, name: "Paper, and what it costs" });

    /* The section is the page's paper: not a dark ground, not an act, and
       nothing in it asks the nav island to invert. */
    const section = container.querySelector("section#notes")!;
    expect(section.classList.contains("on-panel")).toBe(false);
    expect(section.closest('[data-ground="panel"]')).toBeNull();
    expect(container.querySelector("[data-chrome]")).toBeNull();

    /* Each card re-inks itself, and only itself. */
    const cards = container.querySelectorAll("[data-shelf-i] a");
    for (const c of cards) expect(c.classList.contains("on-panel")).toBe(true);
    expect(container.querySelectorAll(".on-panel")).toHaveLength(cards.length);
  });

  it("marks only a card with something to say as one that opens", async () => {
    posts.mockResolvedValue([
      note(),
      note({ slug: "mute", title: "Nothing to add", subtitle: null, excerpt: "" }),
    ]);
    const { container } = mount();
    await screen.findByRole("heading", { level: 3, name: "Nothing to add" });

    const cards = container.querySelectorAll("[data-shelf-i] a");
    expect(cards[0].hasAttribute("data-desc")).toBe(true);
    expect(cards[1].hasAttribute("data-desc")).toBe(false);
    /* The description is in the link whether or not it is showing, so it is
       read with the card rather than only by somebody with a pointer. */
    expect(cards[0].textContent).toContain("What a pinned element does to a view timeline");
  });

  it("gives every slot one height and grows the card inside it", () => {
    /* The slot is rest plus growth for every card; the card is rest plus
       whatever is open. So the row never changes height and the neighbours
       never move when one card opens. */
    expect(CSS).toMatch(/\.slot\s*\{[^}]*height:\s*calc\(var\(--note-rest\) \+ var\(--note-grow\)\)/);
    expect(CSS).toMatch(/\.card\s*\{[^}]*height:\s*calc\(var\(--note-rest\) \+ var\(--note-open\)\)/);
    expect(CSS).toMatch(/@property --note-open/);
  });

  it("opens every card, without moving, where there is no hover or no motion", () => {
    /* Touch, reduced motion and Pause: the description is simply there. */
    expect(CSS).toMatch(/@media not \(\(hover: hover\) and \(pointer: fine\)\)\s*\{\s*\.card\s*\{\s*--note-open:\s*var\(--note-grow\)/);
    const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.card\s*\{\s*--note-open:\s*var\(--note-grow\);\s*transition:\s*none/);
    expect(CSS).toMatch(/:global\(body\.motion-paused\) \.card\s*\{\s*--note-open:\s*var\(--note-grow\);\s*transition:\s*none/);
  });
});
