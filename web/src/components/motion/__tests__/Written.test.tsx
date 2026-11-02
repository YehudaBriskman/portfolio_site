import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Written from "@/components/motion/Written";
import { inkAt, inkedAt, PEN_INSETS, PEN_MUTED, penRange } from "@/components/motion/penClock";

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
      /* Nothing on the word but its class, its marker and its slice of the
         clock: no role, no label — an inline span the accessibility tree
         flattens into its paragraph. */
      expect(w.getAttributeNames().sort()).toEqual(["class", "data-word", "style"]);
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
  });

  it("mutes an unwritten word to texture: the same ink at 22%, never a second text colour (#174)", () => {
    const muted = Number(CSS.match(/--pen-muted:\s*([\d.]+)/)?.[1]);
    expect(muted).toBe(PEN_MUTED);
    /* Texture, not text. 0.22 of --ink over paper is 1.60:1 (below); an
       alpha above about a third would read as grey text again, which is what
       the owner sent back. */
    expect(muted).toBeGreaterThan(0.1);
    expect(muted).toBeLessThanOrEqual(0.3);
    /* An alpha on the one ink, so it follows `.on-panel` with no second rule;
       never the page's secondary text colour or the non-text one. */
    expect(CSS).not.toMatch(/--ink-soft|--ink-faint/);
    expect(CSS.match(/rgb\(var\(--ink\) \/ var\(--pen-muted\)\)/g)).toHaveLength(2);
  });

  it("writes on a clock that finishes before the eye arrives (#174)", () => {
    const [top, foot] = (CSS.match(/view-timeline-inset:\s*(\d+)vh (\d+)vh/) ?? []).slice(1).map(Number);
    /* The stylesheet and the arithmetic agree on the clock. */
    expect({ top: top / 100, foot: foot / 100 }).toEqual(PEN_INSETS);
    /* Every word, first to last, is inked below the window's middle — where
       the next lines are, not where the eye is reading. The old clock (45vh
       15vh) inked the last word at 0.45, and failed this. */
    for (let f = 0; f <= 1; f += 0.05) expect(inkedAt(f)).toBeGreaterThanOrEqual(0.6);
    expect(inkedAt(0)).toBeCloseTo(0.95);
    expect(inkedAt(1)).toBeCloseTo(0.62);
    expect(inkedAt(1, { top: 0.45, foot: 0.15 })).toBeLessThan(0.5);
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

  it("parks a far paragraph at its own fill, and only while the effect is running", () => {
    /* The `below` rule sets a colour, so it must sit inside all three
       conditions; anywhere else it would hold a reader who asked for no
       motion at muted, which no exit below would undo. */
    expect(CSS).toMatch(
      /@supports \(animation-timeline: view\(\)\)\s*\{\s*@media screen and \(prefers-reduced-motion: no-preference\)\s*\{\s*:global\(body:not\(\.motion-paused\)\) \.written\[data-pen="below"\] \.word\s*\{/,
    );
    expect(CSS.match(/data-pen="below"/g)).toHaveLength(1);
    /* Passed is the clock's end, which is ink: the base rule, so no colour. */
    expect(CSS).toMatch(/\.written\[data-pen="above"\] \.word\s*\{\s*animation:\s*none;\s*\}/);
  });

  it("names no delay and no duration, because the range is the clock", () => {
    expect(CSS).not.toMatch(/animation-(delay|duration)/);
    /* The paragraph's clock, not `view()` on the word: an inline box's view
       timeline resolves to its block, so every word would share one
       progress whatever line it was on. */
    expect(word).toMatch(/animation-timeline:\s*--written-clock/);
    expect(CSS).toMatch(/\.written\s*\{[^}]*view-timeline:\s*--written-clock block/);
  });

  it("reads each word's slice and nothing geometric", () => {
    expect(word).toMatch(/animation-range:\s*cover var\(--pen-from, 0%\) cover var\(--pen-to, 100%\)/);
    /* Line-height and band units are what tied the pace to the text's own
       movement (#158); neither may come back into the range. */
    expect(CSS).not.toMatch(/--line|\blh\b|--written-band/);
  });

  it("fills muted before the slice and ink after, so a written word stays written", () => {
    expect(word).toMatch(/animation-fill-mode:\s*both/);
    const frames = CSS.match(/@keyframes written-pen\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(frames).toMatch(/from\s*\{\s*color:\s*rgb\(var\(--ink\) \/ var\(--pen-muted\)\);\s*\}/);
    expect(frames).toMatch(/to\s*\{\s*color:\s*rgb\(var\(--ink\)\);\s*\}/);
  });
});

/*
 * The pen writes ONE WORD AFTER ANOTHER (#158).
 *
 * The bug this pins: the pen used to be placed by geometry — a line's offset
 * plus a fraction of one line-height per word, each word lit for a 14vh band —
 * so about five words were mid-ramp at once and four lines sat at full ink
 * together. Now each word owns the slice i/n..(i+1)/n of its paragraph's
 * clock, and these hold that from the rendered markup, not from a list typed
 * here.
 */
function ownWords(el: Element): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>("[data-word]")].filter(
    (w) => w.parentElement?.closest("[data-written]") === el,
  );
}

function slices(el: Element): Array<[number, number]> {
  return ownWords(el).map((w) => [
    parseFloat(w.style.getPropertyValue("--pen-from")),
    parseFloat(w.style.getPropertyValue("--pen-to")),
  ]);
}

function expectTiled(s: Array<[number, number]>) {
  expect(s[0][0]).toBe(0);
  expect(s.at(-1)![1]).toBe(100);
  s.forEach(([from, to], i) => {
    expect(to).toBeGreaterThan(from);
    /* No gap and no overlap: the pen never pauses and never writes two
       words at once. */
    if (i > 0) expect(from).toBe(s[i - 1][1]);
  });
}

describe("Written, the per-word progression", () => {
  const LONG = Array.from({ length: 57 }, (_, i) => `word${i}`).join(" ");

  it("gives every word its own slice of the clock, in reading order, tiling it exactly", () => {
    for (const text of [ENGLISH, HEBREW, LONG, "one"]) {
      cleanup();
      const el = render(<Written data-testid="w">{text}</Written>).getByTestId("w");
      const s = slices(el);
      expect(s).toHaveLength(text.split(" ").length);
      expectTiled(s);
    }
  });

  it("counts across inline elements in DOM order and leaves code and a nested Written off the clock", () => {
    const el = render(
      <Written data-testid="w">
        Read <a href="/x">the note</a> then <code>npm ci</code> and <em>decide</em>{" "}
        <Written as="div">inner words here</Written>
      </Written>,
    ).getByTestId("w");
    expect(ownWords(el).map((w) => w.textContent)).toEqual(["Read", "the", "note", "then", "and", "decide"]);
    expectTiled(slices(el));
    /* The inner one has a clock of its own, three words long. */
    const inner = el.querySelector("div[data-written]")!;
    expect(slices(inner).map(([a]) => Math.round(a))).toEqual([0, 33, 67]);
  });

  it("has at most one word mid-stroke at any point, with ink before it and muted after", () => {
    for (const n of [1, 2, 7, 15, 34, 150]) {
      for (let step = 0; step <= 1000; step += 1) {
        const p = step / 1000;
        const ink = Array.from({ length: n }, (_, i) => inkAt(p, i, n));
        expect(ink.filter((v) => v > 0 && v < 1).length).toBeLessThanOrEqual(1);
        /* A prefix at ink, then at most one word moving, then muted: never
           a word at ink after a word that is not. */
        const firstNotInk = ink.findIndex((v) => v < 1);
        if (firstNotInk >= 0) expect(ink.slice(firstNotInk + 1).every((v) => v === 0)).toBe(true);
      }
    }
  });

  it("writes word after word as the clock advances, and un-writes in reverse", () => {
    const n = 12;
    const lit = (p: number) => Array.from({ length: n }, (_, i) => inkAt(p, i, n)).filter((v) => v === 1).length;
    const forward = Array.from({ length: n + 1 }, (_, k) => lit(k / n));
    expect(forward).toEqual(Array.from({ length: n + 1 }, (_, k) => k));
    /* Read back down, the same positions give the same counts: the scroll
       is the clock, and the clock has no memory. */
    const back = Array.from({ length: n + 1 }, (_, k) => lit((n - k) / n));
    expect(back).toEqual([...forward].reverse());
  });

  it("renders the same ranges the arithmetic describes", () => {
    expect(penRange(0, 4)).toEqual(["0%", "25%"]);
    expect(penRange(3, 4)).toEqual(["75%", "100%"]);
    expect(penRange(1, 3)).toEqual(["33.3333%", "66.6667%"]);
  });
});
