/*
 * The Blog pages' own stub: the shared site stub has one note and one area,
 * which cannot show a list, a feed month, a tag filter or a long post. This
 * answers the blog endpoints with nine notes in three areas (two featured,
 * one with a link list, one long enough to scroll through several screens),
 * and defers everything else to the shared stub. Used by public-blog.mjs and
 * shoot-blog.mjs only.
 */
import { answer } from "./site-stub.mjs";

const at = (days) => new Date(Date.UTC(2026, 9, 1) - days * 86_400_000).toISOString();

const AREAS = [
  { slug: "site", title: "The site", tagline: "This portfolio.", description: "", coverImage: null, links: [], order: 0, kind: "site", repoUrl: null, stats: null, noteCount: 4, lastActivityAt: at(1), topics: [{ tag: "process", count: 3 }, { tag: "ci", count: 1 }] },
  { slug: "bothy", title: "Bothy", tagline: "The box's portal.", description: "", coverImage: null, links: [], order: 1, kind: "project", repoUrl: "https://github.com/example/bothy", stats: { stars: 12, forks: 3, language: "TypeScript", license: "MIT", pushedAt: at(2), latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at(5) }, fetchedAt: at(1) }, noteCount: 3, lastActivityAt: at(2), topics: [{ tag: "docker", count: 2 }] },
  { slug: "windom", title: "WindoM", tagline: "A window manager for one screen.", description: "", coverImage: null, links: [], order: 2, kind: "project", repoUrl: null, stats: null, noteCount: 2, lastActivityAt: at(9), topics: [{ tag: "design", count: 2 }] },
];

const S = (slug, title, collection, days, tags, minutes, extra = {}) => ({
  slug,
  title,
  subtitle: null,
  excerpt: `${title}: a short excerpt so the list has the shape it has in production.`,
  publishedAt: at(days),
  updatedAt: at(days),
  tags,
  collection,
  coverImage: null,
  readingMinutes: minutes,
  ...extra,
});

export const SUMMARIES = [
  S("merging-does-not-ship", "Merging does not ship. A tag does.", "site", 2, ["process", "releases"], 4, { featured: 1 }),
  S("the-long-note", "A long note, to scroll through at several positions", "site", 5, ["process"], 9, { subtitle: "Long enough to need the floating bar" }),
  S("why-no-blur", "Why the phone has no blur", "site", 12, ["design"], 3),
  S("ci-green-is-not-done", "Green CI is not the same as done", "site", 33, ["ci", "process"], 5),
  S("asking-docker", "Asking Docker what is running", "bothy", 6, ["docker"], 6, { featured: 2 }),
  S("one-port-one-service", "One port, one service", "bothy", 20, ["docker", "network"], 4),
  S("the-portal-catch-all", "The portal catch-all answers everything", "bothy", 41, ["network"], 7),
  S("a-window-for-one-screen", "A window manager for one screen", "windom", 9, ["design"], 5),
  S("tiling-is-a-promise", "Tiling is a promise about space", "windom", 52, ["design"], 3),
];

const PARA = (n) =>
  Array.from({ length: n }, (_, i) => `Paragraph ${i + 1} of the note. A merge to main puts code on the branch; it does not put it in front of anyone. That sounds like a technicality and it is the whole safety story of this site, so it gets said more than once, in more than one way.`).join("\n\n");

const LONG_BODY = `Opening paragraph with a [link to the projects](/projects) and \`inline code\`. It runs long enough to wrap on a phone.

## Why a tag

${PARA(3)}

> A tag builds nothing. It names a thing that already exists.

## What it costs

${PARA(4)}

- one extra command
- a rule the whole team keeps
- nobody tags a build they have not read

\`\`\`bash
git tag v1.7.1 && git push origin v1.7.1
\`\`\`

### A subsection

${PARA(5)}

## The order

${PARA(6)}

Closing paragraph, the last one before the tags.`;

const DETAIL = (s) => ({
  ...s,
  body: s.slug === "the-long-note" || s.slug === "merging-does-not-ship" ? LONG_BODY : `${PARA(3)}\n\n## A section\n\n${PARA(2)}`,
  links: s.slug === "merging-does-not-ship" ? [{ label: "Repository", url: "https://example.com/" }] : [],
});

/** A Playwright route handler for `**\/api/**`. */
export function handler() {
  return (r) => {
    const u = new URL(r.request().url());
    const p = u.pathname.replace(/^\/api/, "");
    const json = (status, body) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/blog/posts") {
      const c = u.searchParams.get("collection");
      return json(200, { items: SUMMARIES.filter((s) => !c || s.collection === c) });
    }
    if (p.startsWith("/blog/posts/")) {
      const s = SUMMARIES.find((x) => p.endsWith(`/${x.slug}`));
      return s ? json(200, { post: DETAIL(s) }) : json(404, {});
    }
    if (p === "/areas") return json(200, { items: AREAS });
    if (p === "/blog/collections") return json(200, { items: AREAS.filter((a) => a.kind === "project") });
    if (p.startsWith("/blog/collections/")) {
      const a = AREAS.find((x) => p.endsWith(`/${x.slug}`));
      return a ? json(200, { collection: a }) : json(404, {});
    }
    const { status, body } = answer(r.request().url(), false);
    r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
  };
}
