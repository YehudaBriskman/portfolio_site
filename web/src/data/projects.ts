import type { LabelField } from "@/components/gallery/objectLabel";
import type { Collection } from "@/services/blog";

/*
 * The seed table.
 *
 * These four entries are the fallback behind /projects, not its source of truth —
 * a published `kind: "project"` collection with the same slug wins outright (see
 * `useProjects`). They exist because the collections database can be empty and a
 * portfolio whose Projects page is blank is worse than one that is slightly
 * stale. Anything a seed cannot know — stars, releases, last push, notes, docs —
 * is simply absent until the real collection exists.
 *
 * Every sentence below is taken from a document the author wrote: WindoM's
 * README and CHANGELOG, and Bothy's README. Nothing here is a flourish added to
 * fill a field. The two 2025 projects carry no brief and no decisions
 * because no such document exists for them, and an invented one would be worth
 * less than the blank space it filled.
 *
 * Those two are learning projects, built while learning React and Node, and
 * say so (2026-11-03): state "Archive", status "Learning project", ordered
 * after the work and never pinned. Text Encrypting and Change11, two more of
 * the same kind, were removed outright at the owner's request; their URLs
 * answer 308 to /projects (nginx.conf.template, and App.tsx for a client-side
 * navigation).
 *
 * What the gallery added
 * ----------------------
 * Three fields, all of them the label schema's (see
 * `components/gallery/objectLabel.ts`). `fact` is the old `tagline`, renamed
 * and rewritten where it failed the schema's first rule, fact and not pitch:
 * several old values were not sentences at all but category labels —
 * `Teaching platform`, `Car marketplace` — which tell a reader what shelf the
 * thing is on and nothing about the thing. The rewrite is noted on each entry
 * next to the line it replaced, so the judgement can be argued with rather
 * than only observed.
 *
 * `fields` is the two-or-three-item spec line. `tint` is the colour the work
 * itself is, sampled by hand and marked for the build script; see the note on
 * `ProjectTint`.
 */

/** A claim the project makes, and the reason behind it. The part worth reading. */
export type ProjectDecision = {
  /** The claim, stated flatly. One line. */
  title: string;
  /** Why it was made, and what it cost. Full sentences. */
  body: string;
};

/**
 * The project's own colour, as an unpremultiplied sRGB triple.
 *
 * A tuple rather than the `"r g b"` string the stylesheets actually consume,
 * because a string is three numbers with no type on them: nothing would have
 * caught `"14, 107, 146"` — valid CSS in `rgb()`, invalid inside
 * `rgb(var(--t) / .3)` — until the tint silently stopped painting. The join
 * happens once, at the one place a component writes the custom property.
 *
 * TEMPORARY, AND WRITTEN DOWN AS SUCH. Every value below was sampled by hand
 * from the project's own screenshot — `magick <shot> -colors 16 histogram:` —
 * which means it is a fact today and a stale guess the first time a
 * screenshot is replaced. It belongs in `scripts/build-shots.mjs`, next to
 * the code that already opens every one of these files to resize it, emitted
 * into the same manifest as the srcSet rungs. Until then the number lives
 * here and the sampling command is in the comment on each one so the next
 * person can re-run it rather than re-invent it.
 */
export type ProjectTint = readonly [number, number, number];

