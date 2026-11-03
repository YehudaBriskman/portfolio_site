import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectRun from "@/components/projects/ProjectRun";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";
import {
  CURVE_H,
  CURVE_PATH,
  CURVE_W,
  cardCentre,
  curveBox,
  curveY,
} from "@/components/projects/runCurve";

/*
 * jsdom has no layout and no scroll-driven animation, so the run itself — the
 * pin, the curve, the reverse — is verified in a browser
 * (`scripts/shoot-work-run.mjs`). What can break silently here is the markup
 * contract the fallback rests on, and the off-switches, which are asserted
 * against the stylesheet text for the reason ProjectPile.test.tsx gives.
 */

const CSS = readFileSync(
  resolve(process.cwd(), "src/components/projects/ProjectRun.module.css"),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const collection = (over: Partial<Collection> = {}): Collection => ({
  slug: "windom",
  title: "WindoM",
  tagline: "Every new tab becomes a dashboard",
  description: "A Chrome extension.",
  coverImage: null,
  links: [],
  order: 10,
  kind: "project",
  repoUrl: null,
  stats: null,
  ...over,
});

const entry = (over: Partial<ProjectEntry> = {}, c: Partial<Collection> = {}): ProjectEntry => ({
  collection: collection(c),
  live: false,
  state: "In use",
  status: "Live",
  year: "2026",
  tech: ["React 19", "TypeScript"],
  highlights: [],
  fields: [{ kind: "state", value: "In use" }],
  tint: [24, 142, 167],
  problem: null,
  role: null,
  outcome: null,
  decisions: [],
  primaryLink: null,
  otherLinks: [],
  ...over,
});

const three = [
  entry(),
  entry({ state: "Open source", tint: null }, { slug: "bothy", title: "Bothy" }),
  entry({ state: "Live", year: "2024" }, { slug: "icaros", title: "Icaros" }),
];

function draw(entries: ProjectEntry[]) {
  return render(
    <MemoryRouter>
      <ProjectRun entries={entries} label="Selected work" heading="h3" />
    </MemoryRouter>
  );
}

describe("ProjectRun", () => {
  it("is an ordered list of every project, one link per card", () => {
    draw(three);
    const list = screen.getByRole("list", { name: "Selected work" });
    expect(list.tagName).toBe("OL");
    expect(list.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(
      screen
        .getAllByRole("link")
        .map((l) => l.getAttribute("href"))
        .filter((h) => h?.startsWith("/projects/"))
    ).toEqual(["/projects/windom", "/projects/bothy", "/projects/icaros"]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers a way past the run", () => {
    draw(three);
    const skip = screen.getByRole("link", { name: "Skip past the work" });
    const target = document.getElementById(skip.getAttribute("href")!.slice(1));
    expect(target).not.toBeNull();
    expect(target?.getAttribute("tabindex")).toBe("-1");
  });

  it("places one hidden moment per card, outside the list, under the anchor ids", () => {
    const { container } = draw(three);
    const marks = container.querySelectorAll("[data-run-mark]");
    expect(Array.from(marks).map((m) => m.id)).toEqual([
      "object-windom",
      "object-bothy",
      "object-icaros",
    ]);
    marks.forEach((m) => {
      expect(m.getAttribute("aria-hidden")).toBe("true");
      expect(m.closest("ol")).toBeNull();
    });
  });

  it("writes the count, the index and each card's own arrival", () => {
    const { container } = draw(three);
    expect(container.querySelector("[data-run-stage]")?.getAttribute("style")).toContain(
      "--run-n: 3"
    );
    const slots = Array.from(container.querySelectorAll("ol > li"));
    expect(slots[1].getAttribute("style")).toContain("--run-i: 1");
    /* Open source swings open from the left edge: origin 0% 50%. */
    expect(slots[1].getAttribute("style")).toContain("--arrive-ox: -50%");
    expect(slots[1].getAttribute("style")).toContain("--arrive-oy: 0%");
    expect(slots[0].getAttribute("style")).toContain("--run-tint: 24 142 167");
    expect(slots[1].getAttribute("style")).not.toContain("--run-tint");
  });

  it("draws nothing for no projects", () => {
    const { container } = draw([]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProjectRun.module.css", () => {
  it("drives the run by scroll alone, from the static stage's named timeline", () => {
    expect(CSS).toMatch(/\.stage\s*\{[^}]*view-timeline-name:\s*--run/);
    /* slot, card, and the aurora's surge with its counter-move (#181); the
       sweep in is the shared strand's, handed `--run` (below) */
    expect(CSS.match(/animation-timeline:\s*--run/g)).toHaveLength(3);
    expect(CSS).not.toMatch(/animation-timeline:\s*view\(\)\s*;/);
    expect(CSS).not.toMatch(/animation-(duration|delay)/);
    expect(CSS).not.toMatch(/scroll-snap/);
  });

  it.each([
    ["no support", /@supports not \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n\}/],
    ["reduced motion", /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/],
  ])("lands %s on the plain list", (_, block) => {
    const body = CSS.match(block)?.[1] ?? "";
    expect(body).toMatch(/\.slot\s*\{[^}]*animation-name:\s*none/);
    expect(body).toMatch(/\.card\s*\{[^}]*animation-name:\s*none/);
    expect(body).toMatch(/\.frame\s*\{[^}]*position:\s*static/);
    expect(body).toMatch(/\.run\s*\{[^}]*container-type:\s*normal/);
    expect(body).toMatch(/\.stage\s*\{[^}]*height:\s*auto/);
  });

  it("lands Pause on the same plain list", () => {
    expect(CSS).toMatch(/body\.motion-paused\) \.slot\s*\{[^}]*animation-name:\s*none/);
    expect(CSS).toMatch(/body\.motion-paused\) \.card\s*\{[^}]*animation-name:\s*none/);
    expect(CSS).toMatch(/body\.motion-paused\) \.frame\s*\{[^}]*position:\s*static/);
    expect(CSS).toMatch(/body\.motion-paused\) \.run\s*\{[^}]*container-type:\s*normal/);
    expect(CSS).toMatch(/body\.motion-paused\) \.stage\s*\{[^}]*height:\s*auto/);
  });
});

