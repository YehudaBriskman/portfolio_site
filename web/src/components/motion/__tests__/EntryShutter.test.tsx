import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import EntryShutter from "@/components/motion/EntryShutter";
import { getEntry, resetEntryForTests } from "@/components/motion/entry";
import { CEILING_MS, HARD_CAP_MS, routeFallbackMounted } from "@/components/motion/shutterReadiness";
import { MOTION_PAUSED_KEY } from "@/components/nav/usePauseSwitch";

/*
 * The shutter is two things a test can see and one it cannot.
 *
 * What it can see is the part that matters most: whether the overlay is in
 * the document at all. All three off-switches resolve to *no loader* rather
 * than to a fast one, and the only way to say that is `null` — so the
 * component's own branch is testable in a way a stylesheet exit never is, and
 * it is pinned three times here, once per route in.
 *
 * It can also see the grid: how many tiles there are for a given window, and
 * the one delay each of them carries. That number is the whole of the radial
 * order, and it is computed in pixels rather than in rows and columns — a
 * distinction with a test below that fails for either implementation and
 * passes for only one of them.
 *
 * What it cannot see is the dissolve. jsdom lays out no CSS and runs no
 * animations, so the two stylesheet exits are read as text, which is the same
 * instrument `HeroArrival.test.tsx` uses and for the same reason: there is no
 * computed style to interrogate and, for those two rules, no JavaScript branch
 * to drive. The assertions that no animation is declared before the sheet is
 * leaving, and that nothing is promoted with `will-change`, are the LCP
 * argument in `EntryShutter.module.css` written as a check — because what
 * that argument is protecting is a measured 140ms first paint, and a stray
 * `animation` on `.tile` would promote 260 compositor layers into the frame
 * being measured without breaking a single pixel of the effect.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHUTTER_CSS = readFileSync(resolve(HERE, "../EntryShutter.module.css"), "utf8");

/*
 * The stylesheet with every comment removed.
 *
 * Not tidiness. That file argues at length about the rules it deliberately
 * does *not* contain — `will-change`, an `@supports` block, the
 * animation-plus-arrived-state shape §4 prescribes — and an assertion
 * searching the raw text would find those words in the prose explaining their
 * absence and pass for the wrong reason.
 */
const CSS = SHUTTER_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every rule in the sheet, as selector/body pairs, braces unnested. */
function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: match[1].trim(), body: match[2] });
  }
  return out;
}

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

const REDUCED = "(prefers-reduced-motion: reduce)";

/** The window the shutter is covering, which it reads once at first render. */
function viewport(width: number, height: number) {
  for (const [prop, value] of [
    ["innerWidth", width],
    ["innerHeight", height],
  ] as const) {
    Object.defineProperty(window, prop, { value, writable: true, configurable: true });
  }
}

/** A reader with the OS preference set, which jsdom has no notion of. */
function prefersReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

/*
 * A `localStorage` for a jsdom that has none.
 *
 * This environment exposes the `Storage` constructor and no instance of it,
 * so `window.localStorage` is `undefined` rather than a store that answers
 * null. That is in fact one of the two cases the component guards — a thrown
 * read is not an answer of "paused" — but it leaves the stored-preference
 * route untestable, so it is stubbed with a real one for the tests that need
 * to put something in it.
 */
function installStorage(): Storage {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
  return storage;
}

/**
 * Mounted, and one frame on — which is where the tiles are.
 *
 * The first commit is deliberately one empty sheet: all 260 tiles in it cost
 * +60ms of LCP at 4x CPU, measured, so they are rendered on the next frame
 * instead. Every assertion about the grid is therefore an assertion about
 * frame two, and a test that read the DOM straight after `render` would be
 * reading the one frame that is supposed to be empty.
 */
async function mounted(): Promise<Element | null> {
  const { container } = render(<EntryShutter />);
  await frames(1);
  return container.firstElementChild;
}

const delays = (root: Element) =>
  [...root.children].map((tile) =>
    Number((tile.getAttribute("style") ?? "").replace(/[^0-9.]/g, ""))
  );

