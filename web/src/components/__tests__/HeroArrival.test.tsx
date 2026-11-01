import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Hero from "@/components/Hero";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import arrival from "@/components/HeroArrival.module.css";

/*
 * The plate's arrival is five keyframe animations in a stylesheet, and jsdom
 * lays out none of it — vitest runs with CSS off, so the module is not even
 * processed into rules. Following the other suites in
 * `components/motion/__tests__`, what is pinned here is the contract around
 * the motion rather than the motion itself: the hooks the stylesheet selects
 * on, and the off-switches, which are the part of a motion component that is
 * equally invisible when it works and when it does not.
 *
 * The off-switch assertions read the stylesheet as text, which is unusual for
 * this repo and is the only instrument there is: no computed style to
 * interrogate, and no JavaScript branch to drive, because the arrival
 * deliberately has neither. Every one of them is a failure
 * `docs/motion-contract.md` §4 exists to describe — a reduced-motion reader
 * left looking at `opacity: 0`, a Pause toggle that blanks the plate, an exit
 * that lands on frame zero instead of on the finished page.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ARRIVAL_CSS = readFileSync(resolve(HERE, "../HeroArrival.module.css"), "utf8");

/*
 * The stylesheet with every comment removed.
 *
 * Not tidiness: this file argues at length about the rules it does *not*
 * contain — `animation-play-state`, an `@supports` block, a mask — and an
 * assertion that searched the raw text would find those words in the prose
 * explaining their absence and pass for the wrong reason.
 */
