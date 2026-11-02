import { projects as seedProjects, type Project } from "@/data/projects";
import { plate } from "@/data/site";

/*
 * The story: the work told along the other axis (#46), as a timeline (#158).
 *
 * The collection — `/` and `/projects` — shows what exists. This is the other
 * axis: what happened, when, and what came of it. Many short beats, each a
 * year or a moment, a line or two, and a picture. No beat explains itself or
 * apologises for a gap; it says what happened.
 *
 * THE EMPLOYER IS NEVER NAMED. Not the current one, not a previous one, not
 * here, not in a test. The role is "technical team lead" and the sentence
 * stops there; see `data/site.ts` for where the rule came from.
 *
 * WHAT IS DERIVED AND WHAT IS WRITTEN
 * -----------------------------------
 * The project beats are derived from `data/projects.ts` and cannot drift from
 * it. `buildStory()` throws:
 *
 *   - if a project in the table has no line in `LINES`, so a new project
 *     fails the suite rather than shipping a timeline that skips it;
 *   - if `LINES` has a line for a slug the table no longer has, so a removed
 *     project fails it too rather than leaving a beat about nothing;
 *   - if `IMAGES` names a beat that does not exist, so a picture can never be
 *     filed under a typo and silently not appear.
 *
 * Each project beat's year is the project's own `year`, its title the
 * project's own `title`, and its first line the project's own `fact` — the
 * same three words the collection prints, so the two axes agree. `LINES` adds
 * at most one sentence after it. The start (`plate.shippingSince`) and the two
 * role beats are the only beats written by hand.
 *
 * PICTURES ARE DATA
 * -----------------
 * Every beat has an image slot. A picture is added by putting the file in
 * `public/story/` and one entry in `IMAGES`, keyed by the beat's id — no
 * component changes. Until then the slot is an empty card on the skeleton
 * ground, sized to the same `ratio`, so nothing on the page moves when the
 * picture arrives.
 */

/** A picture for one beat. `src` is a path under `public/`. */
export type StoryImage = { src: string; alt: string };

export type BeatKind = "start" | "project" | "role";

export type Beat = {
  /** Stable, unique, and the fragment the beat can be linked at. */
  id: string;
  kind: BeatKind;
  /** What the beat's time label prints: a year, or a moment. */
  when: string;
  /** The beat's heading: a few words. */
  title: string;
  /** One or two short sentences. */
  lines: string[];
  /** The image slot's shape, as a CSS `aspect-ratio`. The same with or without the picture. */
  ratio: string;
  image?: StoryImage;
  /** A project beat's page. */
  href?: string;
};

export type Story = {
  beats: Beat[];
  firstYear: number;
  lastYear: number;
  /** Counted from the table, never typed — see the close. */
  figures: { value: number; caption: string }[];
};

/** Every slot is this shape unless a beat says otherwise; a landscape photo or a screenshot both sit in it. */
export const RATIO = "3 / 2";

/**
 * One sentence after each project's own `fact`, keyed by slug. Checked against
 * the table in both directions. Every clause is checkable against the
 * project's own link, README or listing.
 */
const LINES: Record<string, string> = {
  "text-encrypting": "A static page with nothing behind it. Open it, encrypt, close it.",
  icaros: "Other people's photographs, on other people's phones.",
  change11: "Arithmetic that has to be right every single time.",
  "programming-with-yehuda": "Built so a reader can always find the next lesson.",
  windom: "Published in the Chrome Web Store: a review, a privacy policy, an update channel.",
  bothy: "Open source. The install has to work on a machine its author has never seen.",
};

/** The beats written by hand. The start's year is `plate.shippingSince`. */
const START = {
  title: "Started shipping",
  lines: ["The first software shipped."],
};

/*
 * The two roles, in order, after the projects. `when` is a moment rather than
 * a year until the owner gives the years; changing it to "2023" is the whole
 * edit.
 */
const ROLES: Array<Pick<Beat, "id" | "when" | "title" | "lines">> = [
  {
    id: "full-stack",
    when: "Then",
    title: "Full-stack engineer",
    lines: ["Building software across the whole stack."],
  },
  {
    id: "now",
    when: "Now",
    title: "Technical team lead",
    lines: [
      "Leading a small team that builds and runs internal software.",
      "Still writing and reviewing code every day.",
    ],
  },
];

/**
 * Pictures, keyed by beat id. Empty until the owner supplies them; each one
 * replaces that beat's empty card with no layout shift.
 */
const IMAGES: Record<string, StoryImage> = {};

/**
 * Builds the story from a project table.
 *
 * Takes the table, the lines and the pictures as arguments so the test can
 * hand it a table with a project added or removed and watch it refuse; the
 * page calls it with no argument and gets the seed.
 */
export function buildStory(
  table: readonly Project[] = seedProjects,
  lines: Record<string, string> = LINES,
  images: Record<string, StoryImage> = IMAGES,
): Story {
  for (const p of table) {
    if (!lines[p.slug]) throw new Error(`story: the project table has ${p.slug} and no line for it`);
  }
  for (const slug of Object.keys(lines)) {
    if (!table.some((p) => p.slug === slug)) throw new Error(`story: a line for ${slug}, which is not in the table`);
  }

  const ordered = [...table].sort((a, b) => Number(a.year) - Number(b.year) || a.order - b.order);
  const firstYear = plate.shippingSince;
  const lastYear = Math.max(...table.map((p) => Number(p.year)));

  const beats: Omit<Beat, "ratio" | "image">[] = [
    { id: `start-${firstYear}`, kind: "start", when: String(firstYear), ...START },
    ...ordered.map((p) => ({
      id: p.slug,
      kind: "project" as const,
      when: p.year,
      title: p.title,
      lines: [`${p.fact}.`, lines[p.slug]],
      href: `/projects/${p.slug}`,
    })),
    ...ROLES.map((r) => ({ ...r, kind: "role" as const })),
  ];

  const ids = new Set(beats.map((b) => b.id));
  if (ids.size !== beats.length) throw new Error("story: two beats share an id");
  for (const id of Object.keys(images)) {
    if (!ids.has(id)) throw new Error(`story: a picture for ${id}, which is not a beat`);
  }

  /*
   * The close's figures, each counted from the table:
   *   - anyone can open: a project with a public link or a public repository;
   *   - in a store: a `where` field naming a store;
   *   - years: first shipped year to the latest in the table, inclusive.
   */
  const reachable = table.filter((p) => Boolean(p.link || p.github)).length;
  const inStore = table.filter((p) => p.fields.some((f) => f.kind === "where" && /store/i.test(f.value))).length;

  return {
    beats: beats.map((b) => ({ ...b, ratio: RATIO, image: images[b.id] })),
    firstYear,
    lastYear,
    figures: [
      { value: reachable, caption: "Anyone can open" },
      { value: inStore, caption: "In a store" },
      { value: lastYear - firstYear + 1, caption: "Years" },
    ],
  };
}
