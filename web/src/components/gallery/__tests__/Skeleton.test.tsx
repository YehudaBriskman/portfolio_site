import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LabelSkeleton from "@/components/gallery/LabelSkeleton";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { MAX_FIELDS } from "@/components/gallery/objectLabel";

/*
 * What can and cannot be checked here.
 *
 * jsdom has no layout, so the one property these components exist for — that
 * a skeleton is exactly as tall as the thing it stands in for — cannot be
 * asserted in this file at all. It was measured in a browser instead, and the
 * numbers are in the pull request and in the comments on the components.
 *
 * What is checkable is everything that would make that measurement a lie
 * later, and every one of these has already been got wrong somewhere in this
 * codebase:
 *
 *   - that the skeleton is set in the label's own type steps, rather than in
 *     a second set of sizes that agree with them today;
 *   - that nothing in it is announced;
 *   - that the lines carry the hooks a caller's stylesheet needs, because a
 *     region with two layouts has two line counts and only its own
 *     stylesheet can say so;
 *   - and the two off-switches, asserted against the stylesheet text for the
 *     reason the city's suite gives at length: both are at-rules, jsdom
 *     resolves neither, and a sweep still running for a reader who asked for
 *     no motion is invisible to a DOM query.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/gallery/Skeleton.module.css"),
  "utf8",
);

/* Comments out, for the reason the city's suite gives: this stylesheet
   argues at length about what it does not do, so a check for a declaration
   has to look at the declarations and not at the prose beside them. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

describe("SkeletonLines", () => {
  it("draws one line per line of the text it stands in for", () => {
    const { container } = render(<SkeletonLines lines={3} />);
    expect(container.querySelectorAll("[data-sk-line]")).toHaveLength(3);
  });

  it("never collapses to nothing, whatever it is asked for", () => {
    /* A block with no lines is a block with no height, which is the layout
       shift this component exists to prevent rather than a legitimate
       request for an empty placeholder. */
    for (const lines of [0, -1]) {
      const { container } = render(<SkeletonLines lines={lines} />);
      expect(container.querySelectorAll("[data-sk-line]")).toHaveLength(1);
    }
  });

  it("fills every line but the last, which is the shape of wrapped text", () => {
    const { container } = render(<SkeletonLines lines={3} />);
    const widths = [...container.querySelectorAll<HTMLElement>("[data-sk-line]")].map((l) =>
      l.style.getPropertyValue("--sk-w"),
    );
    expect(widths.slice(0, -1)).toEqual(["100%", "100%"]);
    expect(widths.at(-1)).not.toBe("100%");
  });

  it("gives a lone line its own width, because a short sentence is not a ragged one", () => {
    const { container } = render(<SkeletonLines lines={1} />);
    const solo = container.querySelector<HTMLElement>("[data-sk-line]");
    const { container: wrapped } = render(<SkeletonLines lines={2} />);
    const tail = [...wrapped.querySelectorAll<HTMLElement>("[data-sk-line]")].at(-1);
    expect(solo?.style.getPropertyValue("--sk-w")).not.toBe(
      tail?.style.getPropertyValue("--sk-w"),
    );
  });

  it("takes an explicit width, which is what a wrapping flex row needs", () => {
    /* The field row is the one place a capsule's width decides the height of
       anything: it wraps, so a capsule narrower than the word it stands in
       for wraps at a different viewport than the real line does. */
    const { container } = render(<SkeletonLines lines={1} tail="4.25rem" />);
    const line = container.querySelector<HTMLElement>("[data-sk-line]");
    expect(line?.style.getPropertyValue("--sk-w")).toBe("4.25rem");
  });
});

