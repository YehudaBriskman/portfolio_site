import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Story from "@/pages/Story";
import { buildStory } from "@/data/story";

/*
 * The page in jsdom, which cannot see layout: so this asserts the structure
 * and the rail's bookkeeping, and the look is held by the screenshots in
 * `docs/story/` instead.
 *
 * The rail is driven by one IntersectionObserver. jsdom has none, and the
 * global stub in `setupTests.ts` never calls back, so this installs one that
 * hands the test its callback and lets it say "this chapter is now in the
 * band" — which is the only question the rail ever asks.
 */

type Fire = (target: Element, isIntersecting?: boolean) => void;
let fire: Fire = () => {};
const original = globalThis.IntersectionObserver;

beforeEach(() => {
  const observers: { cb: IntersectionObserverCallback; margin?: string }[] = [];
  class Controlled {
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      observers.push({ cb, margin: opts?.rootMargin });
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver = Controlled as unknown as typeof IntersectionObserver;
  fire = (target, isIntersecting = true) => {
    /* The rail's band is the only observer with a -48% margin. */
    const rail = observers.find((o) => o.margin?.startsWith("-48%"));
    act(() => {
      rail?.cb([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  };
});

afterEach(() => {
  globalThis.IntersectionObserver = original;
});

function renderStory() {
  return render(
    <MemoryRouter initialEntries={["/story"]}>
      <Story />
    </MemoryRouter>
  );
}

describe("Story", () => {
  it("is one h1 and a chapter heading per chapter, in order", () => {
    renderStory();
    const story = buildStory();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([...story.chapters.map((c) => c.title), "The walk so far"]);
  });

  it("puts every project in as evidence, linked to its own page", () => {
    renderStory();
    for (const c of buildStory().chapters) {
      for (const p of c.projects) {
        const name = screen.getByRole("heading", { level: 3, name: p.title });
        expect(name.closest("a")).toHaveAttribute("href", `/projects/${p.slug}`);
      }
    }
  });

  it("marks the peak as the one dark panel for the chrome", () => {
    const { container } = renderStory();
    const dark = container.querySelectorAll('[data-chrome="dark"]');
    expect(dark).toHaveLength(1);
    expect(within(dark[0] as HTMLElement).getByRole("heading", { level: 2 }).textContent).toBe(
      buildStory().chapters.find((c) => c.peak)!.title
    );
  });

  it("counts the years and keeps every mark it has passed", () => {
    const { container } = renderStory();
    const story = buildStory();
    const year = container.querySelector("[data-rail-year]")!;
    const dots = () => [...container.querySelectorAll("[data-rail-year] + * > i")];
    const mark = (i: number) => container.querySelector(`[data-rail-mark="${i}"]`)!;

    expect(year.textContent).toBe(String(story.firstYear));
    expect(dots().filter((d) => d.hasAttribute("data-passed"))).toHaveLength(0);

    fire(mark(2));
    expect(year.textContent).toBe(String(story.chapters[2].railYear));
    expect(dots().map((d) => d.hasAttribute("data-passed"))).toEqual(
      story.chapters.map((_, i) => i <= 2)
    );

    /* Back up to the first chapter: the year follows, the marks do not. */
    fire(mark(0));
    expect(year.textContent).toBe(String(story.chapters[0].railYear));
    expect(dots().filter((d) => d.hasAttribute("data-passed"))).toHaveLength(3);
    expect(dots()[0]).toHaveAttribute("data-here");
  });

  it("inverts the rail over the peak and only there", () => {
    const { container } = renderStory();
    const story = buildStory();
    const rail = container.querySelector("[data-rail-year]")!.parentElement!;
    const peak = story.chapters.findIndex((c) => c.peak);

    fire(container.querySelector(`[data-rail-mark="${peak}"]`)!);
    expect(rail).toHaveAttribute("data-dark");
    fire(container.querySelector(`[data-rail-mark="${peak + 1}"]`)!);
    expect(rail).not.toHaveAttribute("data-dark");
  });

  it("keeps the rail out of the accessibility tree", () => {
    const { container } = renderStory();
    expect(container.querySelector("[data-rail-year]")!.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("prints the figures for a screen reader whatever the count is doing", () => {
    renderStory();
    for (const f of buildStory().figures) {
      const term = screen.getByText(f.caption, { selector: "dt" });
      expect(term.nextElementSibling).toHaveTextContent(String(f.value));
    }
  });
});
