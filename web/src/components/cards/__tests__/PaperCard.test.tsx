import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PaperCard from "@/components/cards/PaperCard";

/*
 * The card's surface is a shared class in index.css and its inset is a module
 * class, so what is worth testing is that the component keeps putting both on
 * the element — and the two variants, each of which exists because leaving it
 * off produced a specific visible bug.
 */
describe("PaperCard", () => {
  it("always carries the shared card surface", () => {
    const { container } = render(<PaperCard>Reach for daily</PaperCard>);
    const card = container.firstElementChild;

    /* `.card-paper` is the one class every card on the site shares, and the
       deck reaches through its own wrappers to find it. Dropping it here
       would silently break the pile's shadows and heights. */
    expect(card?.className).toContain("card-paper");
    expect(screen.getByText("Reach for daily")).toBeInTheDocument();
  });

  it("renders the element it was asked for and names it when told to", () => {
    render(
      <PaperCard as="aside" aria-label="Other ways to reach me">
        yehuda@example.com
      </PaperCard>
    );

    expect(screen.getByRole("complementary", { name: "Other ways to reach me" })).toBeInTheDocument();
  });

  it("adds a class for solid and a class for flush, and neither by default", () => {
    const plain = render(<PaperCard>a</PaperCard>).container.firstElementChild;
    const solid = render(<PaperCard solid>b</PaperCard>).container.firstElementChild;
    const flush = render(<PaperCard flush>c</PaperCard>).container.firstElementChild;

    const count = (el: Element | null) => (el?.className ?? "").split(" ").filter(Boolean).length;

    /* Solid exists because stacked cards were see-through and the text of
       card one read through cards two and three; flush exists because a card
       that is entirely one link has to hand its padding to the anchor. */
    expect(count(solid)).toBe(count(plain) + 1);
    expect(count(flush)).toBe(count(plain) + 1);
    expect(solid?.className).not.toBe(flush?.className);
  });
});
