import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The owner's rule, made into a test (#162).
 *
 *   "the titles and all the animations need to be handled like the way that
 *    the github get handled — reverse when scrolling up, all controllable
 *    with simple scrolling. no more."
 *
 * Every `@keyframes` animation in the site's stylesheets has to be driven by
 * a scroll or view timeline, unless it is on the allowlist below — and the
 * allowlist is the exemptions `docs/motion-contract.md` §8 records, each with
 * its reason. A new clock-driven reveal (a `620ms` rise, an `infinite` loop,
 * a one-shot class flipped by an observer) fails here, by file and by name,
 * before it ships.
 *
 * What counts as "driven by a timeline": a rule that names a keyframe is
 * scroll-driven when some rule in the same file sets `animation-timeline`
 * on the same element — compared by the selector's last compound, which is
 * how this codebase splits a name and its timeline across rules (a `.seam`
 * light names its keyframe in one rule and takes `--seam` in the shared one
 * above it; an RTL override names a second keyframe for the same
 * `.line::after`).
 *
 * Transitions are not scanned: every transition on the site is a reply to a
 * hover, a focus, a press or a state the reader set, which §8 exempts. The
 * TypeScript checks below cover the other two ways a one-shot reveal gets
 * in: an `IntersectionObserver` that flips a class, and the Web Animations
 * API.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "test") continue;
      walk(path, out);
    } else out.push(path);
  }
  return out;
}

const FILES = walk(SRC);
const CSS_FILES = FILES.filter((f) => f.endsWith(".css"));
const TS_FILES = FILES.filter((f) => /\.tsx?$/.test(f));
const rel = (f: string) => relative(SRC, f);

/*
 * The exemptions, each `file → keyframe names`, and why. Adding a line here
 * is a decision the motion contract has to record in §8 as well.
 */
const ALLOWED: Record<string, { names: string[]; why: string }> = {
  "components/motion/EntryShutter.module.css": {
    names: ["shutter-tile"],
    why: "the one-time entry shutter: a page load, not a scroll",
  },
  "components/Contact.module.css": {
    names: ["ink-across", "ink-inward", "ink-absorb", "ink-seal"],
    why: "the form's ink: a reply to opening the dialog and to pressing Send",
  },
  "components/HeroArrival.module.css": {
    names: [
      "plate-letter-in", "plate-mask-down", "plate-from-start", "plate-from-end", "plate-figure-in",
      "plate-letter-held", "plate-mask-held", "plate-start-held", "plate-end-held", "plate-figure-held",
    ],
    why: "the hero's arrival, once a visit, started by the entry shutter lifting (#194), and the still hold on its first frame under the cover (#219): part of the page load",
  },
  "components/HeroCorners.module.css": {
    names: ["corner-in", "corner-mask-down", "corner-held", "corner-mask-held"],
    why: "the corners' part of the same arrival (#194) and of its hold (#219)",
  },
  "components/nav/theme-wave.css": {
    names: ["theme-wave"],
    why: "the theme change spreading from the toggle (#266): a reply to pressing it, not a scroll",
  },
  "components/gallery/Skeleton.module.css": {
    names: ["sk-gate"],
    why: "not motion: a 1ms opacity step whose only job is a 180ms visibility threshold",
  },
};

type Rule = { selectors: string[]; body: string };

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/* Every leaf rule — a selector and a body with no nested block — at any depth. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const stack: { prelude: string; start: number; leaf: boolean }[] = [];
  let mark = 0;
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c === "{") {
      if (stack.length) stack[stack.length - 1].leaf = false;
      const prelude = css.slice(mark, i).split(/[;}]/).pop()!.trim();
      stack.push({ prelude, start: i + 1, leaf: true });
      mark = i + 1;
    } else if (c === "}") {
      const top = stack.pop();
      if (top && top.leaf && !top.prelude.startsWith("@") && !/^(from|to|\d)/.test(top.prelude)) {
        out.push({
          selectors: top.prelude.split(",").map((s) => s.trim()).filter(Boolean),
          body: css.slice(top.start, i),
        });
      }
      mark = i + 1;
    }
  }
  return out;
}

/* The last compound of a selector, with `:global(...)` unwrapped and its
   pseudo-classes dropped (`.phrase:first-child` is still `.phrase`); a
   pseudo-element is a different box and is kept. */
