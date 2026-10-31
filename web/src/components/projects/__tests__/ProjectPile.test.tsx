import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectPile from "@/components/projects/ProjectPile";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout, no scrolling and no scroll-driven animation, so the
 * pile itself — the pinning, the arrival, the occlusion — cannot be exercised
 * here and is verified in a browser instead. Two things can be, and both of
 * them are the parts that break silently.
 *
 * The first is the markup contract the whole device rests on: a list of
 * projects, every one of them present, each offering exactly one link over the
 * whole card. If that stops being true then the argument for driving the
 * section from `position: sticky` and a view timeline stops being true with
 * it, because the fallback is "the list it already is" and there would no
 * longer be a list.
 *
 * The second is the fallback branch, which is asserted against the stylesheet
 * text rather than against a rendered element — deliberately, and for a reason
 * no amount of DOM querying gets around. All three off-switches are at-rules
 * (`@supports`, `@media`, and a class on `document.body`), jsdom resolves
 * neither `@supports not (animation-timeline: view())` nor a cascade that
 * depends on it, and the failure mode they exist to prevent is invisible by
 * definition: a card stranded at its first keyframe waiting for a timeline
 * that will never tick. A test that rendered the component and found the card
 * in the DOM would pass with the section completely blank in a real browser.
 * So what is checked is that each switch is present and that each one cancels
 * the animation rather than merely shortening it.
 */

/* Resolved from the project root rather than from `import.meta.url`: Vitest
   transforms this module, so its own URL is not a `file:` one and `readFile`
   refuses it. The suite runs with `web/` as the working directory. */
const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/projects/ProjectPile.module.css"),
  "utf8"
);

/* Comments out. This file explains at length what `animation-duration` does
   under a view timeline and why there is none of it, so a check for the
   property has to be a check on the declarations and not on the prose about
   them. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

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
  fields: [
    { kind: "state", value: "In use" },
    { kind: "tech", value: "React 19" },
  ],
  tint: [24, 142, 167],
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
  entry(
    {
      state: "Open source",
      fields: [
        { kind: "state", value: "Open source" },
        { kind: "tech", value: "Docker Compose" },
      ],
      tint: [58, 132, 104],
    },
    { slug: "bothy", title: "Bothy", tagline: "A console for one machine that asks Docker what is running" }
  ),
  entry(
    {
      state: "Live",
      fields: [
        { kind: "state", value: "Live" },
        { kind: "when", value: "2025" },
      ],
      /* No sampled colour, which is the normal case for anything the CMS
         added. The card falls back to the stylesheet's neutral. */
      tint: null,
    },
    { slug: "icaros", title: "Icaros", tagline: "A car marketplace that loads on a phone signal" }
  ),
];

function draw(entries: ProjectEntry[], label = "Selected work") {
  return render(
    <MemoryRouter>
      <ProjectPile entries={entries} label={label} heading="h3" />
    </MemoryRouter>
  );
}