/**
 * `n` animation frames, each with a commit after it.
 *
 * One `advanceTimersByTime(3 frames)` does not do this, and the reason is
 * worth stating once: the frame callbacks all run inside that single advance,
 * but React only commits the state they set when `act` returns — so the
 * effect that would have armed the *next* frame has not run yet, and the
 * sequence stalls one step in. The component moves one phase per painted
 * frame, and a test of it has to advance the same way.
 *
 * 16ms is a frame at 60Hz, which is the interval the fake clock runs
 * `requestAnimationFrame` at.
 */
async function frames(n: number) {
  for (let i = 0; i < n; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
  }
}

/*
 * A tile's `animationend`. jsdom has no `AnimationEvent`, so React listens
 * for the prefixed `webkitAnimationEnd` there and for `animationend` in a
 * browser; both are sent so the test does not depend on which.
 */
function animationEnd(el: Element) {
  el.dispatchEvent(new Event("animationend", { bubbles: true }));
  el.dispatchEvent(new Event("webkitAnimationEnd", { bubbles: true }));
}

beforeEach(() => {
  viewport(1440, 900);
  installStorage();
  /* The entry is decided once a visit (`motion/entry.ts`); each test is a
     visit of its own. */
  resetEntryForTests();
});

/** The page's own content: what the shutter waits for besides fonts and images. */
function putContentOnPage() {
  document.body.insertAdjacentHTML("beforeend", '<main data-test-content><h1>Hello</h1></main>');
}

afterEach(() => {
  document.querySelectorAll("[data-test-content]").forEach((n) => n.remove());
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.classList.remove("motion-paused");
  Reflect.deleteProperty(window, "localStorage");
});

describe("whether the shutter is there at all", () => {
  it("is absent for a reader who asked for reduced motion", () => {
    prefersReducedMotion(true);

    const { container } = render(<EntryShutter />);

    /* Not hidden, not instant — absent. The arrived state of this device is
       the page with nothing over it, and `null` is the only exit that lands
       there without a frame of black on the way. */
    expect(container).toBeEmptyDOMElement();
  });

  it("is absent while Pause is on", () => {
    document.body.classList.add("motion-paused");

    const { container } = render(<EntryShutter />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is absent for a returning reader whose Pause choice is only in storage", () => {
    /*
     * The case this component reads the key for.
     *
     * `usePauseSwitch` restores the stored preference in an *effect*, so the
     * class is not on the body during the first render. Every other motion
     * component accepts that and pays one frame of motion for it; one frame of
     * a letter moving is nothing, and one frame of the whole window going
     * black is not.
     */
    localStorage.setItem(MOTION_PAUSED_KEY, "1");

    const { container } = render(<EntryShutter />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still runs when storage cannot be read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("site data blocked");
    });

    const { container } = render(<EntryShutter />);

    /* Private browsing is not a request for no motion, and a thrown read is
       not an answer of "paused". */
    expect(container.firstElementChild).not.toBeNull();
  });
});

