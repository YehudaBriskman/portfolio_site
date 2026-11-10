import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Written from "@/components/motion/Written";
import { inkAt, inkedAt, PEN_INSETS, PEN_MUTED, penRange, READING, sequence, slotWindow } from "@/components/motion/penClock";

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

  it("mutes an unwritten word, and the muted word is still readable (owner, 2026-11-03)", () => {
    const muted = Number(CSS.match(/--pen-muted:\s*([\d.]+)/)?.[1]);
    expect(muted).toBe(PEN_MUTED);
    /* Readable on every ground prose is set on, computed from the tokens
       (index.css): the ink at this alpha over each ground clears 2.5:1 (the owner asked for it fainter, 2026-11-10;
       it was 4.5:1). */
    const tokens = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const tok = (block: string, name: string) =>
      (block.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`)) ?? []).slice(1).map(Number);
    const light = tokens.slice(tokens.indexOf(":root {"));
    const dark = tokens.slice(tokens.indexOf(":root[data-theme='dark']"));
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const grounds: Array<[string, number[], number[]]> = [
      ["paper", tok(light, "ink"), tok(light, "paper")],
      ["raised paper", tok(light, "ink"), tok(light, "paper-2")],
      ["dark paper", tok(dark, "ink"), tok(dark, "paper")],
      ["dark raised", tok(dark, "ink"), tok(dark, "paper-2")],
      ["panel", tok(light, "panel-ink"), tok(light, "panel")],
    ];
    for (const [name, ink, ground] of grounds) {
      expect(ink, name).toHaveLength(3);
      expect(ground, name).toHaveLength(3);
      const blend = ink.map((v, i) => muted * v + (1 - muted) * ground[i]);
      expect(ratio(blend, ground), name).toBeGreaterThanOrEqual(2.5);
      /* And still a visible step below the ink it is written to. */
      expect(ratio(ink, ground) / ratio(blend, ground), name).toBeGreaterThan(2);
    }
    /* An alpha on the one ink, so it follows `.on-panel` with no second rule;
       never the page's secondary text colour or the non-text one. */
    expect(CSS).not.toMatch(/--ink-soft|--ink-faint/);
    expect(CSS.match(/rgb\(var\(--ink\) \/ var\(--pen-muted\)\)/g)).toHaveLength(2);
  });

  it("writes in the reading window, one pair of numbers for the whole site (owner, 2026-11-03)", () => {
    /* The stylesheet reads the shared custom properties; index.css sets them
       to exactly the TS constant the sequencer and the near-watch use. */
    expect(CSS).toMatch(
      /view-timeline-inset:\s*calc\(var\(--read-to, ([\d.]+)\) \* 100vh\) calc\(\(1 - var\(--read-from, ([\d.]+)\)\) \* 100vh\)/,
    );
    const tokens = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    expect(Number(tokens.match(/--read-from:\s*([\d.]+)/)?.[1])).toBe(READING.from);
    expect(Number(tokens.match(/--read-to:\s*([\d.]+)/)?.[1])).toBe(READING.to);
    const [, to, from] = CSS.match(/--read-to, ([\d.]+)\) \* 100vh\) calc\(\(1 - var\(--read-from, ([\d.]+)/)!;
    expect({ from: Number(from), to: Number(to) }).toEqual(READING);
    expect(PEN_INSETS).toEqual({ top: READING.to, foot: 1 - READING.from });
    /* Starts as the block enters the comfortable zone (65–70% down), not at
       the window's foot; finished by 35–40%. */
    expect(READING.from).toBeGreaterThanOrEqual(0.65);
    expect(READING.from).toBeLessThanOrEqual(0.7);
    expect(READING.to).toBeGreaterThanOrEqual(0.35);
    expect(READING.to).toBeLessThanOrEqual(0.4);
    expect(inkedAt(0)).toBeCloseTo(READING.from);
    expect(inkedAt(1)).toBeCloseTo(READING.to);
    /* The old clocks, for the record: they started at the foot. */
    expect(inkedAt(0, { top: 0.62, foot: 0.05 })).toBeGreaterThan(0.9);
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

  it("reads each word's slice, scaled into the block's turn, and nothing geometric", () => {
    expect(word).toMatch(
      /animation-range:\s*cover calc\(var\(--pen-lead, 0%\) \+ var\(--pen-from, 0%\) \* var\(--pen-span, 1\)\)\s*cover calc\(var\(--pen-lead, 0%\) \+ var\(--pen-to, 100%\) \* var\(--pen-span, 1\)\)/,
    );
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

/*
 * ONE BLOCK AT A TIME, IN DOCUMENT ORDER (owner, 2026-11-03).
 *
 * The sequencer's arithmetic, on layouts like the site's: a column of
 * paragraphs a margin apart (the wall text, a post), a heading-sized gap
 * between sections, a short last block, and two blocks side by side. At
 * every scroll position at most one block is mid-ink, and the blocks finish
 * in document order. The browser half — the same thing measured on the home
 * page and a project page — is `scripts/shoot-aurora-reading.mjs`.
 */
describe("Written, the sequencer", () => {
  const V = 900;
  const column = (tops: number[], h: number) => tops.map((t) => ({ top: t, bottom: t + h }));
  const layouts: Record<string, Array<{ top: number; bottom: number }>> = {
    "a dense column": column([0, 130, 260, 390, 520, 650], 110),
    "sections with gaps": [...column([0, 120], 100), ...column([600, 720, 840], 100), { top: 1600, bottom: 1640 }],
    "one long block": [{ top: 0, bottom: 1400 }],
    "side by side": [...column([0, 0], 200), ...column([400], 80)],
  };

  function windows(blocks: Array<{ top: number; bottom: number }>) {
    return sequence(blocks, V).map((slot, i) => slotWindow(blocks[i], slot, V));
  }

  it.each(Object.entries(layouts))("has at most one block mid-ink at any scroll position: %s", (_, blocks) => {
    const w = windows(blocks);
    const lo = Math.min(...w.map(([a]) => a)) - 50;
    const hi = Math.max(...w.map(([, b]) => b)) + 50;
    for (let y = lo; y <= hi; y += 2) {
      const mid = w.filter(([a, b]) => y > a + 1e-6 && y < b - 1e-6).length;
      expect(mid, `at ${y}`).toBeLessThanOrEqual(1);
    }
    /* In document order: each turn starts no earlier than the last ended. */
    w.forEach(([a], i) => i && expect(a).toBeGreaterThanOrEqual(w[i - 1][1] - 1e-6));
    w.forEach(([a, b]) => expect(b).toBeGreaterThan(a));
  });

  it("starts each block as its top reaches the reading line, and is done by its bottom at 38%", () => {
    const blocks = layouts["a dense column"];
    const slots = sequence(blocks, V);
    slots.forEach((slot, i) => {
      const [start, end] = slotWindow(blocks[i], slot, V);
      /* Scroll offset y puts a document position p at p − y in the window. */
      expect((blocks[i].top - start) / V).toBeCloseTo(READING.from, 5);
      expect((blocks[i].bottom - end) / V).toBeGreaterThanOrEqual(READING.to - 1e-6);
      expect(slot.lead).toBeGreaterThanOrEqual(0);
      expect(slot.lead + slot.span).toBeLessThanOrEqual(1 + 1e-9);
    });
  });

  it("keeps a block's whole clock when nothing follows close below it", () => {
    const [last] = sequence([{ top: 0, bottom: 200 }], V);
    expect(last).toEqual({ lead: 0, span: 1 });
    const gaps = sequence(layouts["sections with gaps"], V);
    expect(gaps.at(-1)).toEqual({ lead: 0, span: 1 });
  });
});
