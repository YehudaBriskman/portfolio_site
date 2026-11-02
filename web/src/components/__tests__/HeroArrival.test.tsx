import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Hero from "@/components/Hero";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import HeroCorners from "@/components/HeroCorners";
import { heroCorners, heroTitle } from "@/components/heroFirstScreen";
import { contact, plate, plateTitles } from "@/data/site";

/*
 * The first screen's arrival is a sequencer, two stylesheets and a split
 * name, and vitest can see exactly one of those three run. jsdom lays out no
 * CSS — the modules are not even processed into rules — so what is pinned
 * here is the contract around the motion rather than the motion itself: the
 * hooks each stylesheet selects on, the markup the split produces, and the
 * off-switches, which are the part of a motion component that is equally
 * invisible when it works and when it does not. The ordering of the stages
 * is `motion/__tests__/useStagedArrival.test.tsx`, which is where the
 * waiting lives.
 *
 * The off-switch assertions read the stylesheets as text, which is unusual
 * for this repo and is the only instrument there is: no computed style to
 * interrogate and, for those two files, no JavaScript branch to drive. Every
 * one of them is a failure `docs/motion-contract.md` §4 exists to describe —
 * a reduced-motion reader left looking at a sheet of paper over the name, a
 * Pause toggle that leaves the navigation bar above the top of the window,
 * an exit that lands on frame zero instead of on the finished page.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ARRIVAL_CSS = readFileSync(resolve(HERE, "../HeroArrival.module.css"), "utf8");
const CHROME_CSS = readFileSync(resolve(HERE, "../hero-chrome.css"), "utf8");
const CORNERS_CSS = readFileSync(resolve(HERE, "../HeroCorners.module.css"), "utf8");
const INDEX_HTML = readFileSync(resolve(HERE, "../../../index.html"), "utf8");

/*
 * A stylesheet with every comment removed.
 *
 * Not tidiness: both files argue at length about the rules they do *not*
 * contain — `animation-play-state`, an `@supports` block, a clip, a fade —
 * and an assertion that searched the raw text would find those words in the
 * prose explaining their absence and pass for the wrong reason.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const ARRIVAL = strip(ARRIVAL_CSS);
const CHROME = strip(CHROME_CSS);
const CORNERS = strip(CORNERS_CSS);

/** The body of the first `@media` block whose condition matches, braces balanced. */
function mediaBlock(css: string, condition: string): string {
  const at = css.indexOf(`@media ${condition}`);
  expect(at, `no @media ${condition} block`).toBeGreaterThan(-1);

  let depth = 0;
  for (let i = css.indexOf("{", at); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced @media ${condition}`);
}

/** Every top-level rule keyed off the Pause class. */
function pausedRules(css: string): string[] {
  return css.match(/[^{}]*motion-paused[^{]*\{[^}]*\}/g) ?? [];
}

const REDUCED = "(prefers-reduced-motion: reduce)";

/*
 * The strings the plate is currently set with, read the way `Hero` reads them.
 *
 * Hard-coded "Yehuda Briskman" here until issue #100; the `h1` is now one of
 * three candidates and the suite has to assert the split's invariants against
 * whichever one is in force rather than against one spelling of one of them.
 * What keeps that from asserting nothing is the pair of concrete assertions
 * below it: the chosen candidate is pinned by name, and the one thing that
 * must be true of every candidate — that the person's name is still somewhere
 * on the first screen — is asserted as a string.
 */
const TITLE = heroTitle === "name" ? { name: plate.name, fact: plate.fact } : plateTitles[heroTitle];
const LETTERS = [...TITLE.name].filter((c) => c !== " ").length;
const WORDS = TITLE.name.split(" ");

afterEach(() => {
  delete document.body.dataset.heroArrived;
});

describe("the first screen's hooks", () => {
  it("states every field kind its stylesheet animates", () => {
    render(<Hero />);

    /* The three per-kind rules in the previous arrival were keyed to these
       three strings; the sequence replaced them, but `exposeFieldKinds` is
       still on because the off-switches reach the fields through it. A plate
       that swapped a field for another kind would render a field no exit
       could restate, in a stylesheet that still compiles. */
    for (const kind of ["where", "count", "when"]) {
      expect(document.querySelector(`li[data-kind="${kind}"]`)).not.toBeNull();
    }
  });

  it("renders the four parts the stylesheets reach for", () => {
    const { container } = render(<Hero />);
    const stage = container.querySelector("[data-arrived]");

    /* Every one of these is a selector into markup this file does not own —
       three of them into `ObjectLabel`, which is shared with every object on
       the site — so each is pinned here rather than discovered in a browser
       later. */
    expect(stage).not.toBeNull();
    expect(stage?.querySelector("h1")).not.toBeNull();
    expect(stage?.querySelectorAll("h1 + p").length).toBe(1);
    expect(stage?.querySelectorAll("ul").length).toBe(1);
    expect(stage?.querySelectorAll("[data-letter]").length).toBeGreaterThan(1);
    expect(stage?.querySelectorAll("[data-letter-last]").length).toBe(1);
    expect(stage?.querySelector("[data-portrait] img")).not.toBeNull();
    expect(stage?.querySelector("[data-portrait-mask]")).not.toBeNull();
  });

  it("waits for the last letter and for the mask, by the selectors it animates", () => {
    const { container } = render(<Hero />);

    /* The sequencer's gates and the stylesheet's rules have to be naming the
       same elements. They are written in two different files in two
       different languages, and nothing but this connects them: a gate that
       names an element the stylesheet never animates waits out its seatbelt
       every time, which looks exactly like a slow sequence. */
    for (const gate of ["[data-letter-last]", "[data-portrait-mask]"]) {
      expect(container.querySelector(gate)).not.toBeNull();
    }
    expect(ARRIVAL).toContain("[data-letter]");
    expect(ARRIVAL).toContain(".mask");
    expect(CHROME).toContain("header[data-material]");
  });

  it("publishes the sequence on the body, for the one stage outside the tree", () => {
    render(<Hero />);

    /* The bar is `position: fixed` and is rendered by a sibling of this
       section. `hero-chrome.css` keys off the body because there is nothing
       else both of them can see. */
    expect(document.body.dataset.heroArrived).toBe("name");
    expect(CHROME).toContain("body[data-hero-arrived]");
  });

  it("puts the whole screen in the document whether or not it has arrived", () => {
    render(<Hero />);

    /* This is a reveal and not a conditional render. A reader with no
       motion, a crawler with no JavaScript and a browser mid-sequence are
       all reading the same three statements and looking at the same
       photograph. */
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(TITLE.fact)).toBeInTheDocument();
    expect(screen.getByText("Israel")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("gives the photograph a description and the right shape", () => {
    render(<Hero />);
    const img = screen.getByRole("img");

    /* A real `alt`, because the figure is half of what this screen says. An
       empty one would be the honest choice for decoration and this is not
       decoration. */
    expect(img.getAttribute("alt")).toMatch(/Yehuda Briskman/);
    expect((img.getAttribute("alt") ?? "").length).toBeGreaterThan(40);

    /* Intrinsic dimensions, so the box is the right shape before the bytes
       arrive. This is half of why the first screen does not shift with a
       photograph on it; the other half is that the figure's grid track is
       sized by subtraction, so its contents cannot change the track.

       551x845 is the cut-out photograph. It was briefly 560x808, the
       halftone drawing that replaced it, and the owner asked for the
       photograph back on sight — so these two numbers are the asset's and
       have to move with it. A width/height pair left behind after an asset
       swap is a layout shift that no test on this page would otherwise
       catch. */
    expect(img.getAttribute("width")).toBe("551");
    expect(img.getAttribute("height")).toBe("845");
  });
});

describe("the name, split into letters", () => {
  it("reads as one string to a screen reader", () => {
    render(<Hero />);

    /* The accessible name is the one thing the split could quietly break,
       and the one thing nothing on screen would show. */
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(TITLE.name);
  });

  it("copies as one string, with the spaces it always had", () => {
    render(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });

    /* The spans add no characters, and the space between the words is a real
       text node rather than a gap or a margin — so a selection dragged
       across the name yields the name. */
    expect(h1.textContent).toBe(TITLE.name);
  });

  it("makes every word one box, so a name cannot break mid-word", () => {
    const { container } = render(<Hero />);
    const words = container.querySelectorAll("[data-word]");

    /* Once the letters are boxes, every one of them is a break opportunity.
       Without the word box, "BRISKMAN" can set as four lines on a phone —
       which is the failure the type rung below 700px exists to prevent and
       would have been reintroduced underneath it. */
    expect(words.length).toBe(WORDS.length);
    expect([...words].map((w) => w.textContent)).toEqual(WORDS);
  });

  it("numbers the letters across the whole name, not within each word", () => {
    const { container } = render(<Hero />);
    const letters = [...container.querySelectorAll<HTMLElement>("[data-letter]")];

    /* The cascade is one run in reading order. A per-word counter would
       restart it at the space, and the two words would fall at once. */
    expect(letters.length).toBe(LETTERS);
    expect(letters.map((l) => l.style.getPropertyValue("--letter"))).toEqual(
      Array.from({ length: LETTERS }, (_, i) => String(i))
    );
    expect(letters.at(-1)?.hasAttribute("data-letter-last")).toBe(true);
    expect(letters.filter((l) => l.hasAttribute("data-letter-last")).length).toBe(1);
  });

  it("keeps the letters in reading order when the document turns around", () => {
    const { container } = render(<Hero />);
    const h1 = container.querySelector("h1");
    const label = readFileSync(
      resolve(HERE, "../gallery/ObjectLabel.module.css"),
      "utf8"
    );

    /*
     * The split turns a name into one atomic inline-level box per letter, and
     * the bidi algorithm treats an atomic box as a neutral object — so in an
     * RTL paragraph the run is laid out right to left and the title plate
     * rendered YEHUDA BRISKMAN as ADUHEY NAMXSIRB. The fix is one declaration
     * on the element that holds the boxes, and it is only correct while every
     * name on this site is Latin: the day one is written in Hebrew it has to
     * become conditional on the name rather than on the split.
     *
     * jsdom lays out no CSS, so what is pinned is the pair — the class is on
     * the split name, and the class carries the direction.
     */
    const cls = [...(h1?.classList ?? [])].find((c) => c.includes("split"));
    expect(cls, "no split class on the split name").toBeDefined();
    expect(strip(label)).toMatch(/\.split \{[^}]*direction: ltr/);
  });

  it("leaves every other label on the site a single text node", () => {
    const { container } = render(
      <ObjectLabel name="Bothy" fact="A console." fields={[{ kind: "where", value: "npm" }]} />
    );

    /* `splitName` is opt-in for the same reason `exposeFieldKinds` is: every
       project and every note goes through this component on the default, and
       a name that silently became fourteen elements would change the markup
       of the whole collection to suit one screen. */
    expect(container.querySelectorAll("[data-letter]").length).toBe(0);
    expect(container.querySelectorAll("[data-word]").length).toBe(0);
    expect(container.querySelector("h3")?.getAttribute("aria-label")).toBeNull();
    /* And no direction of its own: an unsplit name is a run of strong
       characters and has never needed one. */
    expect(
      [...(container.querySelector("h3")?.classList ?? [])].some((c) => c.includes("split"))
    ).toBe(false);
  });
});

describe("the first screen's off-switches", () => {
  it("cancels every animation outright under reduced motion", () => {
    const block = mediaBlock(ARRIVAL, REDUCED);

    /* `animation: none` and not a shortened duration. The global
       `animation-duration: 0.01ms` in index.css would in fact land these on
       their final frame — they are time-driven — but an exit that depends on
       the animation still being live is one refactor away from depending on
       nothing at all. */
    expect(block).toMatch(/animation: none/);
    expect(block.match(/animation: none/g)?.length).toBe(2);
    for (const part of ["[data-letter]", "[data-portrait] img", "h1 + p", "ul", ".mask"]) {
      expect(block).toContain(part);
    }
  });

  it("lands reduced motion on the finished screen, never on frame zero", () => {
    const block = mediaBlock(ARRIVAL, REDUCED);

    /* Frame zero for the two lines is `opacity: 0`, and frame zero for the
       name and the figure is a sheet of paper over them. An exit that only
       cancelled the animations would leave the first screen blank. */
    expect(block).toMatch(/opacity: 1/);
    expect(block).toMatch(/transform: none/);
    expect(block).toMatch(/transform: scaleY\(0\)/);
  });

  it("lands the Pause toggle on the finished screen too", () => {
    const paused = pausedRules(ARRIVAL);

    /* Pause hangs a class on `document.body`, outside the React tree, which
       is why this is a stylesheet's job and not a component's — and it can
       be hit mid-sequence, so it has to land on arrived rather than on
       whatever frame each animation had reached. */
    expect(paused.length).toBe(2);
    expect(paused.filter((r) => /animation: none/.test(r)).length).toBe(2);
    expect(paused.join("\n")).toMatch(/opacity: 1/);
    expect(paused.join("\n")).toMatch(/transform: none/);
    expect(paused.join("\n")).toMatch(/transform: scaleY\(0\)/);
  });

  it("brings the bar back down under both switches", () => {
    /* The chrome's pre-state is `translateY(-100%)`, which is the one exit
       in this change that hides a navigation bar if it is got wrong. Both
       switches have to cancel the animation *and* restate the transform:
       cancelling alone leaves the pre-state standing and the bar off the top
       of the window for good. */
    const reduced = mediaBlock(CHROME, REDUCED);
    const paused = pausedRules(CHROME);

    for (const block of [reduced, ...paused]) {
      expect(block).toMatch(/animation: none/);
      expect(block).toMatch(/transform: none/);
    }
    expect(paused.length).toBeGreaterThan(0);
  });

  it("keeps the bar reachable by keyboard while it is held above the window", () => {
    /* It is in the document and in the tab order for the whole second or so
       it is out of sight, so a reader tabbing off the skip link could put
       focus on a control nobody can see. */
    expect(CHROME).toMatch(/header\[data-material\]:focus-within\s*\{[^}]*transform: none/);
  });

  it("leaves every page without a hero exactly as it was", () => {
    /* Every rule in the chrome's stylesheet is guarded on the attribute the
       hero publishes, so a page with no hero — or a hero whose sequencer
       never ran — gets the bar it has always had. An unguarded rule here
       would hide the navigation on the whole site. */
    const rules = CHROME.match(/[^{}]+\{[^}]*\}/g) ?? [];
    const onTheBar = rules.filter((r) => /header\[data-material\]/.test(r));
    expect(onTheBar.length).toBeGreaterThan(3);
    for (const rule of onTheBar) {
      expect(rule).toMatch(/body(\.motion-paused)?\[data-hero-arrived[~\]]/);
    }
  });

  it("never reaches for animation-play-state", () => {
    /* §4's named trap. It freezes an animation at the time it has reached,
       which for one that has not started is frame zero — and with
       `fill-mode: both` frame zero here is a sheet of paper over the name.
       "Pause motion" would blank the first screen. */
    expect(ARRIVAL).not.toMatch(/animation-play-state/);
    expect(CHROME).not.toMatch(/animation-play-state/);
  });

  it("needs no @supports block, and stays the kind of file that does not", () => {
    /* The hero fires on load, so every animation here is time-driven and
       there is no feature for a browser to be missing. §4 calls the block
       cargo cult in that case. This assertion is what keeps the claim true
       rather than merely true today: the day anything here grows a scroll
       timeline, this fails and the third exit has to be written. */
    for (const css of [ARRIVAL, CHROME]) {
      expect(css).not.toMatch(/animation-timeline/);
      expect(css).not.toMatch(/@supports/);
    }
  });
});

describe("what the first screen may not spend", () => {
  it("paints the ink on frame one — nothing above the last stage may fade", () => {
    /*
     * The measured regression this whole technique exists to avoid. The
     * reveal before this one started the `h1` at `opacity: 0`, which takes
     * the largest text on the first screen out of the running as a paint
     * candidate until the animation ends.
     *
     * So the name and the figure arrive by having a paper-coloured mask
     * moved off them, and their keyframes may contain no opacity at all.
     * The two lines in the last stage may: they are 1rem and 0.72rem of
     * secondary ink and the paint candidate was settled a second and a half
     * before they move.
     */
    for (const name of ["plate-letter", "plate-letter-mask", "plate-figure", "plate-figure-mask"]) {
      const frames = ARRIVAL.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
      expect(frames, `no @keyframes ${name}`).not.toBe("");
      expect(frames).not.toMatch(/opacity/);
    }
    expect(ARRIVAL).toMatch(/@keyframes plate-from-start \{[\s\S]*?opacity: 0/);
  });

  it("holds the masks in the ground's own colour, not in a clip", () => {
    /* A clip and a fade are the same bug wearing two hats: an element that
       is clipped away at first paint is not a paint candidate either. What
       makes this work is that an element covered by an opaque sibling is
       still a painted element. */
    expect(ARRIVAL).toMatch(/\[data-letter\]::after \{[\s\S]*?background: rgb\(var\(--paper\)\)/);
    expect(ARRIVAL).toMatch(/\.mask \{[\s\S]*?background: rgb\(var\(--paper\)\)/);
    expect(ARRIVAL).not.toMatch(/clip-path/);
  });

  it("travels sideways only where the section can clip it", () => {
    /*
     * §5 bans horizontal travel, and the ban is a measured one: the deleted
     * `Reveal` pushed full-width sections past the right edge of the
     * document until they fired, so the page reported horizontal overflow
     * with `overflow-x: clip` on the body hiding the scrollbar and not the
     * bug. The owner's direction is that the two remaining lines enter from
     * their own sides, which cannot be done without it — so the guard moves
     * onto the section itself rather than relying on the gutter being wider
     * than the travel.
     */
    const sideways = ARRIVAL.match(/transform: translateX\([^)]*\)/g) ?? [];
    expect(sideways.length).toBeGreaterThan(0);

    const hero = readFileSync(resolve(HERE, "../Hero.module.css"), "utf8");
    expect(strip(hero)).toMatch(/\.hero \{[^}]*overflow-x: clip/);
  });

  it("sizes the figure's track by subtraction, which is why the screen cannot shift", () => {
    const hero = strip(readFileSync(resolve(HERE, "../Hero.module.css"), "utf8"));

    /*
     * This used to assert `position: absolute` on the figure, on the grounds
     * that an out-of-flow box contributes no height and so cannot move a line
     * of type. The composition changed — the figure is centred and standing on
     * the floor of the screen rather than hung off the end of the label — and
     * it is in flow now. The protection did not go away; it moved.
     *
     * The figure is the `1fr` row of a two-row grid whose height is the
     * screen. Its track is what the label did not use, so the track is decided
     * before the photograph is consulted and nothing the photograph does can
     * change it. `min-height: 0` is the half of that which is easy to lose: a
     * grid item's automatic minimum size is its content, so without it the row
     * refuses to shrink below the image's intrinsic height and the figure
     * starts pushing the page down again on a short window.
     *
     * Both halves are asserted because either one alone is not the guarantee.
     */
    expect(hero).toMatch(/\.composition \{[^}]*grid-template-rows: auto 1fr/);
    expect(hero).toMatch(/\.portrait \{[^}]*min-height: 0/);
  });
});

/*
 * What issues #100 and #101 put on the first screen, and the three things
 * that have to stay true whichever candidate the owner picks.
 *
 * This whole block is scaffolding around a decision that has not been made.
 * When it is, the flag collapses to a constant and the first test here — the
 * one that pins which candidate is proposed — is the one that has to be
 * deliberately rewritten rather than quietly passing.
 */
describe("the first screen's proposals", () => {
  it("ships the candidate it recommends, and says so out loud", () => {
    /* Not a tautology: these two constants are the proposal. A change to
       either is a change to what the PR is asking for, and it should not be
       possible to make it by accident while editing a stylesheet. */
    expect(heroTitle).toBe("portfolio");
    expect(heroCorners).toBe("ask");
  });

  it("keeps the person's name on the first screen after it leaves the h1", () => {
    render(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });

    /*
     * The one invariant #100 cannot be allowed to break. `Yehuda Briskman` is
     * the page's accessible name and its strongest on-page signal; a title
     * that says PORTFOLIO has to put it somewhere real rather than nowhere.
     * It is in the fact line, assembled from `plate.name` so it is written
     * once — which is why this asserts the rendered text and not the constant.
     */
    expect(screen.getByText(/Yehuda Briskman/)).toBeInTheDocument();
    if (heroTitle !== "name") expect(h1.textContent).not.toMatch(/Yehuda/);
  });

  it("agrees with the head of the document about who the site is by", () => {
    /*
     * The `h1` is not the only place the name lives, and that is the whole
     * reason moving it out of the `h1` is survivable. If one of these ever
     * starts saying "portfolio" instead of the name, the page and its own
     * head have stopped agreeing and the trade this change made is off.
     */
    for (const tag of [
      "<title>Yehuda Briskman",
      'name="author" content="Yehuda Briskman"',
      'property="og:site_name" content="Yehuda Briskman"',
      '"name": "Yehuda Briskman"',
    ]) {
      expect(INDEX_HTML).toContain(tag);
    }
    expect(INDEX_HTML).not.toMatch(/portfolio/i);
  });

  it("sets each title option so the words it has cannot break mid-word", () => {
    /*
     * The type rungs in `Hero.module.css` are derived from the measured
     * advance width of the *longest unbreakable line* of each string, and
     * `splitName` makes every word one inline-block — so the word count is
     * the thing the derivation rests on. A string that gained a word would
     * silently invalidate a clamp that no test could otherwise see.
     */
    expect(plateTitles.portfolio.name.split(" ")).toHaveLength(1);
    expect(plateTitles.explore.name.split(" ")).toHaveLength(3);
    for (const title of Object.values(plateTitles)) {
      expect(title.fact).toContain(plate.name);
    }
  });

  it("gives every title option a rung derived for its own longest line", () => {
    const hero = strip(readFileSync(resolve(HERE, "../Hero.module.css"), "utf8"));

    /* One rung per proposed string at each of the two breakpoints. The
       default ships `portfolio`, so a missing `explore` rung is a candidate
       that renders at the wrong size only when someone looks at it. */
    for (const which of ["portfolio", "explore"]) {
      expect(hero.match(new RegExp(`\\[data-title="${which}"\\] \\.plate h1`, "g"))).toHaveLength(2);
    }
  });
});

describe("the hero's lower corners", () => {
  it("renders all three candidates, and renders nothing for the bare one", () => {
    /* `bare` is a candidate and not an absence of one, so it is asserted to
       produce no element at all rather than two empty positioned boxes. */
    const { container: ask } = render(<HeroCorners which="ask" />);
    expect(ask.querySelector('[data-hero-corners="ask"]')).not.toBeNull();

    const { container: facts } = render(<HeroCorners which="facts" />);
    expect(facts.querySelector('[data-hero-corners="facts"]')).not.toBeNull();

    const { container: bare } = render(<HeroCorners which="bare" />);
    expect(bare.querySelector("[data-hero-corners]")).toBeNull();
    expect(bare.firstChild).toBeNull();
  });

  it("points the one affordance at the ask plate, not at a blank mail window", () => {
    render(<HeroCorners which="ask" />);
    const link = screen.getByRole("link", { name: /get in touch/i });

    /* `nav/social.ts` argues that a `mailto:` is the worse of the two
       answers because it hands the reader's own mail client an empty
       message. The plate at `#contact` has a form, the address and the
       context to write from. */
    expect(link.getAttribute("href")).toBe("#contact");
    expect(screen.getByText(contact.replyWithin)).toBeInTheDocument();
  });

  it("states facts and never a pitch, in both fact candidates", () => {
    render(<HeroCorners which="facts" />);

    /* The label schema's first rule, which applies to anything that reads as
       a label. Both of these are checkable: one is a job, one is a bound with
       a number in it. */
    expect(screen.getByText(plate.currently)).toBeInTheDocument();
    expect(screen.getByText(contact.replyWithin)).toBeInTheDocument();
  });

  it("uses a description list, so the field line's own rule cannot catch it", () => {
    const { container } = render(<HeroCorners which="facts" />);

    /* `HeroArrival.module.css` reaches the plate's field line as "the only
       `ul` on this screen". A second list set as a `ul` would be animated as
       though it were the plate's specs and left at `opacity: 0` by the field
       line's resting rule. */
    expect(container.querySelectorAll("dl").length).toBe(2);
    expect(container.querySelectorAll("ul").length).toBe(0);
  });

  it("stays out of flow, which is why the figure's track cannot change", () => {
    /* The figure gets whatever row 1 did not use. An in-flow corner block
       would shrink the photograph on the longest string it ever holds, and a
       taller one would change the track it is in. */
    expect(CORNERS).toMatch(/\.corners \{[^}]*position: absolute/);
  });

  it("is written in logical properties, because both corners swap in Hebrew", () => {
    /* `nav/locale.ts` writes `lang` and `dir` together, so the start corner
       is on the right in Hebrew. A physical `left`/`right` here would be a
       statement about English, and the same reasoning is why the arrival is
       a rise rather than an entry from each side. */
    expect(CORNERS).not.toMatch(/(^|[^-])\b(left|right)\s*:/m);
    expect(CORNERS).toMatch(/inset-inline/);
    expect(ARRIVAL).toMatch(/@keyframes plate-corner \{[\s\S]*?translateY/);
  });

  it("joins the sequence, and enters by a paper mask rather than by fading", () => {
    /* A new element on this screen either joins the four stages or is
       deliberately outside them. These join the end of stage four — and they
       take the same opaque-sheet technique the name and the figure take, so
       the claim that nothing on this screen enters by its own opacity stays a
       sentence with one exception in it rather than two. */
    expect(ARRIVAL).toMatch(/\[data-arrived~="text"\] \[data-hero-corners\] > \* \{/);
    for (const name of ["plate-corner", "plate-corner-mask"]) {
      const frames = ARRIVAL.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
      expect(frames, `no @keyframes ${name}`).not.toBe("");
      expect(frames).not.toMatch(/opacity/);
    }
    expect(ARRIVAL).toMatch(/\[data-hero-corners\] > \*::after \{[\s\S]*?background: rgb\(var\(--paper\)\)/);
  });
});
