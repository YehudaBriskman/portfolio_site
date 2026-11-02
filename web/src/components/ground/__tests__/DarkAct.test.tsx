import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DarkAct from "@/components/ground/DarkAct";

/*
 * jsdom has no layout, no compositor and no at-rules, so the arc, the drift
 * and the light are all verified in a browser and measured in the pull
 * request. What is left here is the set of promises that break SILENTLY —
 * where the page still renders, nothing throws, and the thing that is wrong is
 * only visible to someone who knows what to look for.
 *
 * There are four.
 *
 * The seams and the crest must stay out of the accessibility tree. They are
 * three empty `div`s whose entire purpose is colour; announced, they are three
 * nothings between a heading and its content.
 *
 * The drift must start switched OFF when the engine can observe, because the
 * whole justification for a continuously running animation is that it does not
 * run while nobody is looking — and must start ON when it cannot, because an
 * absent optimisation is not a reason to withhold the page.
 *
 * The edge must stay an edge and not become the card #92 removed. A radius on
 * the two block-END corners is exactly that regression, and it is one line
 * away at any time.
 *
 * And every exit has to land on the act with its boundary intact. A switch
 * that hid the seams' PARENT, or that took the arc away with the drift, would
 * leave a reader who asked for less motion looking at a plain rectangle.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/ground/DarkAct.module.css"),
  "utf8",
);

/* Comments out. This stylesheet argues at length about what it does not do and
   about numbers it rejected, so a check for a declaration has to look at the
   declarations rather than at the prose beside them. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

describe("DarkAct", () => {
  it("hides its three decorative layers from the accessibility tree", () => {
    const { container } = render(
      <DarkAct>
        <section id="probe">content</section>
      </DarkAct>,
    );
    const act = container.firstElementChild as HTMLElement;
    const decorations = [...act.children].filter((el) => el.id !== "probe");
    expect(decorations).toHaveLength(3);
    for (const el of decorations) expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the two seams and the crest in the DOM regardless of state", () => {
    /* The off-switches take away the MOVEMENT, never the boundary. If a switch
       ever started removing the seams from the markup instead of cancelling
       their animations, this is where that would show. */
    const { container } = render(
      <DarkAct>
        <section id="probe">content</section>
      </DarkAct>,
    );
    expect(container.querySelectorAll("[data-edge]")).toHaveLength(2);
    expect(container.querySelector('[data-edge="start"]')).not.toBeNull();
    expect(container.querySelector('[data-edge="end"]')).not.toBeNull();
  });

  it("keeps no state and no observer, because the drift runs on scroll (#162)", () => {
    const { container } = render(
      <DarkAct>
        <section id="probe">content</section>
      </DarkAct>,
    );
    expect(container.firstElementChild).not.toHaveAttribute("data-drift");
  });

  it("stands on the page's own plate classes rather than reinventing them", () => {
    const { container } = render(
      <DarkAct>
        <section id="probe">content</section>
      </DarkAct>,
    );
    const act = container.firstElementChild as HTMLElement;
    expect(act.className).toContain("layer-section");
    expect(act.className).toContain("ground");
    expect(act).toHaveAttribute("data-ground", "panel");
  });
});