describe("the grid", () => {
  /* `mounted` advances a frame, and a fake clock is how a frame is advanced
     without waiting for one. */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /** The two track lists the sheet is laid out with, as numbers of pixels. */
  function trackSizes(root: Element | null): { cols: number[]; rows: number[] } {
    const style = root?.getAttribute("style") ?? "";
    const read = (name: string) =>
      (new RegExp(`${name}:\\s*([^;]+)`).exec(style)?.[1] ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((px) => Number(px.replace("px", "")));
    return { cols: read("--col-tracks"), rows: read("--row-tracks") };
  }

  it("scales its square count with the window", async () => {
    viewport(1440, 900);
    const wide = trackSizes(await mounted());
    expect([wide.cols.length, wide.rows.length]).toEqual([20, 13]);

    viewport(390, 844);
    const narrow = await mounted();
    expect(trackSizes(narrow).cols).toHaveLength(5);
    expect(trackSizes(narrow).rows).toHaveLength(12);
    expect(narrow?.children).toHaveLength(5 * 12);
  });

  it("puts one sheet and no tiles in the first commit", () => {
    /*
     * The measured one. 260 tiles in React's first commit cost +60ms of LCP
     * at 1440x900 under 4x CPU throttling, interleaved A/B against the same
     * page without the shutter — so the frame the page is painted on carries
     * one element, and the tiles arrive on the next. The black for that frame
     * is the sheet's own pseudo-element, which jsdom cannot see and
     * `EntryShutter.module.css` is where it is argued.
     */
    viewport(1440, 900);
    const { container } = render(<EntryShutter />);

    expect(container.firstElementChild).toHaveAttribute("data-state", "ground");
    expect(container.firstElementChild?.children).toHaveLength(0);
  });

  it("divides the window into whole pixels that add back up to it", async () => {
    /*
     * The fix for a grid of uneven line weight, and the reason it is not
     * `repeat(n, 1fr)`. A fractional track puts some boundaries on a whole
     * device pixel and some between two, and a hairline is crisp on the first
     * and antialiased at half alpha on the second — three bright rules across
     * an otherwise even grid, for no reason the eye can name.
     *
     * Both halves are asserted: every track whole, and the total exact. A
     * rounding scheme that floors each track independently satisfies the
     * first and loses up to 19 pixels of cover at the right edge, which is a
     * strip of the lit page showing down the side of the shutter.
     */
    viewport(1440, 900);
    const { cols, rows } = trackSizes(await mounted());

    for (const size of [...cols, ...rows]) expect(Number.isInteger(size)).toBe(true);
    expect(cols.reduce((a, b) => a + b, 0)).toBe(1440);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(900);
  });

  it("starts at the centre and nowhere later than the spread", async () => {
    viewport(1440, 900);
    const root = await mounted();
    expect(root).not.toBeNull();
    if (!root) return;

    const ms = delays(root);
    /* 20 columns and 13 rows: the middle row is a row, and the middle column
       falls between two of them, so the two innermost tiles of row 6 tie for
       first and either is the minimum. */
    const centre = 6 * 20 + 9;

    expect(Math.min(...ms)).toBe(ms[centre]);
    expect(ms[centre]).toBe(ms[centre + 1]);
    /* 420ms is the whole width of the wave. Nothing may be slower, because
       the sheet's unmount is a clock set against that number and a tile
       outside it would be cut off mid-dissolve. */
    expect(Math.max(...ms)).toBeLessThanOrEqual(420);
  });

  it("is symmetrical, so the four corners leave together", async () => {
    viewport(1440, 900);
    const root = await mounted();
    expect(root).not.toBeNull();
    if (!root) return;

    const ms = delays(root);
    const [cols, rows] = [20, 13];
    const corners = [0, cols - 1, (rows - 1) * cols, rows * cols - 1].map((i) => ms[i]);

    /* The check that the distance is measured from each tile's *centre*. An
       implementation that took a tile's top-left corner instead is off by
       half a cell in both axes, which is invisible to the eye and shows up
       here as four different numbers. */
    expect(new Set(corners).size).toBe(1);
  });

  it("measures the radius in pixels and not in rows and columns", async () => {
    /*
     * The one assertion that separates the two implementations.
     *
     * At 390x844 the grid is 5 by 12, so a cell is 78 wide and 70.33 tall.
     * These two tiles are exactly the same distance from the centre *in
     * cells* — two and a half, one of them two columns and one and a half
     * rows out, the other two and a half rows straight up — and they are not
     * the same distance from it in pixels, because the cells are not square.
     *
     * A radial order computed in grid coordinates gives them the same delay
     * and makes the wave an ellipse on every window that is not made of
     * squares, which is nearly every window. This is the test that fails for
     * that version.
     */
    viewport(390, 844);
    const root = await mounted();
    expect(root).not.toBeNull();
    if (!root) return;

    const ms = delays(root);
    const at = (col: number, row: number) => ms[row * 5 + col];

    expect(at(4, 7)).not.toBe(at(2, 8));
    /* And the one further out in pixels is the one that goes later. */
    expect(at(4, 7)).toBeGreaterThan(at(2, 8));
  });
});

describe("the leaving", () => {
  beforeEach(putContentOnPage);

  it("goes as soon as the page is ready, and takes itself out of the document", async () => {
    vi.useFakeTimers();
    const { container } = render(<EntryShutter />);

    expect(container.firstElementChild).toHaveAttribute("data-state", "ground");

    /* jsdom has no `document.fonts` and lays out no images, so readiness here
       is the empty case: it settles on the next microtask. That is the warm
       cache, and it is supposed to be this short — a returning reader sees a
       flicker of the grid or nothing at all. */
    /* One frame puts the tiles in, and two more are the component waiting for
       the page behind them to have actually painted. */
    await frames(3);

    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(820);
    });

    /* Gone from the document and not merely transparent, which is what makes
       the sheet's `pointer-events` and `z-index: 200` facts about one second
       of the visit rather than about the rest of it. */
    expect(container).toBeEmptyDOMElement();
  });

  it("tells the page when it starts to lift, when the window is clear, and when it is gone (#194)", async () => {
    /*
     * The hero's arrival waits on this and on nothing else. The signal has to
     * go out with the `leaving` commit itself — not on a guessed delay, and
     * not at `gone`, 820ms later, when the centre of the window has long been
     * uncovered.
     */
    vi.useFakeTimers();
    const lifting = vi.fn();
    window.addEventListener("entry:lifting", lifting);
    const { container } = render(<EntryShutter />);

    expect(getEntry()).toBe("covered");
    expect(document.documentElement.dataset.entry).toBe("covered");

    await frames(1);
    expect(container.firstElementChild).toHaveAttribute("data-state", "grid");
    expect(getEntry()).toBe("covered");

    await frames(2);
    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");
    expect(getEntry()).toBe("lifting");
    expect(document.documentElement.dataset.entry).toBe("lifting");
    expect(lifting).toHaveBeenCalledTimes(1);

    /* The last tile to leave is the one at the largest delay — a corner —
       and its `animationend` says the window is clear. jsdom runs no CSS, so
       the event is fired by hand on exactly that tile; any other tile's end
       says nothing. */
    const tiles = [...container.querySelectorAll<HTMLElement>("span")];
    const delays = tiles.map((t) => Number.parseInt(t.style.getPropertyValue("--tile-delay"), 10));
    const last = delays.indexOf(Math.max(...delays));
    act(() => {
      animationEnd(tiles[0]);
    });
    expect(getEntry()).toBe(last === 0 ? "clearing" : "lifting");
    act(() => {
      animationEnd(tiles[last]);
    });
    expect(getEntry()).toBe("clearing");
    expect(document.documentElement.dataset.entry).toBe("clearing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(820);
    });
    expect(container).toBeEmptyDOMElement();
    expect(getEntry()).toBe("lifted");
    window.removeEventListener("entry:lifting", lifting);
  });

  it("starts the entry lifted when there is no shutter to wait for", () => {
    document.body.classList.add("motion-paused");
    const { container } = render(<EntryShutter />);

    /* Nothing covers the page, so nothing on it may be held for a cover. */
    expect(container).toBeEmptyDOMElement();
    expect(getEntry()).toBe("lifted");
    expect(document.documentElement.dataset.entry).toBe("lifted");
  });

  it("goes anyway when readiness never settles", async () => {
    /*
     * §4's fourth exit, the one no stylesheet can see. A font set that never
     * resolves, an image event that never arrives, a tab backgrounded at the
     * wrong moment — any of them is a black window with no way out unless
     * something is counting. With the content there, CEILING_MS is the
     * deadline for the polish; it is the deadline for the *page*, not for the
     * animation.
     */
    vi.useFakeTimers();
    Object.defineProperty(document, "fonts", {
      value: { ready: new Promise<void>(() => {}) },
      configurable: true,
    });

    const { container } = render(<EntryShutter />);

    await frames(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    /* Past the frame the tiles arrive on and nowhere near the deadline: the
       sheet is up, drawn, and waiting on a promise that will not settle. */
    expect(container.firstElementChild).toHaveAttribute("data-state", "grid");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CEILING_MS - 1000 + 100);
    });
    await frames(2);
    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");

    Reflect.deleteProperty(document, "fonts");
  });

  it("does not run the tiles over a route whose chunk has not arrived", async () => {
    vi.useFakeTimers();
    const release = routeFallbackMounted();
    const { container } = render(<EntryShutter />);

    await frames(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CEILING_MS + 1000);
    });
    /* Past the soft ceiling and still covered: content is not given up on. */
    expect(container.firstElementChild).toHaveAttribute("data-state", "grid");

    release();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await frames(2);
    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");
  });

  it("waits for the heading even when the chunk has resolved", async () => {
    vi.useFakeTimers();
    document.querySelectorAll("[data-test-content]").forEach((n) => n.remove());
    const { container } = render(<EntryShutter />);

    await frames(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(container.firstElementChild).toHaveAttribute("data-state", "grid");

    putContentOnPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await frames(2);
    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");
  });

  it("fades the sheet, with no tiles leaving, when the content never arrives", async () => {
    vi.useFakeTimers();
    const release = routeFallbackMounted();
    const { container } = render(<EntryShutter />);

    await frames(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HARD_CAP_MS + 100);
    });
    expect(container.firstElementChild).toHaveAttribute("data-state", "fading");
    expect(document.documentElement.dataset.entry).toBe("lifting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(container).toBeEmptyDOMElement();
    expect(getEntry()).toBe("lifted");
    release();
  });

  it("treats an image that errored as settled", async () => {
    vi.useFakeTimers();
    document.querySelector("[data-test-content]")!.insertAdjacentHTML("beforeend", '<img alt="" src="x.png">');
    const img = document.querySelector<HTMLImageElement>("[data-test-content] img")!;
    Object.defineProperty(img, "complete", { value: false, configurable: true });
    img.getBoundingClientRect = () => ({ width: 10, height: 10, top: 0, bottom: 10 }) as DOMRect;

    const { container } = render(<EntryShutter />);
    await frames(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(container.firstElementChild).toHaveAttribute("data-state", "grid");

    /* A broken image is `complete` once it has errored. */
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await frames(2);
    expect(container.firstElementChild).toHaveAttribute("data-state", "leaving");
  });

  it("announces nothing and holds nothing anyone can reach", async () => {
    vi.useFakeTimers();
    const root = await mounted();
    const container = root?.parentElement;

    expect(root).toHaveAttribute("aria-hidden", "true");
    /* No `role`, no `aria-busy`, no live region: the shutter is not a loading
       message, it is the absence of the page, and it reports no progress
       because it measures none. */
    expect(root).not.toHaveAttribute("role");
    expect(container?.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });
});

