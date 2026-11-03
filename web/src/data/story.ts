import { projects as seedProjects, type Project } from "@/data/projects";
import { plate } from "@/data/site";
import type { LineMove } from "@/components/motion/lineMoves";

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

/*
 * HOW A BEAT'S WORDS SIT AGAINST ITS PICTURE
 * ------------------------------------------
 * Three layouts, chosen per beat in `LAYOUTS` below; the owner picks.
 *
 *   beside   the words in a narrow column beside the picture (the default);
 *   under    a smaller picture, the words beneath it as its caption;
 *   overlap  a larger picture, the words on a paper card laid over its
 *            inner lower corner.
 *
 * The picture's side alternates beat by beat whatever the layout, and the
 * living line runs down the lane on the picture's side. On a phone all three
 * stack — picture, then words — and overlap keeps its card over the
 * picture's foot.
 */
export type BeatLayout = "beside" | "under" | "overlap";

/*
 * THE LINE'S MOVES (#191)
 * -----------------------
 * The living line is composed from moves each piece of content declares
 * (`motion/lineMoves.ts` has the vocabulary). These are the story's
 * defaults; a beat or an interlude may carry its own `line` instead, and
 * content added later — by hand or from the admin panel (#163) — draws a
 * line with no more than these: every beat runs down the lane on its
 * picture's side, every interlude is circled, and the composer turns in
 * circles between them, whatever the count.
 */
export const STORY_LINE = {
  /** The seed: a dot in the middle of the page, before the first beat. */
  origin: [{ move: "origin", dot: true }] as LineMove[],
  /** A beat: down the lane on the picture's side. */
  beat: (side: "start" | "end"): LineMove[] => [{ move: "line-to", lane: side }],
  /** An interlude: once round its words, with 10px of clearance. */
  interlude: [{ move: "circle-around", pad: 10 }] as LineMove[],
};

export const LAYOUT_DEFAULT: BeatLayout = "beside";

/** A moment between beats: a few words the line draws a loop round. */
export type Interlude = {
  id: string;
  /** The beat it follows. */
  after: string;
  /** The words, in each language the site is written in. Real text, not a picture of it. */
  words: { en: string; he: string };
  /** The line's moves here, if not `STORY_LINE.interlude`. */
  line?: LineMove[];
};

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
  layout: BeatLayout;
  /** The line's moves here, if not `STORY_LINE.beat(side)`. */
  line?: LineMove[];
};

export type Story = {
  beats: Beat[];
  /** In beat order; each names the beat it follows. */
  interludes: Interlude[];
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
  icaros: "A learning project: a React front end on a Node.js and MongoDB back end.",
  "programming-with-yehuda": "A learning project, written to practise React and Node.",
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
 * Layouts, keyed by beat id; a beat not named here is `beside`. Changing a
 * beat's layout is this one line.
 */
const LAYOUTS: Record<string, BeatLayout> = {
  "programming-with-yehuda": "overlap",
  icaros: "under",
  bothy: "overlap",
  now: "under",
};

/*
 * The interludes: where the line breaks out of the timeline and draws a loop
 * round a few words. Closer together as the story goes on — after three
 * beats, three more, then two — so the scroll gathers pace towards now. Each
 * names the beat it follows, and `buildStory` refuses one that names no beat.
 *
 * Both languages are in the DOM, each with its own `lang`; the stylesheet
 * shows the Hebrew under <html lang="he"> and the English otherwise, and the
 * one not shown is `display: none`, so a screen reader hears one.
 */
const INTERLUDES: Interlude[] = [
  {
    id: "loop-open",
    after: "programming-with-yehuda",
    words: { en: "Things other people could open.", he: "דברים שאחרים יכולים לפתוח." },
  },
  {
    id: "loop-rely",
    after: "windom",
    words: { en: "Then, things they relied on.", he: "ואז, דברים שסומכים עליהם." },
  },
  {
    id: "loop-team",
    after: "full-stack",
    words: { en: "Then, a team.", he: "ואז, צוות." },
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
  interludes: Interlude[] = INTERLUDES,
  layouts: Record<string, BeatLayout> = LAYOUTS,
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

  const beats: Omit<Beat, "ratio" | "image" | "layout">[] = [
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
  for (const id of Object.keys(layouts)) {
    if (!ids.has(id)) throw new Error(`story: a layout for ${id}, which is not a beat`);
  }
  for (const i of interludes) {
    if (!ids.has(i.after)) throw new Error(`story: interlude ${i.id} follows ${i.after}, which is not a beat`);
    if (!i.words.en.trim() || !i.words.he.trim()) throw new Error(`story: interlude ${i.id} is missing a language`);
  }
  const order = beats.map((b) => b.id);

  /*
   * The close's figures, each counted from the table:
   *   - anyone can open: a project with a public link or a public repository;
   *   - in a store: a `where` field naming a store;
   *   - years: first shipped year to the latest in the table, inclusive.
   */
  const reachable = table.filter((p) => Boolean(p.link || p.github)).length;
  const inStore = table.filter((p) => p.fields.some((f) => f.kind === "where" && /store/i.test(f.value))).length;

  return {
    beats: beats.map((b) => ({ ...b, ratio: RATIO, image: images[b.id], layout: layouts[b.id] ?? LAYOUT_DEFAULT })),
    interludes: [...interludes].sort((a, b) => order.indexOf(a.after) - order.indexOf(b.after)),
    firstYear,
    lastYear,
    figures: [
      { value: reachable, caption: "Anyone can open" },
      { value: inStore, caption: "In a store" },
      { value: lastYear - firstYear + 1, caption: "Years" },
    ],
  };
}
