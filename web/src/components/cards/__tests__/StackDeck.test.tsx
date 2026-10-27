import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StackDeck from "@/components/cards/StackDeck";

/*
 * The pile is `position: sticky` plus one custom property per slot, and jsdom
 * will not lay out either. What it can check is the contract the stylesheet
 * depends on — one slot per child, numbered from zero in document order — and
 * the fallback that contract is built around: an ordered list, so a reader who
 * never sees the stacking still gets three numbered principles.
 */
describe("StackDeck", () => {
  it("is an ordered list with one slot per card", () => {
    render(
      <StackDeck aria-label="How I work, in three principles">
        <article>One</article>
        <article>Two</article>
        <article>Three</article>
      </StackDeck>
    );

    const list = screen.getByRole("list", { name: "How I work, in three principles" });
    expect(list.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("numbers the slots from zero in document order", () => {
    const { container } = render(
      <StackDeck>
        <p>One</p>
        <p>Two</p>
      </StackDeck>
    );

    /* --deck-i is what gives each card its own pin point; if two slots share
       a value they pin on top of each other and the pile has no edges. */
    const slots = [...container.querySelectorAll("li")];
    expect(slots.map((s) => s.style.getPropertyValue("--deck-i"))).toEqual(["0", "1"]);
  });

  it("skips over children that were conditionally rendered away", () => {
    const show = false;
    const { container } = render(
      <StackDeck>
        <p>One</p>
        {show && <p>Hidden</p>}
        <p>Two</p>
      </StackDeck>
    );

    /* A `false` child would otherwise take a slot and a number, leaving a
       gap in the pile and an index that no longer matches the position. */
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect([...container.querySelectorAll("li")].map((s) => s.style.getPropertyValue("--deck-i")))
      .toEqual(["0", "1"]);
  });
});
