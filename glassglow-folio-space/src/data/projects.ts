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
 */
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
  github?: string;
  year: string;
  /** The long form, for the detail page. A sentence. */
  status: string;
  /** The short form, for a chip on a card. Two or three words, never more. */
  state: string;
  /** Facts that carry weight on their own. Kept short — these are scanned, not read. */
  highlights: string[];
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
    tech: ["React 18", "TypeScript", "Tailwind v4", "Fastify", "PostgreSQL", "Drizzle ORM", "Fly.io", "Manifest V3"],
    image: "/projects/windom.jpg",
    link: "https://windom.app",
    linkLabel: "windom.app",
    github: "https://github.com/YehudaBriskman/WindoM",
    year: "2026",
    status: "Live on the Chrome Web Store",
    state: "In use",
    highlights: [
      "Published on the Chrome Web Store, v1.4.0",
      "Push a version tag and it builds, zips and ships to Google with no manual step",
      "Full stack solo: React front end, Fastify + Postgres back end, Google and Spotify OAuth",
    ],
    order: 10,
  },
  {
    slug: "bothy",
    title: "Bothy",
    tagline: "A console that discovers itself",
    description:
      "A self-hosted console for a single machine. It reports containers, ports, routes, metrics and files by asking Docker directly rather than reading a list someone has to remember to update, so what it shows is what is actually running.",
    tech: ["TypeScript", "Docker Compose", "Traefik", "Prometheus", "Grafana", "Tailscale"],
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
  return {
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    coverImage: p.image ?? null,
    links: p.link && p.link !== p.github ? [{ label: p.linkLabel ?? "Visit", url: p.link }] : [],
    order: p.order,
    kind: "project",
    repoUrl: p.github ?? null,
    stats: null,
  };
}

export const seedProjects: Project[] = projects;
