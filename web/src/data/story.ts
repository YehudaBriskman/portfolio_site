import { projects as seedProjects, type Project } from "@/data/projects";
import { contact, plate } from "@/data/site";

/*
 * The story: the work told along the other axis (#46).
 *
 * The collection — `/` and `/projects` — is atemporal on purpose. It shows
 * what exists, each object labelled with its own year, and refuses to argue
 * for an order. This file is the other axis: not *what exists* but *how it
 * got here*. It is NOT a résumé. A résumé is a list of employers and dates,
 * and this site has already decided — see THE EMPLOYER IS NEVER NAMED in
 * `data/site.ts` — that the one employer a résumé would lead with is not
 * printed anywhere. What is left once that is true is the work, which is
 * what a story about the work should have been about anyway.
 *
 * WHAT IS DERIVED AND WHAT IS WRITTEN
 * -----------------------------------
 * The arc is derived from `data/projects.ts` and cannot drift from it:
 *
 *   - one chapter per distinct project year, in order, whose evidence is
 *     exactly that year's projects in the table's own `order`;
 *   - a "before" chapter spanning `plate.shippingSince` up to the year before
 *     the table's first entry, which exists only because the table starts
 *     later than the shipping did (the long note on `shippingSince` in
 *     `site.ts` is the reason that number is stated rather than derived);
 *   - a "now" chapter, which is the role, described and never attributed.
 *
 * What is written is the prose for each year, keyed by the year, in `YEARS`
 * below. `buildStory()` throws if a project year has no prose, or if prose
 * exists for a year with no project in it — so adding a 2027 project to the
 * table without a 2027 chapter fails the test suite rather than shipping a
 * story that skips a year, and deleting the last 2025 project fails it too
 * rather than leaving a chapter about three things that are no longer on the
 * site. The test is `components/story/__tests__/story.test.ts`.
 *
 * WHAT IS MARKED RATHER THAN INVENTED
 * -----------------------------------
 * Three things the table cannot know and nobody but the author can say. The
 * issue's approval lists them, and each is carried here as an `ask` — rendered
 * on the page as a visibly unfinished note rather than papered over with a
 * plausible paragraph. A plausible paragraph is the one thing worse than a
 * gap on a page whose every other sentence can be checked:
 *
 *   1. what happened 2021–2023;
 *   2. whether teaching caused the 2025 projects or followed from them;
 *   3. what changed about how he works when he started leading.
 *
 * When the author answers one, the answer replaces `ask` with `body`
 * paragraphs and the note disappears — no component changes.
 *
 * EVERY SENTENCE SURVIVES "PROVE IT"
 * ----------------------------------
 * The same bar `site.ts` sets. Each claim below is checkable against the
 * project's own link, README or listing; where the prototype in the issue
 * went further than that (Text Encrypting "with no analytics", for one, which
 * nothing in the repo can confirm, and its stack given as React when the
 * table says plain JavaScript) the sentence was cut back to what is known.
 */

/** A paragraph only the author can write, marked on the page as missing. */
export type StoryAsk = {
  /** The label over the note — what kind of gap this is. */
  label: string;
  /** The question, put to the author in the page's own voice. */
  question: string;
};

/** The prose for one chapter. */
export type ChapterProse = {
  title: string;
  /** Mono field after the year; a few words, never a sentence. */
  kicker?: string;
  /**
   * The chapter's first line, set larger. On the peak this is the line the
   * pin holds, and it must be exactly two sentences — the first is what is
   * held, the second is what arrives. See `Story.module.css`, `.peakLine`.
   */
  lede?: string;
  body: string[];
  ask?: StoryAsk;
};

/**
 * Which chapter is the page's one peak. Exactly one, and it is enforced by
 * the type here (a single year) rather than by a flag on each chapter that a
 * second chapter could also set.
 *
 * 2026, for the reason the approval gives: a deployed site is something you
 * can show someone, a published extension is something they keep. Every one
 * of the principles in `about.principles` dates from that year, which is
 * when their absence started costing something.
 */
export const PEAK_YEAR = "2026";

/**
 * One entry per year the project table contains. The keys are checked
 * against the table in both directions by `buildStory()`.
 */
const YEARS: Record<string, ChapterProse> = {
  "2024": {
    title: "One thing, finished",
    body: [
      "The first thing in the table does one job, in the browser: you open it, it encrypts your text, you close it. It is a static page with nothing behind it.",
      "That is a smaller claim than it sounds and a harder one to meet. Most first projects are a tutorial with no end. This one has an end, and somebody who is not its author can reach it.",
    ],
  },
  "2025": {
    title: "Three at once",
    body: [
      "Three shipped in one year, and they have nothing in common: a marketplace, a ledger and a place to learn. A marketplace is other people's photographs on other people's phones. A ledger is arithmetic that has to be right every single time. A teaching platform is structure — the content is worthless if a reader cannot find the next thing.",
      "Breadth before depth, and it shows in the one detail that matters most about each of them.",
    ],
    ask: {
      label: "Worth a sentence from the author",
      question:
        "Programming with Yehuda is from this year too. Was teaching a consequence of the other two, or the reason for them? That answer is what turns three projects into a chapter.",
    },
  },
  "2026": {
    title: "The year strangers started installing it",
    kicker: "the turn",
    lede: "A deployed site is something you can show someone. A published extension is something they keep.",
    body: [
      "WindoM is in the Chrome Web Store, which means a review process, a privacy policy, an update channel, and people who will notice if a release is broken. Bothy is open source, which means the install has to work on a machine its author has never seen.",
      "Both are the same change: the work stops being his to demonstrate and starts being somebody else's to depend on. Everything in the principles on the home page — installing from empty, a check that can actually fail, credentials generated rather than committed — comes from this year, because this is the year those things started to cost something when they were absent.",
    ],
  },
};

