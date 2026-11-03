/*
 * The site the audits run against: `vite preview` on a fresh port, and the
 * API answered from fixtures. Split out of axe-routes.mjs (#247) so the
 * theme screenshots (scripts/shoot-themes.mjs) shoot the same pages the
 * audit measures, from the same data.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/* ---------------------------------------------------------------- fixtures */

const at = (days) => new Date(Date.UTC(2026, 9, 1) - days * 86_400_000).toISOString();

/* The one area the fixture note is filed under, and two events for the
   dashboard's timeline: one on the site, one leaving it. */
const AREA = {
  slug: "site",
  title: "The site",
  tagline: "This portfolio.",
  description: "",
  coverImage: null,
  links: [],
  order: 0,
  kind: "site",
  repoUrl: null,
  stats: null,
  noteCount: 1,
  lastActivityAt: at(1),
  topics: [{ tag: "ci", count: 1 }],
};
/* A project area linked to a repo (#225): its facts, docs and side card. */
const BOTHY = {
  ...AREA,
  slug: "bothy",
  title: "Bothy",
  tagline: "The box's portal.",
  kind: "project",
  repoUrl: "https://github.com/example/bothy",
  docs: [{ path: "docs/README.md", url: "https://github.com/example/bothy/blob/main/docs/README.md" }],
  stats: {
    stars: 12,
    forks: 3,
    language: "TypeScript",
    license: "MIT",
    pushedAt: at(2),
    latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at(5) },
    fetchedAt: at(1),
  },
};
const EVENTS = [
  { id: "post:fixture-post", kind: "post", at: at(1), area: { slug: "site", title: "The site" }, title: "A fixture note", href: "/blog/fixture-post", meta: {} },
  { id: "site:v1", kind: "site", at: at(3), area: null, title: "Site v1.0.0", href: "https://github.com/example/site/releases/tag/v1.0.0", meta: {} },
  /* Work (#227): a project's release and push, for the cards' strips, the
     releases aside and the project page's Releases tab. */
  { id: "release:bothy:v1.9.0", kind: "release", at: at(4), area: { slug: "bothy", title: "Bothy" }, title: "Bothy v1.9.0", href: "https://github.com/example/bothy/releases/tag/v1.9.0", meta: { tag: "v1.9.0" } },
  { id: "push:bothy", kind: "push", at: at(2), area: { slug: "bothy", title: "Bothy" }, title: "Pushed to Bothy", href: "https://github.com/example/bothy", meta: {} },
];

const SUMMARY = {
  slug: "fixture-post",
  title: "A fixture note for the audit",
  subtitle: "Long enough to wrap at 320px, which is the point of it",
  excerpt: "A short excerpt, so the list has the shape it has in production.",
  publishedAt: at(3),
  updatedAt: at(1),
  tags: ["accessibility", "process"],
  collection: "site",
  coverImage: null,
  readingMinutes: 2,
};

/* The body exercises what the prose renderer emits: headings below the
   page's h1, a list, a link, inline and fenced code, a table, a quote. */
const BODY = `Opening paragraph with a [link to the projects](/projects) and \`inline code\`.

## A section

- one
- two

> A quotation, set as the prose renders it.

\`\`\`ts
const audited = true;
\`\`\`

| Criterion | Status |
| --- | --- |
| 1.4.10 | pass |

### A subsection

Closing paragraph.`;

const POST = { ...SUMMARY, body: BODY, links: [{ label: "Repository", url: "https://example.com/" }] };

function contributionDays() {
  const days = [];
  const end = Date.UTC(2026, 9, 1);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, count: (i * 7) % 5 === 0 ? 0 : (i * 13) % 9 });
  }
  return days;
}

export function answer(url, failing) {
  if (failing) return { status: 503, body: { error: "unavailable" } };
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/blog/posts") return { status: 200, body: { items: [SUMMARY] } };
  if (p.startsWith("/blog/posts/")) {
    return p.endsWith("/fixture-post") ? { status: 200, body: { post: POST } } : { status: 404, body: {} };
  }
  if (p === "/blog/collections") return { status: 200, body: { items: [] } };
  if (p.startsWith("/blog/collections/")) return { status: 404, body: {} };
  /* The Blogs dashboard (#224): its areas and the site's activity. */
  if (p === "/areas") return { status: 200, body: { items: [AREA, BOTHY] } };
  if (p === "/activity") return { status: 200, body: { items: EVENTS, nextCursor: null } };
  if (p === "/github/contributions") {
    const days = contributionDays();
    return {
      status: 200,
      body: {
        contributions: {
          from: days[0].date,
          to: days.at(-1).date,
          total: days.reduce((n, d) => n + d.count, 0),
          days,
          fetchedAt: at(0),
          error: null,
        },
      },
    };
  }
  return { status: 404, body: {} };
}

/* ------------------------------------------------------------------ server */

/* A port the OS hands out, never a fixed one. The first version of this
   script used a fixed port, found someone else's static server already on
   it, and audited a directory listing — clean. So the port is fresh, and the
   page that answers must be this site's before anything is measured. */
function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", fail);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
  });
}

async function isThisSite(base) {
  const res = await fetch(base);
  return res.ok && (await res.text()).includes('id="root"');
}

export async function startPreview() {
  if (process.env.BASE) {
    if (!(await isThisSite(process.env.BASE))) throw new Error(`${process.env.BASE} is not this site`);
    return { base: process.env.BASE, stop: () => {} };
  }
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [resolve(WEB, "node_modules/vite/bin/vite.js"), "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    { cwd: WEB, stdio: ["ignore", "pipe", "pipe"] },
  );
  let exited = false;
  child.on("exit", () => (exited = true));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      if (await isThisSite(base)) return { base, stop: () => child.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error("vite preview never answered with this site — was `npm run build` run first?");
}