describe("the dark act's edge", () => {
  it("curves at the block-start only, and never at the block-end", () => {
    /* A radius on all four corners is the card #92 took off the plates. The
       two block-end corners stay square so the act meets the page rather than
       floating over it; what happens at the foot is the paper crest, which is
       a separate element rising INTO the dark. */
    expect(CSS).toMatch(/border-start-start-radius:\s*50%\s*var\(--act-arc\)/);
    expect(CSS).toMatch(/border-start-end-radius:\s*50%\s*var\(--act-arc\)/);
    expect(CSS).not.toMatch(/border-end-start-radius/);
    expect(CSS).not.toMatch(/border-end-end-radius/);
  });

  it("spends the curve across the page rather than in two corners", () => {
    /* `50%` in the inline axis is what makes the two corner curves meet, so
       there is no straight segment left between them and the edge is one arc.
       Drop the 50% and this silently becomes #92's plain radius again. */
    const corners = CSS.match(/border-start-\w+-radius:[^;]+/g) ?? [];
    expect(corners.length).toBeGreaterThan(0);
    for (const decl of corners) expect(decl).toMatch(/50%/);
  });

  it("uses logical properties throughout, because the site runs in Hebrew", () => {
    expect(CSS).not.toMatch(/border-top-\w+-radius/);
    expect(CSS).not.toMatch(/\b(left|right)\s*:/);
    expect(CSS).not.toMatch(/margin-(left|right)/);
    expect(CSS).not.toMatch(/padding-(left|right)/);
  });

  it("reads the dark ground's own colour stops and never the roles", () => {
    /*
     * THE TRAP, and it is the one `index.css` warns about at the head of the
     * `--panel` block. This element is the PARENT of the `.on-panel` section,
     * so a role token read here resolves on `:root` — where `--signal` is the
     * deep ink blue measured for paper. The seam would have been lit in the
     * wrong accent on a near-black ground and nothing would have thrown.
     */
    expect(CSS).toMatch(/--accent-on-panel/);
    expect(CSS).not.toMatch(/var\(--signal\)/);
    expect(CSS).not.toMatch(/var\(--ink\)/);
    expect(CSS).not.toMatch(/var\(--rule/);
  });

  it("never clips the act itself, only the seams", () => {
    /*
     * A clip container on the plate is a containing block for the sticky pile
     * inside Work and a fresh scope for every `animation-timeline: view()`
     * under it — the long version is on `.ground` in `index.css`. The seams
     * clip because nothing lives inside them.
     */
    const actBlock = CSS.slice(CSS.indexOf(".act {"), CSS.indexOf(".seam {"));
    expect(actBlock).not.toMatch(/overflow/);
    expect(CSS).toMatch(/\.seam\s*\{[^}]*overflow:\s*clip/);
  });
});

describe("the dark act's off-switches", () => {
  const gates: [string, RegExp][] = [
    ["view timelines run", /@supports \(animation-timeline: view\(\)\)/],
    ["no reduced motion", /@media \(prefers-reduced-motion: no-preference\)/],
    ["Pause is off", /body:not\(\.motion-paused\)/],
    ["absent overflow: clip", /@supports not \(overflow: clip\)/],
  ];

  for (const [name, re] of gates) {
    it(`gates the drift on: ${name}`, () => expect(CSS).toMatch(re));
  }

  it("declares the drift only inside the gate, so every switch is the still lights", () => {
    expect(CSS).not.toMatch(/animation-play-state/);
    const gate = CSS.slice(CSS.indexOf("@supports (animation-timeline: view())"));
    const before = CSS.slice(0, CSS.indexOf("@supports (animation-timeline: view())"));
    expect(before).not.toMatch(/animation-name:\s*seam/);
    expect(gate).toMatch(/animation-name:\s*seam-wash/);
    expect(gate).toMatch(/animation-name:\s*seam-spark/);
  });

  it("leaves the boundary drawn under every switch", () => {
    /* No switch reaches for `.crest` or hides an element: the arcs are not
       animated, so a reader who asked for no motion still gets the edge. */
    expect(CSS).not.toMatch(/prefers-reduced-motion: reduce/);
    const gate = CSS.slice(CSS.indexOf("@supports (animation-timeline: view())"));
    const gateBlock = gate.slice(0, gate.indexOf("\n}\n") + 3);
    expect(gateBlock).not.toMatch(/\.crest/);
    expect(gateBlock).not.toMatch(/display:\s*none/);
  });

  it("drives both sources by each seam's own view timeline, on no clock", () => {
    expect(CSS).toMatch(/view-timeline:\s*--seam/);
    expect(CSS).toMatch(/animation-timeline:\s*--seam/);
    expect(CSS).not.toMatch(/animation-duration/);
    expect(CSS).not.toMatch(/infinite/);
  });

  it("names its keyframes in a literal animation-name and never through a var()", () => {
    /* CSS Modules scopes `@keyframes` identifiers and rewrites the bare
       `animation-name` declarations it can see. A name written inside `var()`
       survives that rewrite verbatim and then points at a keyframe that no
       longer exists — silently. §7 of the motion contract. */
    expect(CSS).toMatch(/animation-name:\s*seam-wash/);
    expect(CSS).toMatch(/animation-name:\s*seam-spark/);
    expect(CSS).not.toMatch(/animation-name:\s*var\(/);
  });

  it("asks for no layer promotion it has not measured", () => {
    /*
     * `will-change: transform` was tried on the two sources and measured
     * WORSE — 52.9fps against 54.2 at 4x CPU over the year act — which is
     * `EntryShutter.module.css`'s argument against early promotion arriving
     * from the other direction. The `translate3d` already asks for what the
     * compositor needs.
     */
    expect(CSS).not.toMatch(/will-change/);
    expect(CSS).toMatch(/translate3d/);
  });
});
