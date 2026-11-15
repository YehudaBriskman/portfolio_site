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

/**
 * A Playwright route handler for `**\/api/**`.
 *
 * `opts` (the polish shots only): `cover` gives Bothy a real, busy cover
 * (`/projects/icaros.jpg`), `longTitle` a title that must wrap, and `windom`
 * adds a live WindoM that has a repository, a licence and no release.
 */
export function handler(opts = {}) {
  return (r) => {
    const url = r.request().url();
    if (/\/blog\/collections$/.test(new URL(url).pathname)) {
      const bothy = {
        ...BOTHY_COLLECTION,
        ...(opts.cover ? { coverImage: "/projects/icaros.jpg" } : {}),
        ...(opts.longTitle ? { title: "Bothy: a console for one machine that asks Docker what is running" } : {}),
      };
      const items = [bothy];
      if (opts.windom)
        items.push({
          ...BOTHY_COLLECTION,
          slug: "windom",
          title: "WindoM",
          tagline: "Window manager for the browser",
          description: "A tiling window manager for the browser. Written in TypeScript, it keeps your tabs in tidy columns.",
          order: 3,
          repoUrl: "https://github.com/example/windom",
          coverImage: opts.cover ? "/projects/icaros.jpg" : null,
          stats: { ...BOTHY_COLLECTION.stats, stars: 15, forks: 2, latestRelease: null },
        });
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
      return;
    }
    const { status, body } = answer(url, false);
    r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
  };
}
