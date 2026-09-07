export type Project = {
  title: string;
  tagline: string;
  description: string;
  tech: string[];
  /** Optional: not every project is best shown as a screenshot. */
  image?: string;
  link?: string;
  github?: string;
  year: string;
  status: string;
  /** Facts that carry weight on their own. Kept short — these are scanned, not read. */
  highlights: string[];
  featured?: boolean;
};

export const projects: Project[] = [
  {
    title: "WindoM",
    tagline: "Every new tab becomes a dashboard",
    description:
      "A Chrome extension that replaces the new-tab page with a personal dashboard: calendar, inbox, tasks, weather, music and markets in one view. Published on the Chrome Web Store and running for real users, with a Fastify and Postgres backend behind it.",
    tech: ["React 18", "TypeScript", "Tailwind v4", "Fastify", "PostgreSQL", "Drizzle ORM", "Fly.io", "Manifest V3"],
    image: "windom.jpg",
    link: "https://windom.app",
    github: "https://github.com/YehudaBriskman/WindoM",
    year: "2026",
    status: "Live on the Chrome Web Store",
    highlights: [
      "Published on the Chrome Web Store, v1.4.0",
      "Push a version tag and it builds, zips and ships to Google — no manual step",
      "Full stack solo: React front end, Fastify + Postgres back end, Google and Spotify OAuth",
    ],
    featured: true,
  },
  {
    title: "Bothy",
    tagline: "A console that discovers itself",
    description:
      "A self-hosted console for a single machine. It reports containers, ports, routes, metrics and files by asking Docker directly rather than reading a list someone has to remember to update — so what it shows is what is actually running.",
    tech: ["TypeScript", "Docker Compose", "Traefik", "Prometheus", "Grafana", "Tailscale"],
    link: "https://github.com/YehudaBriskman/Bothy",
    github: "https://github.com/YehudaBriskman/Bothy",
    year: "2026",
    status: "Open source",
    highlights: [
      "Every card is discovered, never configured",
      "Each PR bootstraps the whole stack from empty and runs every suite",
      "Secrets generated at install; names logged, values never",
      "125 merged pull requests",
    ],
    featured: true,
  },
  {
    title: "Programming with Yehuda",
    tagline: "Teaching platform",
    description: "A platform for learning programming concepts and languages.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "programing_with_yehuda.jpg",
    link: "https://programing-with-yehuda.netlify.app/",
    year: "2025",
    status: "Live",
    highlights: [],
  },
  {
    title: "Change11",
    tagline: "Cash tracking",
    description: "A platform for managing and tracking changes in cash.",
    tech: ["React", "Node.js", "Express", "Vite"],
    image: "change11.jpg",
    link: "https://change11.netlify.app/",
    year: "2025",
    status: "Live",
    highlights: [],
  },
  {
    title: "Icaros",
    tagline: "Car marketplace",
    description: "A web application for managing and selling cars.",
    tech: ["React", "Node.js", "MongoDB", "Vite"],
    image: "icaros.jpg",
    link: "https://icaros.netlify.app/",
    year: "2025",
    status: "Live",
    highlights: [],
  },
  {
    title: "Text Encrypting",
    tagline: "Encrypt and decrypt in the browser",
    description: "A web application for encrypting and decrypting text.",
    tech: ["JavaScript", "HTML", "CSS", "Vite"],
    image: "text_encrypting.jpg",
    link: "https://textencrypting.netlify.app/",
    year: "2024",
    status: "Live",
    highlights: [],
  },
];

export const featured = projects.filter((p) => p.featured);
export const rest = projects.filter((p) => !p.featured);