export type Project = {
  /** Must match the collection slug, or the CMS entry will not replace it. */
  slug: string;
  title: string;
  /**
   * One line of fact. What the thing is, not why it is good.
   *
   * This field was called `tagline` and carried phrases like `Car
   * marketplace` and `Teaching platform` — category labels, not facts, and in
   * two places an outright pitch. The rename is the point rather than tidying
   * up after it: `tagline` is a word that invites a claim, and the label
   * schema forbids one (see `components/gallery/objectLabel.ts`). The
   * Collection shape the API returns still calls it `tagline`, so
   * `seedToCollection` translates; nothing else reads this directly.
   */
  fact: string;
  /**
   * The label's field line. Two or three, most identifying first.
   *
   * Authored rather than derived, because which fact identifies a project is
   * a judgement: WindoM's is that it is in the Chrome Web Store, Bothy's is
   * that it is open source. `useProjects` derives a line from the state, the
   * stack and the year when a project has no seed to say, which is the
   * fallback and not the rule. Ordering and the cap are applied by
   * `orderFields`, so the array here can be written in any order.
   */
  fields: LabelField[];
  description: string;
  tech: string[];
  /** Optional: not every project is best shown as a screenshot. */
  image?: string;
  /**
   * The colour the work itself is, for the surface that labels it.
   *
   * The page is a gallery — white walls, coloured paintings — so the only
   * colour on it comes from the objects. This is that colour, taken from the
   * object rather than assigned to it, which is the difference between a
   * relationship and a palette rotation: a project cannot be given the wrong
   * tint, because its tint is what it looks like.
   */
  tint: ProjectTint;
  link?: string;
  /** What to call the outbound link. Shown on the primary action pill. */
  linkLabel?: string;
  /** Further outbound links, after the primary one. Rendered as quiet pills. */
  links?: { label: string; url: string }[];
  github?: string;
  year: string;
  /** The long form, for the detail page. A sentence. */
  status: string;
  /** The short form, for a chip on a card. Two or three words, never more. */
  state: string;
  /** Facts that carry weight on their own. Kept short — these are scanned, not read. */
  highlights: string[];
  /*
   * The brief. All three are optional and all three are omitted rather than
   * guessed: a project with no written record renders no brief at all, which
   * is honest, where a heading over an empty paragraph is not.
   */
  /** What was wrong before the thing existed. */
  problem?: string;
  /** What the author actually did on it. */
  role?: string;
  /** What is true now that was not. Only ever facts he can point at. */
  outcome?: string;
  /** Decisions worth defending, with the reasoning. Shown in full on the detail page. */
  decisions?: ProjectDecision[];
  /** Ascending. Under 20 is featured; everything else is the archive. */
  order: number;
};

