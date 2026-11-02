import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Written from "@/components/motion/Written";

/*
 * What a split must not change, pinned against the unsplit paragraph.
 *
 * #98 asks for the accessible name, the copied text and the line breaking to
 * be "unchanged from plain prose — tested, not asserted". The first two are
 * DOM facts and are tested here, against a plain element rendering the same
 * children; the third is a layout fact jsdom cannot see, so here it is pinned
 * as the *structural* condition that makes it true — no word span holds a
 * break opportunity and no character lives outside the text it came from —
 * and it is measured word-for-word in a real browser in the pull request
 * (docs/written/).
 *
 * Every comparison renders both sides, so a test is never comparing against a
 * string this file typed and might have typed wrong.
 */

const SOURCE = readFileSync(resolve(process.cwd(), "src/components/motion/Written.module.css"), "utf8");
/* Comments out: the stylesheet argues at length about declarations it does
   not make, and a check for a declaration must look at the declarations. */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

const ENGLISH = "Install from empty, every time — and a check that cannot fail is not a check.";
const HEBREW = "כל התקנה מתחילה מתיקייה ריקה, בכל פעם — ו־CI שלא יכול להיכשל אינו בדיקה.";

function plainAndWritten(children: React.ReactNode) {
  cleanup();
  const plain = render(<p data-testid="plain">{children}</p>).getByTestId("plain");
  const written = render(<Written data-testid="written">{children}</Written>).getByTestId("written");
  return { plain, written };
}