describe("the shutter's stylesheet", () => {
  it("fades the whole sheet in one opacity transition and runs no animation for it", () => {
    const fading = rules(CSS).find((r) => r.selector === '.shutter[data-state="fading"]');
    expect(fading?.body).toMatch(/opacity:\s*0/);
    expect(fading?.body).toMatch(/transition:\s*opacity 200ms/);
    expect(fading?.body).not.toMatch(/animation/);
  });

  it("resolves to no loader under each of the two conditions it can see", () => {
    const reduced = mediaBlock(CSS, REDUCED);
    expect(reduced).toMatch(/display:\s*none/);

    const paused = rules(CSS).filter((r) => r.selector.includes("motion-paused"));
    expect(paused).toHaveLength(1);
    expect(paused[0].body).toMatch(/display:\s*none/);

    /*
     * `display: none` and not §4's animation-plus-arrived-state shape, which
     * is for an element that is part of the page and has to end up visible.
     * Restating "the tiles are transparent" would leave a fixed sheet over
     * the whole document waiting on a timeout to take it away.
     */
    for (const exit of [reduced, paused[0].body]) {
      expect(exit).not.toMatch(/opacity:\s*0/);
    }
  });

  it("declares no animation until the sheet is leaving", () => {
    const animated = rules(CSS).filter((r) => /animation:/.test(r.body));

    expect(animated.length).toBeGreaterThan(0);
    for (const rule of animated) {
      /* The LCP argument as a check. 260 opacity-and-transform animations
         declared on the tiles from the start are 260 compositor layers
         promoted in the first painted frame — which is the frame the page's
         140ms first paint is measured on — and the effect would look
         identical, so nothing but this would catch it. */
      expect(rule.selector, `unguarded animation on "${rule.selector}"`).toContain(
        '[data-state="leaving"]'
      );
    }
  });

  it("promotes nothing early", () => {
    expect(CSS).not.toMatch(/will-change/);
  });

  it("names no scroll timeline, so it needs no @supports block", () => {
    /* §4: a component with no scroll timeline has no feature for a browser to
       be missing, and the `@supports` block is cargo cult. The absence stays
       correct rather than merely being correct today, because a rule that
       introduced a view timeline here would fail this. */
    expect(CSS).not.toMatch(/animation-timeline/);
    expect(CSS).not.toMatch(/@supports/);
  });
});
