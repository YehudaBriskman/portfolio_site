import type { Collection } from "@/services/blog";

/*
 * The seed table.
 *
 * These six entries are the fallback behind /projects, not its source of truth —
 * a published `kind: "project"` collection with the same slug wins outright (see
 * `useProjects`). They exist because the collections database can be empty and a
 * portfolio whose Projects page is blank is worse than one that is slightly
 * stale. Anything a seed cannot know — stars, releases, last push, notes, docs —
 * is simply absent until the real collection exists.
 *
 * Every sentence below is taken from a document the author wrote: WindoM's
 * README and CHANGELOG, and Bothy's README. Nothing here is a flourish added to
 * fill a field. The four 2024–25 projects carry no brief and no decisions
 * because no such document exists for them, and an invented one would be worth
 * less than the blank space it filled.
 */

/** A claim the project makes, and the reason behind it. The part worth reading. */
export type ProjectDecision = {
  /** The claim, stated flatly. One line. */
  title: string;
  /** Why it was made, and what it cost. Full sentences. */
  body: string;
};

export type Project = {
  /** Must match the collection slug, or the CMS entry will not replace it. */
  slug: string;
  title: string;
  tagline: string;
  description: string;
  tech: string[];
  /** Optional: not every project is best shown as a screenshot. */
  image?: string;
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
    tagline: "Every new tab becomes a dashboard",
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
    tagline: "A console that discovers itself",
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
    tagline: "Teaching platform",
    description: "A platform for learning programming concepts and languages.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "/projects/programing_with_yehuda.jpg",
    link: "https://programing-with-yehuda.netlify.app/",
    year: "2025",
    status: "Live",
    state: "Live",
    highlights: [],
    order: 50,
  },
  {
    slug: "change11",
    title: "Change11",
    tagline: "Cash tracking",
    description: "A platform for managing and tracking changes in cash.",
    tech: ["React", "Node.js", "Express", "Vite"],
    image: "/projects/change11.jpg",
    link: "https://change11.netlify.app/",
    year: "2025",
    status: "Live",
    state: "Live",
    highlights: [],
    order: 51,
  },
  {
    slug: "icaros",
    title: "Icaros",
    tagline: "Car marketplace",
    description: "A web application for managing and selling cars.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "/projects/icaros.jpg",
    link: "https://icaros.netlify.app/",
    year: "2025",
    status: "Live",
    state: "Live",
    highlights: [],
    order: 52,
  },
  {
    slug: "text-encrypting",
    title: "Text Encrypting",
    tagline: "Encrypt and decrypt in the browser",
    description: "A web application for encrypting and decrypting text.",
    tech: ["JavaScript", "HTML", "CSS", "Vite"],
    image: "/projects/text_encrypting.jpg",
    link: "https://textencrypting.netlify.app/",
    year: "2024",
    status: "Live",
    state: "Live",
    highlights: [],
    order: 53,
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
    tagline: p.tagline,
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
