import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProjectCarousel from "@/components/carousel/ProjectCarousel";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout, no scrolling and no scroll-driven animation, so the
 * three things that make this component what it is — the perspective, the
 * snap and the position indicator — cannot be exercised here and are
 * verified in a browser instead.
 *
 * What is worth asserting in a unit test is the contract everything else
 * rests on, and it is an accessibility contract: that the carousel is a
 * *list* rather than a tablist, that every card is present rather than one
 * being shown at a time, that each card offers exactly one link and that the
 * link is distinguishable from the five beside it, and that the controls are
 * real buttons with names. If any of those stop being true, the argument for
 * driving the whole thing from a scroll container stops being true with it.
 */

const collection = (over: Partial<Collection> = {}): Collection => ({
  slug: "windom",
  title: "WindoM",
  tagline: "Every new tab becomes a dashboard",
  description: "A Chrome extension.",
  coverImage: null,
  links: [],
  order: 10,
  kind: "project",
  repoUrl: null,
  stats: null,
  ...over,
});

const entry = (over: Partial<ProjectEntry> = {}, c: Partial<Collection> = {}): ProjectEntry => ({
  collection: collection(c),
  live: false,
  state: "In use",
  status: "Live on the Chrome Web Store",
  year: "2026",
  tech: ["React 19", "TypeScript", "Vite 8"],
  highlights: [],
  problem: null,
  role: null,
  outcome: null,
  decisions: [],
  primaryLink: null,
  otherLinks: [],
  ...over,
});

const three = [
  entry(),
  entry({ state: "Open source" }, { slug: "bothy", title: "Bothy", tagline: "A console that discovers itself" }),
  entry({ state: "Live" }, { slug: "icaros", title: "Icaros", tagline: "Car marketplace" }),
];

function draw(entries: ProjectEntry[], label = "Selected work") {
  return render(
    <MemoryRouter>
      <ProjectCarousel entries={entries} label={label} heading="h3" firstPlate={2} />
    </MemoryRouter>
  );
}

describe("ProjectCarousel", () => {
  it("is a list of every project, not one visible slide", () => {
    draw(three);

    /* The point of the whole arrangement: nothing is hidden, so a reader who
       never sees the shelf move still gets all three projects in order. */
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "WindoM",
      "Bothy",
      "Icaros",
    ]);
  });

  it("names the scroll region as a carousel and makes it focusable", () => {
    draw(three, "All projects");

    const region = screen.getByRole("group", { name: "All projects" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    /* Without this the region is not reachable by keyboard and its arrow
       keys never fire — which is the whole reason a scroll container can
       stand in for a carousel widget. */
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("gives every card one link, and tells the six of them apart", () => {
    draw(three);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/projects/windom",
      "/projects/bothy",
      "/projects/icaros",
    ]);
    /* All three read "The detail". The accessible name has to carry the
       project or a screen reader's link list is three identical rows. */
    expect(links.map((l) => l.getAttribute("aria-label"))).toEqual([
      "WindoM — the detail",
      "Bothy — the detail",
      "Icaros — the detail",
    ]);
  });

  it("hides the screenshot's own link rather than announcing it twice", () => {
    const { container } = draw([three[0]]);

    /* The picture is clickable for a mouse and absent from the
       accessibility tree, so the card is one destination announced once. */
    const decorative = container.querySelector('a[aria-hidden="true"]');
    expect(decorative).not.toBeNull();
    expect(decorative).toHaveAttribute("tabindex", "-1");
  });

  it("prints two facts without repository stats and three with them", () => {
    const { rerender } = draw([three[0]]);

    /* Addressed through the line rather than through the words: "React 19"
       also appears in the stack `Plate` that stands in for the missing
       screenshot, and the thing under test is what the facts line says. */
    const factsLine = () => screen.getByText("In use").parentElement;
    expect(factsLine()?.textContent).toContain("In use");
    expect(factsLine()?.textContent).toContain("React 19");

    rerender(
      <MemoryRouter>
        <ProjectCarousel
          entries={[
            entry({}, { stats: { stars: 12, language: "TypeScript", license: null, pushedAt: null, latestRelease: null } }),
          ]}
          label="Selected work"
          heading="h3"
          firstPlate={2}
        />
      </MemoryRouter>
    );
    /* The third fact exists only when the repository has something true to
       say about itself; a seed-backed project shows two. */
    expect(factsLine()?.textContent).toContain("12 stars");
  });

  it("advances by asking the scroller to move, not by re-rendering", async () => {
    const user = userEvent.setup();
    const { container } = draw(three);

    /* jsdom implements no scrolling at all, so the call itself is the
       assertion: the component's only job on a click is to hand the browser
       an offset and let it do the scrolling and the snapping. */
    const region = container.querySelector<HTMLElement>('[aria-roledescription="carousel"]');
    const scrollTo = vi.fn();
    if (region) Object.defineProperty(region, "scrollTo", { value: scrollTo, writable: true });

    await user.click(screen.getByRole("button", { name: "Next project in Selected work" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Previous project in Selected work" }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("drops the controls when there is nothing to advance to", () => {
    draw([three[0]]);

    /* A pair of arrows that cannot move and an indicator with one position
       are furniture that exists to say it does not work. */
    expect(screen.queryByRole("button", { name: /Next project/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Previous project/ })).toBeNull();
  });

  it("renders nothing at all when there are no projects", () => {
    const { container } = draw([]);
    expect(container).toBeEmptyDOMElement();
  });
});
