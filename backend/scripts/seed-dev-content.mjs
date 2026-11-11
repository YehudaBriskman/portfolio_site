/*
 * Fixture content for a local content store.
 *
 * THESE ARE NOT POSTS. Nothing here is written as if it were the owner's
 * writing, and none of it should ever reach a real database — every title
 * says what it is, and the seed refuses to run against anything but a
 * loopback CouchDB.
 *
 * Its job is to exercise the notes surface's rendering paths (code, figure,
 * table, long article, covers, two collections, a draft that must never be
 * public); the fixture titles say which is which.
 *
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *   node backend/scripts/seed-dev-content.mjs
 *
 * The areas, and the notes filed under them, are different: they are the
 * reviewed drafts in backend/content/, read through content-files.mjs, so a
 * local /blog shows the real text. They reach a real database only through
 * import-content.mjs and the admin API, never through this script.
 *
 *   node backend/scripts/seed-dev-content.mjs --drafts-only   # no fixture posts
 *
 * Idempotent: documents carry fixed ids and are overwritten in place, so
 * running it twice changes nothing.
 */
import { loadContent, toCollectionWrite, toPostWrite } from "./content-files.mjs";

const URL_BASE = process.env.COUCHDB_URL ?? "http://127.0.0.1:5984";
const USER = process.env.COUCHDB_USER ?? "portfolio_api";
const PASS = process.env.COUCHDB_PASSWORD ?? "devonly";
const DB = "portfolio_content";

/*
 * The guard, and it is not decoration. This script writes fixture text with
 * "Fixture" in every title; running it against the real store would publish
 * that to the site.
 */