/*
 * Right to left (#168): the run mirrors — in from the left, along the
 * mirrored curve, leaning the other way — through one sign, not a second
 * code path and not a `scale(-1)` that draws the text backwards.
 */
describe("ProjectRun right to left", () => {
  it("renders the same list, skip link and moments under dir=rtl", () => {
    document.documentElement.dir = "rtl";
    try {
      const { container } = draw(three);
      expect(screen.getByRole("list", { name: "Selected work" }).children).toHaveLength(3);
      const skip = screen.getByRole("link", { name: "Skip past the work" });
      expect(document.getElementById(skip.getAttribute("href")!.slice(1))).not.toBeNull();
      expect(container.querySelectorAll("[data-run-mark]")).toHaveLength(3);
      /* No direction-specific markup: the stylesheet alone turns it. */
      expect(container.innerHTML).not.toMatch(/rtl|run-dir/);
    } finally {
      document.documentElement.dir = "ltr";
    }
  });

  it("turns on one direction factor, set by the dir attribute locale.ts writes", () => {
    expect(CSS).toMatch(/\.stage\s*\{[^}]*--run-dir:\s*1;/);
    expect(CSS).toMatch(/html\[dir="rtl"\]\) \.stage\s*\{\s*--run-dir:\s*-1;\s*\}/);
    expect(CSS.match(/html\[dir="rtl"\]/g)).toHaveLength(1);
  });

  it("anchors the travel at the reading start, not the left", () => {
    expect(CSS).toMatch(/\.slot\s*\{[^}]*inset-inline-start:\s*0/);
    expect(CSS).not.toMatch(/(^|[\s;{])left:\s*0/);
  });

  it("multiplies the travel, the lean and the arrival's swing by it", () => {
    const x = CSS.match(/@keyframes run-x\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(x.match(/translateX\(calc\(var\(--run-dir\)/g)).toHaveLength(2);
    const lean = CSS.match(/@keyframes run-lean\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(lean.match(/rotate:\s*calc\([^;]*var\(--run-dir\)/g)).toHaveLength(3);
    const arrive = CSS.match(/@keyframes run-arrive\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(arrive).toMatch(/rotateY\(calc\(var\(--run-dir\) \* var\(--arrive-swing/);
  });

  it("does not mirror by scale", () => {
    expect(CSS).not.toMatch(/scale:\s*-1/);
  });
});

/*
 * The owner's preprod pass (#170): one size of card, and a timeline that
 * starts where the pin does.
 */
describe("ProjectRun.module.css, one box", () => {
  it("does not scale a card on its way in, whatever its arrival", () => {
    const arrive = CSS.match(/@keyframes run-arrive\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(arrive).not.toMatch(/scale\(/);
  });

  it("reserves and clamps the plinth's lines, so content cannot move the edge", () => {
    expect(CSS).toMatch(/\.label > :first-child\s*\{[^}]*line-clamp:\s*1/);
    expect(CSS).toMatch(/\.label > p\s*\{[^}]*line-clamp:\s*2;[^}]*block-size:\s*2lh/);
    expect(CSS).toMatch(/\.label > ul\s*\{[^}]*block-size:\s*1lh;[^}]*overflow:\s*hidden/);
  });

  it("zeroes the view timeline's inset, so scroll-padding cannot shift it off the pin", () => {
    expect(CSS).toMatch(/\.stage\s*\{[^}]*view-timeline-inset:\s*0;/);
  });
});

/*
 * Shadow and tilt (#177): the face inside each link turns towards a fine
 * pointer, composed with the run's transforms rather than replacing them.
 */
describe("ProjectRun tilt", () => {
  it("gives every card a face inside its link", () => {
    const { container } = draw(three);
    const links = container.querySelectorAll("[data-run-card]");
    expect(links).toHaveLength(3);
    links.forEach((l) => {
      expect(l.tagName).toBe("A");
      expect(l.querySelector(":scope > [data-run-face]")).not.toBeNull();
    });
  });

  it("writes nothing for a touch pointer", () => {
    const { container } = draw(three);
    const face = container.querySelector<HTMLElement>("[data-run-face]")!;
    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperty(move, "pointerType", { value: "touch" });
    face.dispatchEvent(move);
    expect(face.getAttribute("style") ?? "").not.toMatch(/--tilt/);
  });

  it("turns the face, never the link that carries the lean and the arrival", () => {
    const rules = CSS.match(
      /[^{}]+\{[^{}]*\btransform:\s*perspective\(var\(--tilt-depth\)\)[^{}]*\}/g
    );
    expect(rules).not.toBeNull();
    rules!.forEach((r) => expect(r.split("{")[0].trim()).toMatch(/> \.face$/));
  });

  it("tilts only under a fine hovering pointer with motion allowed, and Pause cancels it", () => {
    const block =
      CSS.match(
        /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\n\}/
      )?.[1] ?? "";
    expect(block).toMatch(/\.card:hover > \.face\s*\{[^}]*rotateY\(calc\(var\(--tilt-x/);
    expect(block).toMatch(/\.card:focus-visible > \.face\s*\{[^}]*var\(--run-dir\)/);
    expect(block).toMatch(/body\.motion-paused\) \.card > \.face\s*\{\s*transform:\s*none/);
    expect(CSS.match(/--tilt-x/g)).toHaveLength(1);
  });

  it("casts a layered, low-opacity shadow", () => {
    const face = CSS.match(/\n\.face\s*\{([^}]*)\}/)?.[1] ?? "";
    const alphas = Array.from(face.matchAll(/rgb\(var\(--run-shade\) \/ ([\d.]+)\)/g), (m) =>
      Number(m[1])
    );
    expect(alphas.length).toBeGreaterThanOrEqual(4);
    alphas.forEach((a) => expect(a).toBeLessThanOrEqual(0.4));
  });
});

/*
 * The aurora (#181): one line of light on the cards' own path. jsdom cannot
 * lay it out, so what is held here is the geometry (pure, in runCurve.ts),
 * the stylesheet's box for it, which must be the same numbers the slot moves
 * by, and the off-switches. The drawn line is measured against the cards in
 * a browser by `scripts/shoot-work-aurora.mjs`.
 */
describe("ProjectRun aurora", () => {
  /* The drawn curve's height at a point x of the run, in the run's box. */
  function drawnY(x: number, W: number, H: number, c: number, A: number, rtl = false) {
    const box = curveBox(W, H, c, A);
    let u = (x - box.left) / box.width;
    /* `scale: var(--run-dir) 1` turns the drawing about its own centre. */
    if (rtl) u = 1 - u;
    return box.top + (curveY(u) / CURVE_H) * box.height;
  }

  /* run box, card, amplitude: 1440×900 and 390×844 as the browser has them */
  const WINDOWS = [
    [1440, 844, 448, 67.52],
    [390, 788, 312, 39],
    [1024, 712, 448, 56.96],
  ] as const;

  it.each(WINDOWS)("puts every card centre on the drawn line (%i wide)", (W, H, c, A) => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const { x, y } = cardCentre(p, W, H, c, A);
      expect(Math.abs(drawnY(x, W, H, c, A) - y)).toBeLessThan(0.01);
    }
  });

  it.each(WINDOWS)("mirrors onto the mirrored run in Hebrew (%i wide)", (W, H, c, A) => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const { x, y } = cardCentre(p, W, H, c, A);
      /* A Hebrew card at lap p stands where the English one does, mirrored. */
      expect(Math.abs(drawnY(W - x, W, H, c, A, true) - y)).toBeLessThan(0.01);
    }
  });

  it("samples the path finely enough to stay within half a pixel of the sine", () => {
    const pts = Array.from(CURVE_PATH.matchAll(/(-?[\d.]+) (-?[\d.]+)/g), (m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(pts.length).toBeGreaterThan(200);
    expect(pts[0]).toEqual([0, 50]);
    expect(pts.at(-1)).toEqual([CURVE_W, 50]);
    /* Worst chord sag, at a tall window's amplitude (100 units → 135px). */
    for (let i = 1; i < pts.length; i += 1) {
      const mid = (pts[i - 1][0] + pts[i][0]) / 2;
      const chord = (pts[i - 1][1] + pts[i][1]) / 2;
      expect(Math.abs(chord - curveY(mid / CURVE_W)) * 1.35).toBeLessThan(0.5);
    }
  });

  it("sets the curve's box from the numbers the slot moves by", () => {
    /* runCurve.ts derives the box from these two ends of run-x: if they
       change, the box must change with them. */
    const x = CSS.match(/@keyframes run-x\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(x).toMatch(/translateX\(calc\(var\(--run-dir\) \* \(100cqw \+ 15%\)\)\)/);
    expect(x).toMatch(/translateX\(calc\(var\(--run-dir\) \* -115%\)\)/);
    expect(CSS).toMatch(/\n\.slot\s*\{[^}]*width:\s*var\(--run-card\)/);
    const curve = CSS.match(/\n\.curve\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(curve).toMatch(/inset-inline-start:\s*calc\(-0\.65 \* var\(--run-card\)\)/);
    expect(curve).toMatch(/top:\s*calc\(50% - var\(--run-amp\)\)/);
    expect(curve).toMatch(/width:\s*calc\(100cqw \+ 1\.3 \* var\(--run-card\)\)/);
    expect(curve).toMatch(/height:\s*calc\(2 \* var\(--run-amp\)\)/);
    expect(curve).toMatch(/scale:\s*var\(--run-dir\) 1/);
    /* The same box as the run, and a size container, so 100cqw agrees. */
    expect(CSS).toMatch(
      /\n\.aurora\s*\{[^}]*inset:\s*var\(--bar-h, 56px\) 0 0 0;[^}]*container-type:\s*size/
    );
  });

  it("sweeps its light on the run's timeline, the way the cards travel", () => {
    for (const name of ["run-surge", "run-surge-hold"]) {
      const kf = CSS.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
      expect(kf.match(/translateX\(calc\(var\(--run-dir\)/g)).toHaveLength(2);
    }
    expect(CSS).toMatch(/\.surge,\s*\.surgeIn\s*\{[^}]*animation-timeline:\s*--run;/);
  });

  it("is a ribbon of fine strands, not one stroke (#192)", () => {
    const { container } = draw(three);
    const ribbon = container.querySelector("[data-run-aurora] [data-strands]")!;
    expect(Number(ribbon.getAttribute("data-strands"))).toBeGreaterThanOrEqual(5);
    const ds = [...ribbon.querySelectorAll("path")].map((p) => p.getAttribute("d"));
    expect(new Set(ds).size).toBe(ds.length);
  });

  it("sweeps in from the reading end on the run's own timeline, through the shared strand", () => {
    const { container } = draw(three);
    const strand = container.querySelector<HTMLElement>("[data-run-aurora] [data-aurora-strand]")!;
    expect(strand).toHaveAttribute("data-from", "right");
    expect(strand).toHaveAttribute("data-mirror", "");
    expect(strand.style.getPropertyValue("--strand-timeline")).toBe("--run");
    expect(strand.style.getPropertyValue("--strand-range")).toMatch(/^entry \d+% contain \d+%$/);
    expect(strand.querySelector("[data-run-surge]")).not.toBeNull();
  });

  it("no longer starts the living line: 'How I work' brings it in from the page's left edge", () => {
    const { container } = draw(three);
    expect(container.querySelector("[data-line-origin]")).toBeNull();
    expect(CSS).not.toMatch(/\n\.origin\s*\{/);
  });

  it("is drawn behind the list, hidden from assistive technology", () => {
    const { container } = draw(three);
    const aurora = container.querySelector("[data-run-aurora]")!;
    expect(aurora.getAttribute("aria-hidden")).toBe("true");
    expect(aurora.closest("ol")).toBeNull();
    expect(aurora.nextElementSibling?.tagName).toBe("OL");
    expect(screen.getByRole("list", { name: "Selected work" }).children).toHaveLength(3);
  });

  const still = (body: string) => {
    expect(body).toMatch(/\.aurora\s*\{[^}]*container-type:\s*normal/);
    expect(body).toMatch(/\.aurora > \*\s*\{\s*display:\s*none/);
    expect(body).toMatch(
      /\.aurora::before\s*\{[^}]*content:\s*"";[^}]*background:\s*linear-gradient/
    );
  };

  it("is a still ribbon under reduced motion", () => {
    const body =
      CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    still(body);
  });

  it("is the same still ribbon under Pause", () => {
    const paused = Array.from(
      CSS.matchAll(/:global\(body\.motion-paused\) (\.aurora[^{]*\{[^}]*\})/g),
      (m) => m[1]
    ).join("\n");
    still(paused);
  });

  it("is hidden where scroll-driven animation is missing, and in forced colours", () => {
    const none =
      CSS.match(/@supports not \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(none).toMatch(/\.aurora\s*\{\s*display:\s*none/);
    const forced = CSS.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(forced).toMatch(/\.aurora\s*\{\s*display:\s*none/);
  });
});