export const projects: Project[] = [
  {
    slug: "windom",
    title: "WindoM",
    /* Unchanged. It was already a fact: it says what happens, and a reader
       who installs it can check. */
    fact: "Every new tab becomes a dashboard",
    fields: [
      { kind: "state", value: "In use" },
      { kind: "tech", value: "React 19" },
      { kind: "where", value: "Chrome Web Store" },
    ],
    /* #188EA7 — the aurora at the top of the dashboard. Sampled:
       `magick public/projects/windom-800.jpg -resize 160x -colors 16
       -format %c histogram:info:`; the frame's dominant colour is the
       near-black #073050 behind it, which is the ground and not the
       identity. */
    tint: [24, 142, 167],
    description:
      "A Chrome extension that replaces the new-tab page with a personal dashboard: calendar, inbox, tasks, weather, music and markets in one view. Published on the Chrome Web Store and running for real users, with a Fastify and Postgres backend behind it.",
    tech: ["React 19", "TypeScript", "Vite 8", "Manifest V3", "Fastify 5", "Drizzle ORM", "PostgreSQL 17", "Fly.io"],
    image: "/projects/windom.jpg",
    link: "https://windom.app",
    linkLabel: "windom.app",
    links: [
      {
        label: "Chrome Web Store",
        url: "https://chromewebstore.google.com/detail/windom/comcnbccalbfcegbmaemancbhgpijkpb",
      },
    ],
    github: "https://github.com/YehudaBriskman/WindoM",
    year: "2026",
    status: "Live on the Chrome Web Store",
    state: "In use",
    highlights: [
      "Published on the Chrome Web Store, v1.5.1",
      "Push a version tag and it builds, zips and ships to Google with no manual step",
      "Full stack solo: React front end, Fastify + Postgres back end, Google and Spotify OAuth",
    ],
    problem:
      "The things you check first thing — the time, the weather, today's tasks, what is playing, the pull requests waiting on you, the price of something you hold — each live behind their own tab, and most of the dashboards that gather them want an account or an API key before they show you anything. WindoM puts them on the page the browser already opens, and the whole first list works with no account and no keys at all.",
    role:
      "Solo, across all four trees in the repository: the extension itself, the Fastify API behind it, windom.app, and the CI that releases them.",
    outcome:
      "Published on the Chrome Web Store and shipping — v1.5.1 went out on 26 October 2026. A release now reads the store's answer back before it calls itself done, which is how 1.5.0 was caught sitting in the store as an unsubmitted draft while CI showed green.",
    decisions: [
      {
        title: "The Gmail widget was removed for a licensing reason, not a product one.",
        body:
          "Reading mail needs the gmail.readonly scope, which Google classes as restricted: publishing with it requires a third-party CASA security assessment, priced per tier and recurring every year, because the mail passes through the server rather than staying in the browser. The consent screen now asks only for Calendar and sign-in, which verify for free. Nothing was deleted — the feature sits behind GMAIL_ENABLED, off by default — so it can come back if the reading is ever moved into the extension.",
      },
      {
        title: "The glass is computed optics rather than a stack of CSS tricks.",
        body:
          "The rim of every pane bends the wallpaper behind it through Snell's law, across a quartic squircle profile, with the direction taken from a rounded-rectangle distance field and incidence capped at 65 degrees — past that, Fresnel reflectance means a real surface reflects rather than transmits. Each distinct pane geometry gets its own displacement field, generated once and cached.",
      },
      {
        title: "Signing in logged you straight back out — one fault, several symptoms.",
        body:
          "Calendar, Spotify and Gmail each return 401 when their own provider grant is stale. Every one of those was being read as an expired session and driving a token refresh, and five of them exhausted the refresh endpoint's budget of five per fifteen minutes within seconds. The resulting 429 was then read as a dead session and logged the user out, so the more integrations someone had connected, the faster it happened. A 401 from a provider route is now that provider's to report.",
      },
    ],
    order: 10,
  },
  {
    slug: "bothy",
    title: "Bothy",
    /*
     * Was "A console that discovers itself", which is a claim about the
     * software's character rather than a statement of what it does — and the
     * reflexive verb is doing the persuading. This says the mechanism: one
     * machine, and the list comes from Docker. A reader can disagree with it,
     * which is the test.
     */
    fact: "A console for one machine that asks Docker what is running",
    fields: [
      { kind: "state", value: "Open source" },
      { kind: "tech", value: "Docker Compose" },
      { kind: "when", value: "2026" },
    ],
    /* NOT SAMPLED, because there is no screenshot to sample — Bothy ships no
       cover and renders a type plate instead. This is the green of the
       console's own live dots, which is the one colour the thing has, and it
       should be replaced with a real sample the moment a shot exists. */
    tint: [58, 132, 104],
    description:
      "A self-hosted console for a single machine. It reports containers, ports, routes, metrics and files by asking Docker directly rather than reading a list someone has to remember to update, so what it shows is what is actually running.",
    tech: ["React 19", "TypeScript", "Docker Compose", "Traefik v3.7", "Keycloak", "VictoriaMetrics", "Grafana", "Tailscale"],
    github: "https://github.com/YehudaBriskman/Bothy",
    year: "2026",
    status: "Open source, self-hosted",
    state: "Open source",
    highlights: [
      "Every card is discovered, never configured",
      "Each PR bootstraps the whole stack from empty and runs every suite",
      "Secrets generated at install; names logged, values never",
      "125 merged pull requests",
    ],
    problem:
      "A console for one machine is normally a hand-written list, so it is wrong from the first container that moves and nobody notices until it matters. And every project on the same box ends up re-solving the pieces it does not ship: an edge, identity, observability, a shared database, backups.",
    role:
      "One person's reproducible development box, in git: the console, the compose stacks beneath it, and the CI that clones the repository into an empty directory on every pull request and runs every suite in the tree against whatever came up.",
    outcome:
      "Start any container and it appears in the console within ten seconds with no edit to Bothy; stop it and its dot goes red just as fast. Fifty routers require a role across five files, and the tables that say so are asserted against the YAML row by row rather than written by hand — the README once enumerated fourteen routers when the tree held forty-eight.",
    decisions: [
      {
        title: "The security boundary is the Traefik rule, not the socket proxy's configuration.",
        body:
          "docker-socket-proxy gates by endpoint family, so CONTAINERS=1 also permits /containers/{id}/json — whose body contains every container's environment, which is to say real passwords. What actually prevents that is the router, where every rule is an exact Path() and exactly two Docker endpoints are routed. Widening it to a prefix would open the rest silently.",
      },
      {
        title: "There is no exec, and that is a deliberate regression.",
        body:
          "No shell in the browser, no kill, no create, no image or volume management. docker exec is root on the box, so EXEC: 0 is written out explicitly on all three socket proxies rather than left to a default, the verb list is a literal three-element tuple that is never derived from the handlers, and a check asserts both. Portainer did offer it, and was deleted; the replacement is docker exec over Tailscale SSH.",
      },
      {
        title: "One function owns the walk, so the security check is not something a caller has to remember.",
        body:
          "The file API's safepath.collect() is the only way the application can learn a set of paths, so a new endpoint inherits the deny rules by calling it rather than by its author remembering them. That was learned twice: a listing doing its own walk paid for 30,093 refused files to serve 3,474, and when full-text search arrived the same shortcut would have returned a matching line out of .env with the deny-list still technically correct.",
      },
    ],
    order: 11,
  },
  {
    slug: "programming-with-yehuda",
    title: "Programming with Yehuda",
    /* A learning project, and labelled as one (2026-11-03, at the owner's
       request). The line read "Programming lessons, grouped by concept and by
       language" over a "Live" chip, which presented an exercise as a product.
       "Archive" is the state the table already has for earlier work. */
    fact: "Lesson pages built while learning React and Node",
    fields: [
      { kind: "state", value: "Archive" },
      { kind: "tech", value: "React" },
      { kind: "when", value: "2025" },
    ],
    /* #8C5734 — the warm brown of the lesson pages. Same sampling command as
       WindoM's; this frame is almost entirely neutral greys, so the one
       chromatic colour in it is the identity by elimination. */
    tint: [140, 87, 52],
    description:
      "A learning project: a small site of programming lesson pages, built while learning React and Node.js.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "/projects/programing_with_yehuda.jpg",
    link: "https://programing-with-yehuda.netlify.app/",
    year: "2025",
    status: "Learning project",
    state: "Archive",
    highlights: [],
    order: 50,
  },
  {
    slug: "icaros",
    title: "Icaros",
    /* A learning project, and labelled as one (2026-11-03, at the owner's
       request). It read "A car marketplace that loads on a phone signal" over
       a "Live" chip: a product claim for something built to learn the stack. */
    fact: "A car-listing web app, built while learning React and Node",
    fields: [
      { kind: "state", value: "Archive" },
      { kind: "tech", value: "React" },
      { kind: "when", value: "2025" },
    ],
    /* #B04E2E — the rust of the hero car. A small share of the frame and the
       only saturated colour in it. */
    tint: [176, 78, 46],
    description:
      "A learning project: a car-listing web app with a React front end and a Node.js and MongoDB back end, built while learning the stack.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "/projects/icaros.jpg",
    link: "https://icaros.netlify.app/",
    year: "2025",
    status: "Learning project",
    state: "Archive",
    highlights: [],
    order: 51,
  },
];