const host = new URL(URL_BASE).hostname;
if (!["127.0.0.1", "localhost", "::1", "couch"].includes(host)) {
  console.error(`refusing to seed ${host}: this script is for a local store only`);
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const headers = { Authorization: auth, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const res = await fetch(`${URL_BASE}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

const now = new Date().toISOString();
const at = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

/** ~200 wpm, rounded, floor of one — the same sum the API does. */
const minutes = (body) => Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));

const CODE_BODY = `
Fixture text. Everything below exists so the renderer has something to render.

## A fenced block, shell

\`\`\`bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
node backend/scripts/seed-dev-content.mjs
\`\`\`

## A fenced block, TypeScript

\`\`\`ts
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
\`\`\`

## A fenced block, YAML

\`\`\`yaml
services:
  couch:
    image: couchdb:3.4
    ports:
      - "127.0.0.1:5984:5984"
\`\`\`

## A table

| format | widths | purpose |
| --- | --- | --- |
| AVIF | 800 / 1200 / 1920 | the plate a section stands on |
| WebP | 800 / 1200 / 1920 | the fallback that covers the rest |
| JPEG | 1200 | the \`src\` of last resort |

## A quote

> A margin is a gap, not a line-break opportunity.

And a closing paragraph, so the article does not end on a block.
`.trim();

const LONG_BODY = [
  "Fixture text. This one is deliberately long, because the reading bar measures the article rather than the document and a short post cannot show whether that is true.",
  ...Array.from({ length: 14 }, (_, i) =>
    `## Section ${i + 1}\n\n` +
    "Paragraph of fixture prose, present only to give the page height. " .repeat(6) +
    "\n\n" +
    "A second paragraph in the same section, for the same reason. ".repeat(5)
  ),
].join("\n\n");

const SHORT_BODY = `
Fixture text, short on purpose: an article shorter than the viewport has no
scroll travel at all, which is the case that makes a progress bar divide by
zero if nobody thought about it.

![A graded plate](/plates/plate-evening-1200.jpg)

One paragraph after the figure, so the figure is not the last thing.
`.trim();

const posts = [
  {
    id: "post:fixture-rendering",
    slug: "fixture-rendering",
    title: "Fixture — code, tables and quotes",
    subtitle: "Every block the renderer has to handle, in one place",
    body: CODE_BODY,
    tags: ["fixture", "rendering"],
    collection: "site",
    coverImage: null,
    days: 2,
  },
  {
    id: "post:fixture-long",
    slug: "fixture-long-read",
    title: "Fixture — a long read",
    subtitle: "Enough height to show the reading bar telling the truth",
    body: LONG_BODY,
    tags: ["fixture"],
    collection: "site",
    coverImage: "http://localhost:8080/plates/plate-night-1200.jpg",
    days: 9,
  },
  {
    id: "post:fixture-short",
    slug: "fixture-short",
    title: "Fixture — shorter than the viewport",
    subtitle: null,
    body: SHORT_BODY,
    tags: ["fixture", "edge-case"],
    collection: "site",
    coverImage: null,
    days: 21,
  },
  {
    id: "post:fixture-project-note",
    slug: "fixture-project-note",
    title: "Fixture — a note filed under a project",
    subtitle: "So the collection filter has two shelves to choose between",
    body:
      "Fixture text. This one belongs to a project rather than to the site, which is the case " +
      "the index used to hide entirely: it filtered to `collection: \"site\"` and every project " +
      "note was unreachable except by guessing a tag.",
    tags: ["fixture"],
    collection: "windom",
    coverImage: null,
    days: 30,
  },
  {
    id: "post:fixture-draft",
    slug: "fixture-draft",
    title: "Fixture — draft, must never be public",
    subtitle: "If this appears on /blog, the selector is wrong",
    body: "Fixture text. A draft must not travel over the wire at all.",
    tags: ["fixture"],
    collection: "site",
    coverImage: null,
    days: 1,
    status: "draft",
  },
];

/*
 * The areas are the reviewed drafts in backend/content/areas, not fixtures:
 * an area page is mostly its header, and a header reading "Fixture" shows
 * nothing about how the real one sits. Same for the notes below, which are
 * the reviewed drafts in backend/content/posts and are written alongside the
 * fixture posts. `--drafts-only` leaves the fixture posts out, for
 * screenshots of what the real content looks like.
 */
const DRAFTS_ONLY = process.argv.includes("--drafts-only");
const content = loadContent();

const collections = content.areas.map(({ data }) => ({
  _id: `collection:${data.slug}`,
  type: "collection",
  ...toCollectionWrite(data),
  stats: null,
  createdAt: now,
  updatedAt: now,
}));

const draftDocs = content.posts.map((post) => {
  const w = toPostWrite(post);
  return {
    _id: `post:${w.slug}`,
    type: "post",
    ...w,
    bodyFormat: "markdown",
    createdAt: w.publishedAt ?? now,
    updatedAt: w.publishedAt ?? now,
    source: "authored",
    readingMinutes: minutes(w.body),
    seo: { title: null, description: null, canonical: null, noindex: false },
  };
});

async function main() {
  const created = await call(`/${DB}`, { method: "PUT" });
  if (created.ok) console.log(`created database ${DB}`);
  else if (created.status === 412) console.log(`database ${DB} already exists`);
  else {
    console.error("could not create the database:", created.status, created.body);
    process.exit(1);
  }

  /*
   * The API sorts posts by type, status and publishedAt, and Mango refuses a
   * sort it has no index for. Without this every /posts request answers 400
   * and the page shows its error card, which looks exactly like the store
   * being down.
   */
  const index = await call(`/${DB}/_index`, {
    method: "POST",
    body: JSON.stringify({
      index: { fields: ["type", "status", "publishedAt"] },
      name: "type-status-publishedAt",
      type: "json",
    }),
  });
  console.log(`index: ${index.body.result ?? index.status}`);

  const fixtures = DRAFTS_ONLY ? [] : posts;
  const docs = [
    ...collections,
    ...draftDocs,
    ...fixtures.map((p) => ({
      _id: p.id,
      type: "post",
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      excerpt: p.body.replace(/[#>`*|\-\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
      body: p.body,
      bodyFormat: "markdown",
      status: p.status ?? "published",
      publishedAt: p.status === "draft" ? null : at(p.days),
      createdAt: at(p.days + 1),
      updatedAt: at(p.days),
      tags: p.tags,
      collection: p.collection,
      source: "authored",
      coverImage: p.coverImage,
      links: [],
      readingMinutes: minutes(p.body),
      seo: { title: null, description: null, canonical: null, noindex: false },
    })),
  ];

  for (const doc of docs) {
    /* Carry the current _rev so a second run overwrites rather than conflicts. */
    const existing = await call(`/${DB}/${encodeURIComponent(doc._id)}`);
    const payload = existing.ok ? { ...doc, _rev: existing.body._rev } : doc;
    const put = await call(`/${DB}/${encodeURIComponent(doc._id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    console.log(`${put.ok ? "ok  " : "FAIL"} ${doc._id}${put.ok ? "" : ` ${put.status} ${JSON.stringify(put.body)}`}`);
  }

  console.log(
    `\nseeded ${draftDocs.length} reviewed notes, ${fixtures.filter((p) => p.status !== "draft").length} fixture posts, ` +
      `${fixtures.filter((p) => p.status === "draft").length} draft, ${collections.length} collections`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