describe("ProjectPile", () => {
  it("is a list of every project, named, in order", () => {
    draw(three);

    const list = screen.getByRole("list", { name: "Selected work" });
    expect(list.tagName).toBe("OL");
    /* Scoped to the rail's own children. Every label carries its field line
       as a nested list, so an unscoped `listitem` query counts the specs as
       well as the objects. */
    expect(list.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "WindoM",
      "Bothy",
      "Icaros",
    ]);
  });

  it("makes the whole card one link and nothing else interactive", () => {
    draw(three);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/projects/windom",
      "/projects/bothy",
      "/projects/icaros",
    ]);

    /* One target per card, so the link has to contain the label rather than
       sit beside it — and there must be nothing else to press, or the card
       stops being one object. */
    expect(links[0]).toContainElement(screen.getByRole("heading", { name: "WindoM" }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("labels each object through the schema, fact line and fields", () => {
    draw(three);

    expect(screen.getByText("Every new tab becomes a dashboard")).toBeInTheDocument();
    expect(
      screen.getByText("A console for one machine that asks Docker what is running")
    ).toBeInTheDocument();

    /* The field line is a list of items and not one string with interpuncts
       in it, which is what lets a screen reader read three facts rather than
       one run-on. The separators are drawn by CSS. */
    const fields = screen.getByText("Docker Compose");
    expect(fields.tagName).toBe("LI");
    expect(fields.closest("ul")?.textContent).toBe("Open sourceDocker Compose");
  });

  it("writes the count, the position and the project's own colour", () => {
    const { container } = draw(three);

    const rail = container.querySelector("ol");
    /* The step between pin offsets is derived from the count, which is the
       only reason the stylesheet needs it — and the reason eight projects do
       not walk the last card under the nav bar. */
    expect(rail?.getAttribute("style")).toContain("--pile-n: 3");

    const slots = Array.from(container.querySelectorAll("ol > li"));
    expect(slots.map((s) => s.getAttribute("style"))).toEqual([
      expect.stringContaining("--pile-i: 0"),
      expect.stringContaining("--pile-i: 1"),
      expect.stringContaining("--pile-i: 2"),
    ]);

    expect(slots[0].getAttribute("style")).toContain("--pile-tint: 24 142 167");
    /* A project with no sampled colour is left to the stylesheet's neutral
       rather than being assigned a hue it has not got, so the property must
       be absent and not empty. */
    expect(slots[2].getAttribute("style")).not.toContain("--pile-tint");
  });

  it("stands in for a missing screenshot without announcing one", () => {
    const { container } = draw([three[1]]);

    /* Bothy ships no cover, so the picture slot is a type plate. Either way
       the picture is not a second description of the object — the label is
       the description — so nothing in the card contributes an alt text. */
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders nothing at all when there are no projects", () => {
    const { container } = draw([]);
    expect(container).toBeEmptyDOMElement();
  });

  /*
   * The fallback branch. See the note at the top of this file for why it is
   * read off the stylesheet.
   */
  describe("the three off-switches", () => {
    const switches: [string, RegExp][] = [
      [
        "no scroll-driven animation",
        /@supports not \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n\}/,
      ],
      ["prefers-reduced-motion", /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/],
      ["the reader's Pause control", /body\.motion-paused\)[\s\S]*?\{([\s\S]*?)animation-name: none;/],
    ];

    it.each(switches)("%s lands on a plain static list", (_name, pattern) => {
      const block = CSS.match(pattern)?.[1];
      expect(block).toBeTruthy();

      /* No sticky, so there is no pile to be half of. */
      expect(block).toContain("--pile-pin: static");
      /* The uniform card height only ever existed so one card could cover
         another. Left in place it is a column of tall boxes with a lot of
         empty plinth in each. */
      expect(block).toContain("--pile-stock: auto");
    });

    it("cancels the arrival outright in all three", () => {
      /* Cancelled rather than hurried. `animation-duration` is ignored under
         a view timeline, so the global 0.01ms override that
         `motion-paused.css` and the reduced-motion block in index.css apply
         does nothing here and would leave the card still tied to the scroll
         position — which is to say stranded at its first keyframe.

         Counted rather than matched per block, because the declaration is a
         plain `animation-name` outside the custom properties: the bundler
         scopes `@keyframes` names, and a name reached through `var()` escapes
         that rewrite and silently names a keyframe that no longer exists. One
         for the base rule and one for each of the three switches. */
      expect(CSS.match(/animation-name: none;/g)).toHaveLength(3);
      expect(CSS.match(/animation-name: pile-arrive;/g)).toHaveLength(1);
      /* And never through a variable, which is the trap above. */
      expect(CSS).not.toMatch(/animation-name:\s*var\(/);
    });

    it("has no animation-duration or animation-delay to be ignored", () => {
      /* Both are ignored the moment `animation-timeline` names a view
         timeline — the range is the clock. A line declaring either would look
         like it was doing something and would not be, which is the first of
         the two traps this section was rebuilt around. */
      expect(CSS).not.toMatch(/animation-duration/);
      expect(CSS).not.toMatch(/animation-delay/);
    });

    it("arrives on transform alone, with no opacity track", () => {
      /* A card half-way through a fade is a card you can read the one
         underneath through, which is the double exposure the pile exists to
         avoid — and a card stranded at `opacity: 0` is not there at all. The
         arrival is therefore transform-only, which makes the worst available
         failure a card in slightly the wrong place. */
      const keyframes = CSS.match(/@keyframes pile-arrive\s*\{([\s\S]*?)\n\}/)?.[1];
      expect(keyframes).toBeTruthy();
      expect(keyframes).toContain("transform");
      expect(keyframes).not.toContain("opacity");
    });

    it("runs the arrival on the entry range only", () => {
      /* A pinned element stops moving relative to the scrollport, which
         freezes its own view-timeline progress — so anything scheduled past
         the pin point never plays. `entry` is the window before the pin, and
         it is the only window this animation is allowed to use. */
      const range = CSS.match(/animation-range:\s*([^;]+);/)?.[1];
      expect(range).toBe("entry 4% entry 92%");
    });
  });
});