/*
 * Projected into the shape the API returns, so every consumer downstream reads
 * one type and never branches on where an entry came from. `stats` stays null
 * on purpose: a seed has no repository facts, and inventing a star count would
 * undo the only thing that makes those numbers worth printing.
 */
export function seedToCollection(p: Project): Collection {
  const primary = p.link && p.link !== p.github ? [{ label: p.linkLabel ?? "Visit", url: p.link }] : [];
  return {
    slug: p.slug,
    title: p.title,
    /* The one place the rename is translated back. `Collection` is the shape
       the API returns and zod validates, so its field keeps the old name
       until the backend's own schema moves; the seed table is the side of the
       boundary that gets to say what the line actually is. */
    tagline: p.fact,
    description: p.description,
    coverImage: p.image ?? null,
    links: [...primary, ...(p.links ?? [])],
    order: p.order,
    kind: "project",
    repoUrl: p.github ?? null,
    stats: null,
  };
}

export const seedProjects: Project[] = projects;

/**
 * Whether a project counts as live: a product a stranger can open right now.
 *
 * A `link` alone used to be the test, which made every learning project with
 * a Netlify page "live" and put "5 LIVE" on the hero. An archived entry keeps
 * its link (the page still loads, and hiding it would be its own small lie)
 * but is not counted. The specs plate reads this; the hero no longer prints
 * a live count at all (2026-11-03).
 */
export function isLive(p: Project): boolean {
  return typeof p.link === "string" && p.link.length > 0 && p.state !== "Archive";
}
