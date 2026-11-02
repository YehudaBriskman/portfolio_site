import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Approach from "@/components/Approach";
import { about } from "@/data/site";

/*
 * The arrivals are keyframes jsdom will not run, so what is worth asserting is
 * the one thing that can rot without anyone noticing: the coupling between a
 * principle's words and the treatment chosen for them.
 *
 * Each of the three differences encodes what its claim says — the reasoning is
 * beside the mapping in `Approach.tsx` — and the mapping is keyed by the claim
 * text. So an edit to the copy in `data/site.ts` can quietly detach a reason
 * from the sentence it was written about, and the only places that would
 * notice are this file and a careful reader of the page. The fallback is
 * deliberate rather than defensive, and it is tested below too: an unrecognised
 * claim takes the family's plain gesture instead of inheriting the argument
 * that belonged to a different sentence.
 */

function principleFor(container: HTMLElement, claim: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: claim, level: 3 });
  const item = heading.parentElement;
  if (!item) throw new Error(`no item around ${claim}`);
  expect(container).toContainElement(item);
  return item;
}

afterEach(() => {
  vi.doUnmock("@/data/site");
  vi.resetModules();
});

describe("Approach", () => {
  it("puts the whole beat on the page as prose", () => {
    render(<Approach />);
    /* The prose is `motion/Written`, which sets each word as its own inline
       span, so `getByText(sentence)` — which compares an element's own text
       nodes — no longer sees a sentence. The paragraph is found by its whole
       textContent instead, which is what a reader and the clipboard get. */
    const paragraph = (text: string) =>
      screen.getByText((_, el) => el?.hasAttribute("data-written") === true && el.textContent === text);

    expect(screen.getByRole("heading", { name: about.heading, level: 2 })).toBeInTheDocument();
    for (const text of about.intro) {
      expect(paragraph(text)).toBeInTheDocument();
    }
    for (const principle of about.principles) {
      expect(
        screen.getByRole("heading", { name: principle.claim, level: 3 })
      ).toBeInTheDocument();
      expect(paragraph(principle.detail)).toBeInTheDocument();
    }
  });

  it("gives each principle a treatment of its own", () => {
    const { container } = render(<Approach />);

    const classes = about.principles.map((p) => {
      const names = principleFor(container, p.claim).className.split(" ").filter(Boolean);
      /* Two classes: the spacing that makes it a principle, and the arrival
         that makes it this one. */
      expect(names).toHaveLength(2);
      return names[1];
    });

    /* Three different treatments, not one effect applied three times. If this
       fails, either a claim has been reworded out of the mapping or two
       principles have been handed the same argument. */
    expect(new Set(classes).size).toBe(3);
  });

  it("leaves the five items as direct children of the group, in reading order", () => {
    const { container } = render(<Approach />);
    const group = container.querySelector("section > div");

    /* The gate watches direct children and the stylesheet steps them by
       `nth-child`, so the grain is the markup: the heading and its eyebrow are
       one item, the standfirst is one, and each principle is one. */
    expect(group?.children).toHaveLength(2 + about.principles.length);
  });

  it("falls back to the plain arrival for a claim it does not recognise", async () => {
    vi.resetModules();
    vi.doMock("@/data/site", () => ({
      about: {
        heading: "How I work",
        intro: ["One paragraph of voice."],
        principles: [{ claim: "A claim nobody wrote a reason for", detail: "Its detail." }],
      },
    }));

    const { default: Fresh } = await import("@/components/Approach");
    const { container } = render(<Fresh />);
    const item = principleFor(container, "A claim nobody wrote a reason for");

    /* One class, and no empty or `undefined` second one: the spacing is
       intact, the arrival is the family's default, and nothing claims to
       encode a meaning it was not written for. */
    expect(item.className.split(" ").filter(Boolean)).toHaveLength(1);
    expect(item.className).not.toContain("undefined");
  });
});
