import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Story from "@/pages/Story";
import { buildStory } from "@/data/story";

/*
 * The page in jsdom, which cannot see layout: so this asserts the structure,
 * and the stylesheet's motion rules as text. The look is held by the
 * screenshots in `docs/story/`.
 */

const CSS = readFileSync(resolve(process.cwd(), "src/components/story/Story.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/*
 * Queries are scoped to the story's own root, not the whole render:
 * `PageShell` also renders the site footer, whose headings and landmarks
 * belong to another component and may change without this page changing.
 */
function renderStory() {
  const { container } = render(
    <MemoryRouter initialEntries={["/story"]}>
      <Story />
    </MemoryRouter>,
  );
  return within(container.querySelector<HTMLElement>('[data-page="story"]')!);
}

describe("Story", () => {
  it("is one h1, a heading per beat in timeline order, and the close", () => {
    const screen = renderStory();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([...buildStory().beats.map((b) => b.title), "So far"]);
  });

  it("is a list of beats, each with its time, its lines written by the pen, and a slot", () => {
    const screen = renderStory();
    const list = screen.getByRole("list", { name: "Timeline" });
    const items = within(list).getAllByRole("listitem");
    const beats = buildStory().beats;
    expect(items).toHaveLength(beats.length);
    items.forEach((li, i) => {
      expect(li).toHaveAttribute("id", beats[i].id);
      expect(li).toHaveTextContent(beats[i].when);
      const written = li.querySelector("[data-written]");
      expect(written?.textContent).toBe(beats[i].lines.join(" "));
      /* The slot holds its shape whether or not the picture is there. */
      const slot = li.lastElementChild as HTMLElement;
      expect(slot.style.aspectRatio).toBe(beats[i].ratio.replace(/\s/g, " "));
    });
  });

  it("links every project beat to its own page", () => {
    const screen = renderStory();
    for (const b of buildStory().beats.filter((x) => x.href)) {
      const head = screen.getByRole("heading", { level: 2, name: b.title });
      expect(head.querySelector("a")).toHaveAttribute("href", b.href);
    }
  });

  it("keeps an empty slot out of the accessibility tree", () => {
    const screen = renderStory();
    const list = screen.getByRole("list", { name: "Timeline" });
    const empty = [...list.querySelectorAll(":scope > li > :last-child")].filter((el) => !el.querySelector("img"));
    expect(empty.length).toBeGreaterThan(0);
    for (const el of empty) expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("prints its figures", () => {
    const screen = renderStory();
    for (const f of buildStory().figures) {
      const term = screen.getByText(f.caption, { selector: "dt" });
      expect(term.nextElementSibling).toHaveTextContent(String(f.value));
    }
  });
});

describe("Story.module.css", () => {
  it("drives every animation by scroll, never by time", () => {
    /* Scroll is the clock: no transition, no duration, no delay anywhere. */
    expect(CSS).not.toMatch(/transition|animation-(duration|delay)|\d+m?s\b/);
    const animated = [...CSS.matchAll(/animation:\s*(story-[a-z]+)/g)].map((m) => m[1]);
    expect(animated.sort()).toEqual(["story-knot", "story-plate", "story-spine"]);
    for (const name of animated) {
      const rule = CSS.match(new RegExp(`\\{[^}]*animation:\\s*${name}[^}]*\\}`))?.[0] ?? "";
      expect(rule).toMatch(/animation-timeline:\s*(view\(\)|--story-[a-z]+)/);
    }
  });

  it("cancels every animation under each of the three off-switches", () => {
    const off = /\.timeline::before,\s*\.beat::before,\s*\.plate\s*\{\s*animation:\s*none;/;
    for (const gate of [/@supports not \(animation-timeline: view\(\)\)\s*\{\s*/, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*/]) {
      expect(CSS).toMatch(new RegExp(gate.source + off.source));
    }
    expect(CSS).toMatch(
      /:global\(body\.motion-paused\) \.timeline::before,\s*:global\(body\.motion-paused\) \.beat::before,\s*:global\(body\.motion-paused\) \.plate\s*\{\s*animation:\s*none;/,
    );
    /* The knot's finished state is filled; each exit says so. */
    expect(CSS.match(/\.beat::before\s*\{\s*background-color:\s*rgb\(var\(--signal\)\)/g)).toHaveLength(3);
  });
});