describe("Written", () => {
  it("keeps the text character for character, in English and in Hebrew", () => {
    for (const text of [ENGLISH, HEBREW, "  leading and\ttrailing\nwhitespace  "]) {
      const { plain, written } = plainAndWritten(text);
      /* textContent is what the clipboard and the accessibility tree are
         both built from; the spans add no characters and remove none. */
      expect(written.textContent).toBe(plain.textContent);
    }
  });

  it("puts every word in a span and every space outside one", () => {
    const { written } = plainAndWritten(ENGLISH);
    const words = [...written.querySelectorAll("[data-word]")];

    expect(words.map((w) => w.textContent)).toEqual(ENGLISH.split(" "));
    for (const w of words) {
      /* A word span holding a space would be a break opportunity inside a
         word box; the only break opportunities must be the original spaces,
         which are text nodes directly in the paragraph. */
      expect(w.textContent).not.toMatch(/[\t\n\f\r ]/);
      /* Nothing on the word but its class and its marker: no `style` from
         React (the pen position is written by the measurement, which jsdom
         never runs), no role, no label — an inline span the accessibility
         tree flattens into its paragraph. */
      expect(w.getAttributeNames().sort()).toEqual(["class", "data-word"]);
      expect(w.tagName).toBe("SPAN");
    }
    const loose = [...written.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(loose.every((n) => /^[\t\n\f\r ]+$/.test(n.textContent ?? ""))).toBe(true);
  });

  it("does not split at a no-break space, which the author typed to join two words", () => {
    const { written } = plainAndWritten("ran 10 km today");
    expect([...written.querySelectorAll("[data-word]")].map((w) => w.textContent)).toEqual([
      "ran",
      "10 km",
      "today",
    ]);
  });

  it("keeps a link's accessible name and everything else about it", () => {
    const children = (
      <>
        Read <a href="/notes/one">the note on clean installs</a>, <em>then</em> decide.
      </>
    );
    const { plain, written } = plainAndWritten(children);
    expect(written.textContent).toBe(plain.textContent);

    const links = screen.getAllByRole("link", { name: "the note on clean installs" });
    expect(links).toHaveLength(2);
    expect(links.every((a) => a.getAttribute("href") === "/notes/one")).toBe(true);
    /* The spans are inside the link, not around it. */
    expect(written.querySelector("a [data-word]")).not.toBeNull();
    expect(written.querySelector("em [data-word]")?.textContent).toBe("then");
  });

  it("is still one paragraph to the accessibility tree", () => {
    /* One element with the paragraph role, holding the whole sentence. Note
       what this does NOT give: Testing Library's `getByText(sentence)` stops
       matching, because it compares an element's *own* text nodes and the
       words are now children. That is a property of the query, not of what a
       reader or a screen reader gets — test the paragraph by its role or its
       textContent instead. */
    render(<Written>{ENGLISH}</Written>);
    const paragraphs = screen.getAllByRole("paragraph");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent(ENGLISH);
  });

  it("leaves code, opted-out elements and a nested Written alone", () => {
    const { written } = plainAndWritten(
      <>
        run <code>npm ci --no-audit</code> and{" "}
        <span data-written="off">leave this whole</span>{" "}
        <Written as="div">inner text</Written>
      </>,
    );
    expect(written.querySelector("code [data-word]")).toBeNull();
    expect(written.querySelector("code")?.textContent).toBe("npm ci --no-audit");
    expect(written.querySelector('[data-written="off"] [data-word]')).toBeNull();
    /* Split once, by the inner one: two words, not two words wrapped twice. */
    const inner = written.querySelector("div[data-written]");
    expect(inner?.querySelectorAll("[data-word]")).toHaveLength(2);
    expect(inner?.querySelector("[data-word] [data-word]")).toBeNull();
  });

  it("leaves code alone when a markdown renderer hands it over as a component", () => {
    /* react-markdown passes its hast node as `node`; a custom `code`
       component is still code. */
    const Code = ({ children }: { children?: React.ReactNode; node?: unknown }) => <code>{children}</code>;
    const { written } = plainAndWritten(
      <>
        call <Code node={{ tagName: "code" }}>fetch the thing</Code> now
      </>,
    );
    expect(written.querySelector("code [data-word]")).toBeNull();
  });

  it("renders the element it is asked for and passes the caller's attributes through", () => {
    const { container } = render(
      <ul>
        <Written as="li" className="item" id="x">
          one two
        </Written>
      </ul>,
    );
    const li = container.querySelector("li");
    expect(li).toHaveClass("item");
    expect(li).toHaveAttribute("id", "x");
    expect(li).toHaveAttribute("data-written", "");
  });
});

describe("Written.module.css", () => {
  const word = CSS.match(/\.word\s*\{([^}]*)\}/)?.[1] ?? "";

  it("keeps the word an inline box, which is what keeps bidi and line breaking untouched", () => {
    /* An inline-block is a neutral object to the bidi algorithm and a break
       opportunity on each side: #110's ADUHEY NAMXSIRB. */
    expect(word).not.toMatch(/display|white-space|position|unicode-bidi|direction/);
  });

  it("rests at full ink, so every way out lands on legible prose", () => {
    expect(word).toMatch(/color:\s*rgb\(var\(--ink\)\)/);
    /* Muted is the page's second text colour and never the non-text one. */
    expect(CSS).not.toMatch(/--ink-faint/);
    expect(CSS).toMatch(/color:\s*rgb\(var\(--ink-soft\)\)/);
  });

  it("cancels the animation under each of the three off-switches", () => {
    const off = /\{\s*\.word\s*\{\s*animation:\s*none;\s*\}\s*\}/;
    for (const gate of [
      /@supports not \(animation-timeline: view\(\)\)\s*/,
      /@media \(prefers-reduced-motion: reduce\)\s*/,
    ]) {
      expect(CSS).toMatch(new RegExp(gate.source + off.source));
    }
    expect(CSS).toMatch(/:global\(body\.motion-paused\) \.word\s*\{\s*animation:\s*none;\s*\}/);
  });

  it("names no delay and no duration, because the range is the clock", () => {
    expect(CSS).not.toMatch(/animation-(delay|duration)/);
    /* The paragraph's clock, not `view()` on the word: an inline box's view
       timeline resolves to its block, so every word would share one
       progress whatever line it was on. */
    expect(word).toMatch(/animation-timeline:\s*--written-clock/);
    expect(CSS).toMatch(/\.written\s*\{[^}]*view-timeline:\s*--written-clock block/);
  });
});
