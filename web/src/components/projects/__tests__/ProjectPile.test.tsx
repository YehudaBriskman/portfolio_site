import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectPile from "@/components/projects/ProjectPile";
import { arrival, newestYear } from "@/components/projects/pileArrival";
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
    /* Scoped to the rail's own children, and to the ones that are not the
       index's anchor markers. Every label carries its field line as a nested
       list, so an unscoped `listitem` query counts the specs as well; and
       each object is preceded by a zero-height `aria-hidden` marker that the
       chrome watches instead of the sticky slot. */
    expect(list.querySelectorAll(":scope > li:not([aria-hidden])")).toHaveLength(3);
    /* The markers are addressable and invisible: one per object, carrying the
       anchor id, hidden from the accessibility tree so the list still reports
       three things rather than six. */
    const markers = list.querySelectorAll(':scope > li[aria-hidden="true"]');
    expect(markers).toHaveLength(3);
    expect(Array.from(markers).map((m) => m.id)).toEqual([
      "object-windom",
      "object-bothy",
      "object-icaros",
    ]);
    /* And the id is NOT on the slot. It was, and because a sticky slot stops
       moving the moment it pins, the chrome's probe resolved every object in
       the pile to the first one. */
    expect(
      list.querySelectorAll(':scope > li:not([aria-hidden])[id]'),
    ).toHaveLength(0);
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

    const slots = Array.from(container.querySelectorAll("ol > li:not([aria-hidden])"));
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

  /*
   * The per-project arrival.
   *
   * What a reader sees of this is a browser matter and is checked with a
   * camera. What is checked here is the part that can be wrong without looking
   * wrong: that the gesture is derived from the project's facts and not from
   * its position, that the derivation is total — every state, a missing year,
   * one project, eight — and that the mechanism keeps the single keyframe name
   * the CSS Modules rewrite depends on.
   */
  describe("the arrival, per project", () => {
    it("derives the gesture from the state and never from the index", () => {
      const newest = newestYear(three);
      const [a, b, c] = three.map((e) => arrival(e, newest));

      /* Three states, three hinges. `In use` is set down on its own bottom
         edge, `Open source` swings on its leading edge, `Live` hangs from its
         top edge and settles. */
      expect(a["--arrive-origin"]).toBe("50% 100%");
      expect(b["--arrive-origin"]).toBe("0% 50%");
      expect(c["--arrive-origin"]).toBe("50% 0%");

      /* `In use` rises into its place and `Live` comes down into it, which is
         the sign of the lift and is the difference a reader actually sees. */
      expect(Number.parseFloat(a["--arrive-lift"])).toBeGreaterThan(0);
      expect(Number.parseFloat(c["--arrive-lift"])).toBeLessThan(0);

      /* Only the one that swings has a swing, so the other two cannot be
         distinguished from each other by an axis neither of them uses. */
      expect(b["--arrive-swing"]).not.toBe("0deg");
      expect(a["--arrive-swing"]).toBe("0deg");
      expect(c["--arrive-swing"]).toBe("0deg");

      /* And the order they are passed in changes nothing about any of them. */
      const reversed = [...three].reverse();
      const back = reversed.map((e) => arrival(e, newestYear(reversed)));
      expect(back[2]).toEqual(a);
    });

    it("quietens the same gesture as the work gets older", () => {
      /* Two projects in the same state, two years apart. The gesture is the
         same and the distance left to travel is not — which is the half of
         the relationship the state cannot express. */
      const now = arrival({ state: "Live", year: "2026" }, 2026);
      const then = arrival({ state: "Live", year: "2024" }, 2026);

      expect(then["--arrive-origin"]).toBe(now["--arrive-origin"]);
      expect(Math.abs(Number.parseFloat(then["--arrive-lift"]))).toBeLessThan(
        Math.abs(Number.parseFloat(now["--arrive-lift"]))
      );
      expect(Math.abs(Number.parseFloat(then["--arrive-tip"]))).toBeLessThan(
        Math.abs(Number.parseFloat(now["--arrive-tip"]))
      );
      /* The scale attenuates toward 1 and not toward 0: what the age factor
         shortens is the journey, so the older card starts *closer* to its
         resting size. Multiplying the scale itself would say the opposite. */
      expect(Number(then["--arrive-shrink"])).toBeGreaterThan(Number(now["--arrive-shrink"]));
      expect(Number(then["--arrive-shrink"])).toBeLessThan(1);

      /* The ramp has a floor. A card at a tenth of its gesture does not read
         as old, it reads as broken. */
      const ancient = arrival({ state: "Live", year: "2009" }, 2026);
      expect(ancient).toEqual(then);
    });

    it("asserts nothing about a project it cannot date", () => {
      /* Neither end of the ramp: the full gesture would claim this is the
         newest thing in the section and the floor would claim it is the
         oldest, and the table has said neither. */
      const undated = arrival({ state: "Live", year: null }, 2026);
      expect(undated).toEqual(arrival({ state: "Live", year: "2025" }, 2026));
      expect(newestYear([{ state: "Live", year: null }])).toBeNull();
      /* A pile where nothing carries a year still animates. */
      expect(arrival({ state: "In use", year: null }, null)["--arrive-lift"]).not.toBe("0px");
    });

    it("gives an unrecognised state the quietest gesture rather than the loudest", () => {
      /* `state` is not an enum. A published collection with no seed behind it
         gets a release tag or `Archive`, and neither should be awarded the
         biggest arrival in the section on the strength of a string nobody has
         read. */
      for (const state of ["v1.5.1", "Archive", "", "Sunsetting"]) {
        expect(arrival({ state, year: "2026" }, 2026)["--arrive-origin"]).toBe(
          arrival({ state: "Live", year: "2026" }, 2026)["--arrive-origin"]
        );
      }
    });

    it("writes the gesture onto every slot, at one and at eight", () => {
      const keys = [
        "--arrive-origin",
        "--arrive-lift",
        "--arrive-tip",
        "--arrive-swing",
        "--arrive-shrink",
      ];

      /* One and eight, which are the two counts the geometry is written to
         survive — the step between pin offsets is derived from the count
         precisely so that eight do not walk the last card under the bar. */
      const eight = Array.from({ length: 8 }, (_, i) =>
        entry({ state: ["In use", "Open source", "Live"][i % 3], year: String(2026 - (i % 4)) }, {
          slug: `p${i}`,
          title: `P${i}`,
        })
      );

      for (const entries of [[three[0]], eight]) {
        const { container, unmount } = draw(entries);
        const slots = Array.from(container.querySelectorAll("ol > li:not([aria-hidden])"));
        expect(slots).toHaveLength(entries.length);
        for (const slot of slots) {
          const style = slot.getAttribute("style") ?? "";
          for (const k of keys) expect(style).toContain(`${k}:`);
        }
        unmount();
      }
    });

    it("keeps the per-card difference in the keyframe's values, not in its name", () => {
      /* The one keyframe reads all four moving values off the slot. Six
         keyframes would have meant six names to scope and eighteen
         cancellations in the off-switches, and would have fallen out of step
         with the project count the first time one was added. */
      const keyframes = CSS.match(/@keyframes pile-arrive\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      for (const v of ["--arrive-lift", "--arrive-tip", "--arrive-swing", "--arrive-shrink"]) {
        expect(keyframes).toContain(`var(${v},`);
      }
      /* Every one of them carries a fallback, and the fallback is the uniform
         arrival every card had before this was per project. A custom property
         with no fallback makes the whole `transform` invalid at
         computed-value time, which for a non-inherited property resolves to
         `none` — an arrival that silently does not move. */
      expect(keyframes).not.toMatch(/var\(--arrive-[a-z]+\)/);
      /* The hinge is per project too, and it also has a fallback. */
      expect(CSS).toContain("transform-origin: var(--arrive-origin, 50% 100%)");
      /* And the count of off-switch cancellations has not moved. Three
         conditions, three lines, whatever N is. */
      expect(CSS.match(/animation-name: none;/g)).toHaveLength(3);
    });
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
