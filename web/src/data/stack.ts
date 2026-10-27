/* Replaces skils.ts. Self-assigned percentages are not evidence — they invite
   doubt, and the only numbers anyone remembers are the low ones. Grouped by
   how close each tool is to daily use instead. */
export const stackGroups = [
  {
    title: "Reach for daily",
    note: "What I'm writing this week",
    items: ["TypeScript", "React", "Node.js", "Fastify", "Express", "PostgreSQL", "Drizzle ORM", "Tailwind", "Vite", "Zod"],
  },
  {
    title: "Shipped to production",
    note: "Running, not just tried",
    items: ["Docker & Compose", "Traefik", "Kubernetes", "GitHub Actions", "Prometheus & Grafana", "Fly.io", "OAuth 2.0", "Chrome Manifest V3", "Let's Encrypt"],
  },
  {
    title: "Currently learning",
    note: "Honest about the edges",
    items: ["AWS", "GraphQL", "Python", "WebGL / three.js"],
  },
] as const;