const RULES = ARRIVAL_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of the first `@media` block whose condition matches, braces balanced. */
function mediaBlock(condition: string): string {
  const at = RULES.indexOf(`@media ${condition}`);
  expect(at, `no @media ${condition} block`).toBeGreaterThan(-1);

  let depth = 0;
  for (let i = RULES.indexOf("{", at); i < RULES.length; i += 1) {
    if (RULES[i] === "{") depth += 1;
    else if (RULES[i] === "}") {
      depth -= 1;
      if (depth === 0) return RULES.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced @media ${condition}`);
}

/** Every top-level rule keyed off the Pause class. */
function pausedRules(): string[] {
  return RULES.match(/:global\(body\.motion-paused\)[^{]*\{[^}]*\}/g) ?? [];
}

describe("the title plate's hooks", () => {
  it("states every field kind its stylesheet animates", () => {
    render(<Hero />);

    /* The three per-kind rules are keyed to these three strings. A plate that
       swapped a field for another kind would render a field with no arrival
       at all, in a stylesheet that still compiles and a browser that reports
       nothing wrong — which is the exact failure `data-kind` exists to make
       impossible to introduce silently. */
    for (const kind of ["where", "count", "when"]) {
      expect(ARRIVAL_CSS).toContain(`[data-kind="${kind}"]`);
      expect(document.querySelector(`li[data-kind="${kind}"]`)).not.toBeNull();
    }
  });

  it("renders the three parts the stylesheet reaches for", () => {
    const { container } = render(<Hero />);
    const label = container.querySelector(`.${arrival.arrive}`);

    /* The name is reached as `h1` and the fact line as the label's single
       direct `<p>`. Both are selectors into another component's markup, so
       both are pinned here rather than discovered in a browser later. */
    expect(label).not.toBeNull();
    expect(label?.querySelector("h1")).not.toBeNull();
    expect(label?.querySelectorAll(":scope > p").length).toBe(1);
    expect(label?.querySelectorAll("li[data-kind]").length).toBe(3);
  });

  it("puts the whole plate in the document whether or not it has arrived", () => {
    render(<Hero />);

    /* This is a reveal and not a conditional render. A reader with no motion,
       a crawler with no JavaScript and a browser mid-arrival are all reading
       the same three statements. */
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Full-stack, mostly frontend")).toBeInTheDocument();
    expect(screen.getByText("Israel")).toBeInTheDocument();
  });
});

describe("ObjectLabel's field-kind hook", () => {
  const fields = [
    { kind: "where" as const, value: "npm" },
    { kind: "when" as const, value: "2024" },
  ];

  it("writes no attribute unless it is asked to", () => {
    const { container } = render(
      <ObjectLabel name="Bothy" fact="A console." fields={fields} />
    );

    /* Every project and every note goes through this component on the
       default. If the attribute leaked on, those labels would start matching
       the title plate's `[data-kind]` off-switch selectors. */
    expect(container.querySelectorAll("li[data-kind]").length).toBe(0);
    expect(container.querySelectorAll("li").length).toBe(2);
  });

  it("writes the kind, not the position, when it is", () => {
    const { container } = render(
      <ObjectLabel name="Bothy" fact="A console." fields={fields} exposeFieldKinds />
    );

    const kinds = [...container.querySelectorAll("li")].map((li) =>
      li.getAttribute("data-kind")
    );
    expect(kinds).toEqual(["where", "when"]);
  });
});

describe("the title plate's off-switches", () => {
  const REDUCED = "(prefers-reduced-motion: reduce)";

  it("cancels the animation outright under reduced motion, on every part", () => {
    const block = mediaBlock(REDUCED);

    /* `animation: none` and not a shortened duration. The global
       `animation-duration: 0.01ms` in index.css would in fact land these on
       their final frame — they are time-driven — but an exit that depends on
       the animation still being live is one refactor away from depending on
       nothing at all. */
    expect(block).toMatch(/\.arrive h1 \{[^}]*animation: none/);
    expect(block).toMatch(/\.arrive > p,\s*\.arrive \[data-kind\] \{[^}]*animation: none/);
  });

  it("lands reduced motion on the finished plate, never on frame zero", () => {
    const block = mediaBlock(REDUCED);

    /* Frame zero is `opacity: 0` for the fact line and for two of the three
       fields, so an exit that only cancels the animation hides them. */
    expect(block).toMatch(/\.arrive > p,\s*\.arrive \[data-kind\] \{[^}]*opacity: 1/);
    expect(block).toMatch(/\.arrive > p,\s*\.arrive \[data-kind\] \{[^}]*transform: none/);
    /* Frame zero for the name is `--ink-soft`, so its arrived state is a
       colour and has to be restated as one. */
    expect(block).toMatch(/\.arrive h1 \{[^}]*color: rgb\(var\(--ink\)\)/);
  });

  it("restates the name's ink without repainting the other two parts", () => {
    /* The easy mistake, and the reason the exits are two rules rather than
       one selector list: the fact line and the field line are `--ink-soft` by
       the label schema, so pushing `color: rgb(var(--ink))` across the whole
       label turns an off-switch into a restyle that only reduced-motion
       readers ever see. */
    const groups = [
      mediaBlock(REDUCED),
      ...pausedRules(),
    ].filter((r) => /\[data-kind\]/.test(r));

    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const parts = group.match(/\.arrive > p,[\s\S]*?\}/g) ?? [];
      expect(parts.length).toBe(1);
      expect(parts[0]).not.toMatch(/color:/);
    }
  });

  it("lands the Pause toggle on the finished plate too", () => {
    const paused = pausedRules();

    /* Pause hangs a class on `document.body`, outside the React tree, which
       is why this is a stylesheet's job and not a component's — and it can be
       hit mid-arrival, so it has to land on arrived rather than on whatever
       frame the animation had reached. */
    expect(paused.length).toBe(2);
    expect(paused.filter((r) => /animation: none/.test(r)).length).toBe(2);
    expect(paused.join("\n")).toMatch(/color: rgb\(var\(--ink\)\)/);
    expect(paused.join("\n")).toMatch(/opacity: 1/);
    expect(paused.join("\n")).toMatch(/transform: none/);
  });

  it("never reaches for animation-play-state", () => {
    /* §4's named trap. It freezes an animation at the time it has reached,
       which for one that has not started is frame zero — and with
       `fill-mode: both` frame zero is the hidden state. "Pause motion" would
       blank the fact line and two thirds of the field line. */
    expect(RULES).not.toMatch(/animation-play-state/);
  });

  it("needs no @supports block, and stays the kind of file that does not", () => {
    /* The plate fires on load, so every animation here is time-driven and
       there is no feature for a browser to be missing. §4 calls the block
       cargo cult in that case. This assertion is what keeps the claim true
       rather than merely true today: the day anything here grows a scroll
       timeline, this fails and the third exit has to be written. */
    expect(RULES).not.toMatch(/animation-timeline/);
    expect(RULES).not.toMatch(/@supports/);
  });

  it("never translates sideways", () => {
    /* The ban in §5, and the reason for it: the deleted `Reveal` pushed
       full-width sections past the right edge of the document until they
       fired, so the page reported horizontal overflow with `overflow-x: clip`
       hiding the scrollbar and not the bug. */
    const transforms = RULES.match(/transform: [^;]+;/g) ?? [];
    expect(transforms.length).toBeGreaterThan(0);
    for (const t of transforms) {
      expect(t).toMatch(/translateY\([^)]*\)|none/);
      expect(t).not.toMatch(/translateX|translate3d|translate\(/);
    }
  });

  it("keeps the name out of the opacity business, so first paint is not deferred", () => {
    /* The plate's `h1` is the LCP element. `riseOnLoad` started it at
       `opacity: 0`, which takes the largest text on the first screen out of
       the running as a paint candidate for the whole length of the reveal.
       The name's arrival is a colour ramp for exactly that reason, and the
       keyframes have to stay free of opacity and transform for it to hold. */
    const ink = RULES.match(/@keyframes plate-ink \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(ink).toMatch(/color:/);
    expect(ink).not.toMatch(/opacity|transform/);
  });
});