/**
 * The "before" chapter. No project in the table predates 2024, so this
 * chapter has no evidence and no prose — only the ask.
 */
const BEFORE: ChapterProse = {
  title: "Before there was a repository",
  body: [
    "The project table starts in 2024 because that is as far back as its entries go — not because nothing shipped before them.",
  ],
  ask: {
    label: "This chapter is empty, and only the author can fill it",
    question:
      "What were the years between starting and the first thing still worth pointing at? Two or three paragraphs in the author's own words. Everything after this chapter is derived from the project table; this is the part no table knows.",
  },
};

/**
 * The "now" chapter.
 *
 * THE EMPLOYER IS NEVER NAMED — the rule is written out in `data/site.ts`,
 * on `heroPhrases`, and it binds here more than anywhere: a chapter called
 * "now" on a page about a career is the exact slot a résumé fills with an
 * organisation. The role is described — a technical team lead, a small team,
 * internal software — and the sentence stops there. The previous employer is
 * named because `about.intro` already names it on the home page; this repeats
 * a published fact rather than publishing a new one.
 */
const NOW: ChapterProse = {
  title: "And still writing the code",
  body: [
    "A technical team lead now, leading a small team that builds and runs internal software — and still writing and reviewing code every day. Never the version of the job where you stop.",
    "Before that, a full-stack engineer at Momentum Tailored Solutions.",
  ],
  ask: {
    label: "The one thing a story needs that a CV does not",
    question:
      "What changed about how the work gets done once leading started? The honest answer is the strongest paragraph on this page, and it is the only one nobody else can write.",
  },
};

export type ChapterKind = "before" | "year" | "now";

export type Chapter = ChapterProse & {
  /** Stable, and the fragment the chapter can be linked at. */
  id: string;
  kind: ChapterKind;
  /** 1-based, in reading order. */
  number: number;
  /** The year the rail shows while this chapter is under it. */
  railYear: number;
  /** The span the chapter's kicker prints, e.g. "2021–2023" or "2025". */
  span: string;
  /** This year's projects, in the table's own order. Empty for before/now. */
  projects: Project[];
  peak: boolean;
};

export type Story = {
  chapters: Chapter[];
  firstYear: number;
  lastYear: number;
  /** Counted from the table, never typed — see the close. */
  figures: { value: number; caption: string }[];
};

/** An en dash between two years, or one year when they are the same. */
function spanOf(from: number, to: number): string {
  return from === to ? String(from) : `${from}–${to}`;
}

/**
 * Builds the story from a project table.
 *
 * Takes the table as an argument rather than importing it so the test can
 * hand it a table with a year missing or a year added and watch it refuse;
 * the page calls it with no argument and gets the seed.
 */
export function buildStory(table: readonly Project[] = seedProjects, prose = YEARS): Story {
  const years = [...new Set(table.map((p) => p.year))].sort();

  for (const y of years) {
    if (!prose[y]) throw new Error(`story: the project table has ${y} and no chapter for it`);
  }
  for (const y of Object.keys(prose)) {
    if (!years.includes(y)) throw new Error(`story: a chapter for ${y}, which no project is from`);
  }

  const firstTableYear = Number(years[0]);
  const lastYear = Number(years.at(-1));
  const firstYear = plate.shippingSince;
  const city = contact.location.split(",")[0];

  const chapters: Omit<Chapter, "number">[] = [];

  /* Only when the shipping really did start before the table — if the
     author's stated year and the table ever agree, the chapter has nothing to
     be about and is dropped rather than printed with a span of zero years. */
  if (firstYear < firstTableYear) {
    chapters.push({
      ...BEFORE,
      id: "before",
      kind: "before",
      railYear: firstYear,
      span: spanOf(firstYear, firstTableYear - 1),
      projects: [],
      peak: false,
    });
  }

  for (const y of years) {
    chapters.push({
      ...prose[y],
      id: `y${y}`,
      kind: "year",
      railYear: Number(y),
      span: y,
      projects: table.filter((p) => p.year === y).sort((a, b) => a.order - b.order),
      peak: y === PEAK_YEAR,
    });
  }

  chapters.push({
    ...NOW,
    id: "now",
    kind: "now",
    kicker: city,
    railYear: lastYear,
    span: "now",
    projects: [],
    peak: false,
  });

  /*
   * The close's figures. Three, each counted, and each about the walk rather
   * than a repeat of the home page's spec plate — "say it once": the plate
   * already prints the project count beside the stack, so the close counts
   * the things the story was about instead.
   *
   *   - anyone can open: a project with a public link or a public repository,
   *     which is what "somebody who is not its author can reach it" in the
   *     2024 chapter means as a number;
   *   - in a store: a `where` field naming a store, which is the 2026 turn;
   *   - years: first shipped year to the latest in the table, inclusive —
   *     calendar years walked, which is what the rail has just counted.
   */
  const reachable = table.filter((p) => Boolean(p.link || p.github)).length;
  const inStore = table.filter((p) =>
    p.fields.some((f) => f.kind === "where" && /store/i.test(f.value))
  ).length;

  return {
    chapters: chapters.map((c, i) => ({ ...c, number: i + 1 })),
    firstYear,
    lastYear,
    figures: [
      { value: reachable, caption: "Anyone can open" },
      { value: inStore, caption: "In a store" },
      { value: lastYear - firstYear + 1, caption: "Years walked" },
    ],
  };
}
