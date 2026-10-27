import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WordStagger from "@/components/motion/WordStagger";

/*
 * The delays are the only real logic in the whole set of primitives — the
 * rest is declarations a browser either honours or does not, and testing
 * those would be testing the browser. The punctuation pause in particular is
 * the thing a careless edit silently flattens into a teletype, and nothing
 * about the page would look broken afterwards.
 */

function delays(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[style]")).map(
    (el) => el.getAttribute("style") ?? ""
  );
}

describe("WordStagger", () => {
  it("accumulates 110ms a word, holding longer at a comma and a full stop", () => {
    const { container } = render(
      <WordStagger>Wait, then go. Again</WordStagger>
    );

    /*
     * Wait,  starts at 0; the comma owes 250 on top of the 110 beat.
     * then   starts at 360, an ordinary beat.
     * go.    starts at 470; the full stop owes 420 on top of the beat.
     * Again  starts at 1000.
     */
    expect(delays(container)).toEqual([
      "--t: 0ms;",
      "--t: 360ms;",
      "--t: 470ms;",
      "--t: 1000ms;",
    ]);
  });

  it("hears the full stop through a closing bracket or quote", () => {
    const { container } = render(<WordStagger>{`("done.") Next`}</WordStagger>);

    expect(delays(container)).toEqual(["--t: 0ms;", "--t: 530ms;"]);
  });

  it("keeps the unsplit sentence readable and hides the split copy", () => {
    render(<WordStagger as="h2">Hold still.</WordStagger>);

    /* The heading's accessible name is the whole sentence, not two fragments:
       getByRole computes it from the tree, so an aria-hidden animated copy
       and a visible split one would both fail this. */
    expect(
      screen.getByRole("heading", { name: "Hold still." })
    ).toBeInTheDocument();
  });

  it("renders the element it was asked for", () => {
    const { container } = render(<WordStagger as="li">One two</WordStagger>);

    expect(container.firstElementChild?.tagName).toBe("LI");
  });


  it("compresses a long line so the whole thing lands inside the budget", () => {
    /*
     * Twenty words at a flat 110ms beat is 2.1s before the rests are counted,
     * which is what the hero's opening claim was taking. On a phone the
     * reader watched the end of their own introduction being typed at them.
     * The cap scales every delay down together, so the sentence keeps its
     * shape and loses only its pace.
     */
    const { container } = render(
      <WordStagger>
        {"I ship products end to end: a Chrome extension in the Web Store, a self-hosted operations console, and the backends under both."}
      </WordStagger>
    );

    const last = delays(container).at(-1) ?? "";
    const ms = Number(last.match(/(\d+)ms/)?.[1] ?? NaN);
    expect(ms).toBeLessThanOrEqual(1200);

    /* Still a stagger, not a flattened simultaneous reveal. */
    expect(ms).toBeGreaterThan(900);
  });

  it("leaves a short line exactly as tuned", () => {
    const { container } = render(<WordStagger>Wait, then go. Again</WordStagger>);
    expect(delays(container).at(-1)).toBe("--t: 1000ms;");
  });

});