describe("LabelSkeleton", () => {
  it("is not in the accessibility tree", () => {
    const { container } = render(<LabelSkeleton />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("mirrors the label's three parts, and names each of them in the markup", () => {
    const { container } = render(<LabelSkeleton nameLines={2} factLines={2} fields={3} />);
    for (const block of ["name", "fact", "fields"]) {
      expect(container.querySelector(`[data-sk-block="${block}"]`)).not.toBeNull();
    }
  });

  it("draws the line counts it is given, per block", () => {
    const { container } = render(<LabelSkeleton nameLines={2} factLines={3} fields={2} />);
    const lines = (block: string) =>
      container.querySelectorAll(`[data-sk-block="${block}"] [data-sk-line]`).length;
    expect(lines("name")).toBe(2);
    expect(lines("fact")).toBe(3);
    expect(lines("fields")).toBe(2);
  });

  it("will not print more fields than the schema allows", () => {
    /* `MAX_FIELDS` is the schema and not a default — see `objectLabel.ts`. A
       placeholder promising four fields would be reserving room for a
       datasheet the label cannot render. */
    const { container } = render(<LabelSkeleton fields={9} />);
    expect(
      container.querySelectorAll('[data-sk-block="fields"] [data-sk-line]'),
    ).toHaveLength(MAX_FIELDS);
  });

  it("drops the field row entirely when the label has no fields", () => {
    const { container } = render(<LabelSkeleton fields={0} />);
    expect(container.querySelector('[data-sk-block="fields"]')).toBeNull();
  });

  /*
   * The type steps, and why this test is worth more than it looks.
   *
   * The whole claim of this component is that it occupies the real height,
   * and the entire mechanism behind that claim is that it is set in the same
   * type as `ObjectLabel` — the same utility at `plate` and `object`, the
   * same absence of one at `inline` where a rule in the label's own
   * stylesheet takes over. Pick a different step here and the skeleton is
   * still a plausible drawing and is quietly the wrong size, which is the
   * one failure mode a skeleton can have that is worse than having none.
   */
  it.each([
    ["plate", "text-hero", "text-fact"],
    ["object", "text-object", "text-fact"],
    ["inline", null, null],
  ] as const)("sets the %s scale in the label's own type", (scale, nameSize, factSize) => {
    const { container } = render(<LabelSkeleton scale={scale} />);
    const name = container.querySelector('[data-sk-block="name"]');
    const fact = container.querySelector('[data-sk-block="fact"]');

    if (nameSize) expect(name?.className).toContain(nameSize);
    else expect(name?.className).not.toMatch(/text-(hero|object)/);

    if (factSize) expect(fact?.className).toContain(factSize);
    else expect(fact?.className).not.toContain("text-fact");
  });
});

describe("SkeletonGate", () => {
  it("is not in the accessibility tree", () => {
    const { container } = render(
      <SkeletonGate>
        <LabelSkeleton />
      </SkeletonGate>,
    );
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the caller's own layout classes, because the box has to be the real box", () => {
    const { container } = render(<SkeletonGate className="viewport-ish">x</SkeletonGate>);
    expect(container.firstElementChild?.className).toContain("viewport-ish");
  });
});

describe("the skeleton stylesheet", () => {
  it("holds no height of its own", () => {
    /* The mechanism is a line box made by a zero-width space, so a skeleton
       line is as tall as the type step its parent is set in. The moment a
       `height` appears on `.line` itself that stops being true, and the
       component goes back to agreeing with the type scale only on the day it
       was written. The capsule's own `height` is in `em` on the `::after`,
       which is out of flow and cannot reach the layout. */
    const line = CSS.slice(CSS.indexOf(".line {"), CSS.indexOf(".line::before"));
    expect(line).not.toMatch(/\bheight:/);
    expect(CSS).toContain('content: "\\200B"');
  });

  it("stops the sweep and removes the band under both off-switches", () => {
    /*
     * A shimmer is motion, so both standing conditions have to land it on
     * the finished state — a flat capsule. Cancelling the animation without
     * removing the gradient leaves a bright band parked wherever the last
     * frame stopped, which is a highlight on a surface nothing is happening
     * to; that is why both declarations are asserted rather than one.
     */
    for (const guard of [
      "@media (prefers-reduced-motion: reduce)",
      "body.motion-paused",
    ]) {
      const at = CSS.indexOf(guard);
      expect(at).toBeGreaterThan(-1);
      const block = CSS.slice(at, at + 220);
      expect(block).toContain("animation: none");
      expect(block).toContain("background-image: none");
    }
  });

  it("leaves the gate alone under both off-switches", () => {
    /*
     * The gate is a decision about whether a placeholder is shown at all,
     * not a piece of motion, and a reader who has asked for less motion has
     * not asked to be shown more flicker. The global
     * `animation-duration: 0.01ms !important` both conditions carry
     * overrides the duration and leaves the delay alone, so the gate keeps
     * working on its own — provided nothing here cancels it by name.
     */
    for (const guard of [
      "@media (prefers-reduced-motion: reduce)",
      ":global(body.motion-paused)",
    ]) {
      /* The guard's own block only — `.gate` is declared further down the
         file, so a slice to the end would always match it. */
      const at = CSS.indexOf(guard);
      expect(CSS.slice(at, CSS.indexOf("}", CSS.indexOf("{", at)) + 2)).not.toContain(".gate");
    }
  });

  it("has no minimum display time anywhere in it", () => {
    /*
     * The whole of the timing is at the front. A skeleton held open for a
     * fixed period is a delay the site did not have, and on a warm cache the
     * right number of frames of placeholder is zero — so the gate's clock
     * runs before the ink and never after it. `forwards` or a second
     * animation on `.gate` would be the shape this is guarding against.
     */
    const gate = CSS.slice(CSS.indexOf(".gate {"));
    expect(gate).toMatch(/animation:\s*sk-gate 1ms linear var\(--sk-gate, 180ms\) both/);
  });

  it("sweeps with the reading direction in both writing modes", () => {
    /* Two keyframes and an explicit `animation-name`, because a name reached
       through a custom property is invisible to the CSS Modules scoper and
       fails silently — §7 of the motion contract. */
    expect(CSS).toContain("@keyframes sk-sweep");
    expect(CSS).toContain("@keyframes sk-sweep-rtl");
    expect(CSS).toMatch(/html\[dir="rtl"\][\s\S]{0,80}animation-name: sk-sweep-rtl/);
  });
});