function subject(selector: string): string {
  const flat = selector.replace(/:global\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "$1").trim();
  const last = flat.split(/\s+|>|\+|~/).filter(Boolean).pop() ?? flat;
  return last.replace(/(?<!:):[\w-]+(\([^)]*\))?/g, "");
}

const KEYFRAMES = new Set(
  CSS_FILES.flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/@keyframes\s+(?::global\()?\s*([\w-]+)/g)].map((m) => m[1]),
  ),
);

/* The keyframe names a rule's `animation` / `animation-name` declarations use. */
function animationNames(body: string): string[] {
  const names: string[] = [];
  for (const m of body.matchAll(/(?:^|;|\s)animation(?:-name)?\s*:\s*([^;]+)/g)) {
    for (const token of m[1].split(/[\s,]+/)) if (KEYFRAMES.has(token)) names.push(token);
  }
  return names;
}

/* Split on commas that are not inside parentheses. */
function topLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let mark = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1;
    else if (value[i] === ")") depth -= 1;
    else if (value[i] === "," && depth === 0) {
      out.push(value.slice(mark, i).trim());
      mark = i + 1;
    }
  }
  out.push(value.slice(mark).trim());
  return out;
}

/*
 * For a rule whose `animation` shorthand and `animation-timeline` are both
 * lists, the keyframe names on the layers whose timeline is `auto` — the
 * clocks. `null` when the rule is not layered, so the caller judges it the
 * ordinary way.
 */
function layeredClocks(body: string): string[] | null {
  const shorthand = body.match(/(?:^|;|\s)animation\s*:\s*([^;]+)/)?.[1];
  const timeline = body.match(/animation-timeline\s*:\s*([^;]+)/)?.[1];
  if (!shorthand || !timeline) return null;
  const layers = topLevel(shorthand);
  const timelines = topLevel(timeline);
  if (layers.length < 2) return null;
  const clocks: string[] = [];
  layers.forEach((layer, i) => {
    const name = layer.split(/\s+/).find((token) => KEYFRAMES.has(token));
    if (name && timelines[i % timelines.length] === "auto") clocks.push(name);
  });
  return clocks;
}

type Finding = { file: string; name: string; selector: string };

function clockAnimations(): Finding[] {
  const found: Finding[] = [];
  for (const file of CSS_FILES) {
    const all = rules(strip(readFileSync(file, "utf8")));
    const timed = new Set(
      all
        .filter((r) => /animation-timeline\s*:\s*(?!auto\b|none\b)/.test(r.body))
        .flatMap((r) => r.selectors.map(subject)),
    );
    for (const r of all) {
      /* A layered rule — several animations and a timeline list in the same
         body — is judged layer by layer: a layer whose timeline is `auto` is
         a clock however scrubbed its neighbours are. Without this, a clock
         could ride in on a rule that also names a scroll timeline. */
      const layered = layeredClocks(r.body);
      if (layered) {
        for (const name of layered) found.push({ file: rel(file), name, selector: r.selectors.join(", ") });
        continue;
      }
      /* A bare `animation-name` swap — an RTL or a modifier class — keeps
         the timeline the cascade already gave the element, because only the
         `animation` shorthand resets `animation-timeline`. So it passes in a
         file that sets a timeline, as long as it brings no clock of its own. */
      const swap =
        !/(?:^|;|\s)animation\s*:/.test(r.body) &&
        !/animation-duration/.test(r.body) &&
        timed.size > 0;
      for (const name of animationNames(r.body)) {
        if (swap || r.selectors.some((s) => timed.has(subject(s)))) continue;
        found.push({ file: rel(file), name, selector: r.selectors.join(", ") });
      }
    }
  }
  return found;
}

