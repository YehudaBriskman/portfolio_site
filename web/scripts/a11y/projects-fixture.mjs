/*
 * The Projects pages' own stub: the shared site stub has no published project
 * collections, so Bothy is a seed with no repository facts. This answers
 * `/blog/collections` with one live Bothy that has them (12 stars, 3 forks,
 * TypeScript, a release); WindoM stays a seed, with none. Used by
 * public-projects.mjs and shoot-projects.mjs only.
 */
import { answer } from "./site-stub.mjs";

const at = (days) => new Date(Date.UTC(2026, 9, 1) - days * 86_400_000).toISOString();

export const BOTHY_COLLECTION = {
  slug: "bothy",
  title: "Bothy",
  tagline: "A console for one machine that asks Docker what is running",
  description: "A self-hosted console for a single machine.",
  coverImage: null,
  links: [],
  order: 2,
  kind: "project",
  repoUrl: "https://github.com/example/bothy",
  stats: {
    stars: 12,
    forks: 3,
    language: "TypeScript",
    license: "MIT",
    pushedAt: at(2),
    latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at(5) },
    fetchedAt: at(1),
  },
  he: null,
};

/** A Playwright route handler for `**\/api/**`. */
export function handler() {
  return (r) => {
    const url = r.request().url();
    if (/\/blog\/collections$/.test(new URL(url).pathname)) {
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [BOTHY_COLLECTION] }) });
      return;
    }
    const { status, body } = answer(url, false);
    r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
  };
}
