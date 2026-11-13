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

/* The note editor (#250) opens a published note that has unpublished changes,
   so the audit sees the draft notice, the toolbar and the preview at once. */
const SEO = { title: null, description: null, canonical: null, noindex: false };
const ADMIN_POST = {
  ...POST,
  _id: "post:fixture-post",
  _rev: "2-a",
  status: "published",
  updatedAt: SUMMARY.publishedAt,
  featured: null,
  seo: SEO,
  he: null,
  changeNote: null,
  draft: {
    title: SUMMARY.title,
    subtitle: SUMMARY.subtitle,
    excerpt: SUMMARY.excerpt,
    body: `${BODY}\n\nOne more paragraph, not yet published.`,
    tags: SUMMARY.tags,
    collection: SUMMARY.collection ?? "site",
    coverImage: null,
    links: POST.links,
    featured: null,
    publishedAt: SUMMARY.publishedAt,
    seo: SEO,
    he: null,
  },
  draftSavedAt: SUMMARY.publishedAt,
};

function contributionDays() {
  const days = [];
  const end = Date.UTC(2026, 9, 1);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, count: (i * 7) % 5 === 0 ? 0 : (i * 13) % 9 });
  }
  return days;
}

/* The media library (#253): a picture in use, one not, an icon and a video.
   The thumbnails are inline, so the run asks nothing of an image server. */
const SWATCH = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#3a6f8f"/></svg>')}`;
const mediaItem = (id, alt, usedBy, extra = {}) => ({
  id,
  _rev: "1-a",
  name: `${id}.jpg`,
  alt,
  caption: "",
  credit: "",
  kind: "image",
  format: "jpeg",
  mime: "image/jpeg",
  file: null,
  width: 1600,
  height: 1200,
  bytes: 184_000,
  createdAt: at(3),
  updatedAt: at(3),
  url: `https://yehudabriskman.com/api/images/media/${id}`,
  preview: SWATCH,
  srcset: { avif: "", webp: "" },
  largest: { avif: null, webp: SWATCH },
  usedBy,
  ...extra,
});
const MEDIA = [
  mediaItem("fixture-media", "A cabin under the aurora, with a clock and a greeting over it.", [
    { id: "collection:site", type: "collection", title: "The site", slug: "site", field: "coverImage" },
  ], { he: { alt: "בקתה תחת זוהר הצפון, ומעליה שעון וברכה.", caption: "" } }),
  mediaItem("unused-media", "An orange sports car on a coastal highway.", []),
  mediaItem("fixture-icon", "A leaf.", [], { kind: "icon", format: "svg", mime: "image/svg+xml", file: SWATCH, monochrome: true, width: 24, height: 24, bytes: 412 }),
  // No video file to fetch here: the detail draws its poster and controls, which is what axe judges.
  mediaItem("fixture-video", "A walk through the dashboard, from the list to one item.", [], {
    kind: "video",
    format: "mp4",
    mime: "video/mp4",
    file: "/api/images/m/fixture-video/video-aaaaaaaaaaaaaaaa.mp4",
    durationMs: 12_000,
    hasAudio: false,
    captions: { url: "/api/images/m/fixture-video/captions-bbbbbbbbbbbbbbbb.vtt", lang: "en", label: "English" },
    /* Captions per language (#306): the admin lists each, a page shows its own. */
    tracks: [
      { url: "/api/images/m/fixture-video/captions-bbbbbbbbbbbbbbbb.vtt", lang: "en", label: "English" },
      { url: "/api/images/m/fixture-video/captions-cccccccccccccccc.vtt", lang: "he", label: "עברית" },
    ],
  }),
];

/* The settings document as /api/admin/settings serves it (#254). */
const DEFAULT_SETTINGS = {
  home: { sections: ["work", "approach", "city", "notes", "stack", "contact"].map((id) => ({ id, visible: true })) },
  visuals: { theme: "system", motion: "on", accent: "ink" },
  /* Without this group the settings page throws and the error boundary answers
     in its place (a sweep that measured the boundary, not the page). */
  sharing: {
    enabled: true,
    surfaces: ["post", "note", "project", "area", "story", "home"],
    channels: ["native", "copy", "linkedin", "email", "gmail", "x", "whatsapp", "instagram"],
    utm: { enabled: true, source: "share" },
    templates: { en: {}, he: {} },
  },
};
const SETTINGS_VIEW = {
  ok: true,
  exists: true,
  _rev: "1-fixture",
  version: 1,
  updatedAt: at(0),
  settings: DEFAULT_SETTINGS,
  history: [{ version: 0, at: at(1), settings: DEFAULT_SETTINGS }],
};

/* The translations report (#302): one item in each state the page shows. */
const u = (path, status, primary = true) => ({
  path, status, primary, en: path,
  he: status === "missing" || status === "draft" ? null : "עברית",
  draftHe: status === "draft" ? "טיוטה" : null,
});
const TRANSLATIONS = {
  ok: true,
  counts: { missing: 6, draft: 1, stale: 1, unverified: 1, translated: 3 },
  coverage: 42,
  items: [
    { type: "site-copy", id: "hero", title: "Home · hero", route: "/", rank: 0, visibility: "public", status: "missing", units: [u("title", "missing"), u("phrases.0", "missing"), u("phrases.1", "missing")] },
    { type: "project", id: "windom", title: "WindoM", route: "/projects/windom", rank: 10, visibility: "public", status: "stale", units: [u("fact", "stale"), u("description", "translated"), u("decisions.0.body", "missing", false), u("decisions.1.body", "missing", false)] },
    { type: "story", id: "start", title: "Story · start", route: "/story", rank: 30, visibility: "public", status: "unverified", units: [u("title", "unverified"), u("lines.0", "translated")] },
    { type: "area", id: "bothy", title: "Bothy", route: "/blog/area/bothy", rank: 50, visibility: "public", status: "translated", units: [u("title", "translated")] },
    { type: "post", id: "fixture-post", title: "A fixture note", route: "/blog/fixture-post", rank: 100, visibility: "public", status: "missing", units: [u("title", "missing")] },
    { type: "post", id: "a-draft", title: "Draft: the site in Hebrew", route: "/blog/a-draft", rank: 101, visibility: "private", status: "draft", units: [u("title", "draft")] },
  ],
};

export function answer(url, failing) {
  if (failing) return { status: 503, body: { error: "unavailable" } };
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/admin/me") return { status: 200, body: { ok: true, login: "owner", email: null } };
  if (p === "/admin/media") return { status: 200, body: { ok: true, items: MEDIA } };
  if (p === "/admin/posts") return { status: 200, body: { ok: true, items: [ADMIN_POST] } };
  if (p === "/admin/posts/fixture-post") return { status: 200, body: { ok: true, post: ADMIN_POST } };
  if (p === "/admin/collections") return { status: 200, body: { ok: true, items: [] } };
  if (p === "/admin/translations") return { status: 200, body: TRANSLATIONS };
  /* Site settings (#254): one saved version over the built-in defaults. */
  if (p === "/admin/settings") return { status: 200, body: SETTINGS_VIEW };
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