describe("every animation on the site is scrubbed by scroll (#162)", () => {
  it("finds the stylesheets it is meant to police", () => {
    /* A walker that silently found nothing would pass everything. */
    expect(CSS_FILES.length).toBeGreaterThan(20);
    expect(KEYFRAMES.has("written-pen")).toBe(true);
    expect(KEYFRAMES.has("shutter-tile")).toBe(true);
  });

  it("has no clock-driven animation outside the recorded exemptions", () => {
    const offenders = clockAnimations().filter(
      (f) => !(ALLOWED[f.file]?.names ?? []).includes(f.name),
    );
    expect(
      offenders.map((f) => `${f.file}: ${f.name} on ${f.selector}`),
      "time-based animation: give it an animation-timeline, or record the exemption in motion-contract §8 and ALLOWED",
    ).toEqual([]);
  });

  it("keeps every exemption in use, so the list cannot rot into a loophole", () => {
    const found = clockAnimations();
    for (const [file, { names }] of Object.entries(ALLOWED)) {
      for (const name of names) {
        expect(
          found.some((f) => f.file === file && f.name === name),
          `${file}: ${name} is allowlisted but no longer clock-driven — drop it from ALLOWED`,
        ).toBe(true);
      }
    }
  });

  it("catches a clock-driven reveal when one is written", () => {
    /* The detector itself, against a stylesheet it has never seen. */
    const css = strip(`
      .a { animation: rise 620ms ease both; }
      .b { animation: rise linear both; }
      .b { animation-timeline: view(); }
    `);
    const all = rules(css);
    const timed = new Set(all.filter((r) => /animation-timeline/.test(r.body)).flatMap((r) => r.selectors.map(subject)));
    KEYFRAMES.add("rise");
    const clock = all.filter((r) => animationNames(r.body).length && !r.selectors.some((s) => timed.has(subject(s))));
    KEYFRAMES.delete("rise");
    expect(clock.map((r) => r.selectors[0])).toEqual([".a"]);
  });

  it("catches a clock layered onto a scrubbed animation", () => {
    KEYFRAMES.add("rise");
    KEYFRAMES.add("fall");
    const scrubbed = layeredClocks("animation: rise linear both, fall linear both; animation-timeline: view(), --x");
    const layered = layeredClocks("animation: rise linear both, fall 260ms ease calc(var(--i) * 38ms) backwards; animation-timeline: --x, auto");
    KEYFRAMES.delete("rise");
    KEYFRAMES.delete("fall");
    expect(scrubbed).toEqual([]);
    expect(layered).toEqual(["fall"]);
  });

  it("has no Tailwind clock animation left in the theme", () => {
    const config = readFileSync(resolve(SRC, "../tailwind.config.ts"), "utf8");
    expect(config).not.toMatch(/\banimation:\s*\{/);
    expect(config).not.toMatch(/\bkeyframes:\s*\{/);
  });

  it("uses Tailwind's animate-* classes only on the exempt menus and tooltips", () => {
    /* `animate-in` / `animate-out` are tailwindcss-animate's open and close
       for Radix's dropdown menu and tooltip — replies to a press or a hover. */
    const users = TS_FILES.filter((f) => /\banimate-[a-z]/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["components/ui/dropdown-menu.tsx", "components/ui/tooltip.tsx"]);
    for (const f of users) {
      const classes = readFileSync(resolve(SRC, f), "utf8").match(/\banimate-[a-z-]+/g) ?? [];
      expect(new Set(classes)).toEqual(new Set(["animate-in", "animate-out"]));
    }
  });

  it("starts no Web Animations API clock", () => {
    const users = TS_FILES.filter((f) => /\.animate\(\s*[[{]/.test(readFileSync(f, "utf8"))).map(rel);
    expect(users).toEqual([]);
  });

  it("observes intersections only where nothing is revealed once", () => {
    /*
     * `Written` tells a paragraph whether it is above, in or below the
     * reading zone so the stylesheet can stop animating words that cannot
     * change — both directions, a cost saving, not a reveal. `useDarkChrome`
     * switches the bar's material over the dark acts and back. A new observer
     * is almost always a fire-once reveal on its way in; it belongs on a view
     * timeline instead.
     */
    const users = TS_FILES.filter((f) => /new IntersectionObserver\(/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["components/motion/Written.tsx", "components/nav/useDarkChrome.ts"]);
  });
});
