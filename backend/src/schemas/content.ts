import { z } from "zod";
import { Fingerprint } from "./i18n.js";

export const SlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by single hyphens");

/*
 * A GitHub file link, as an address that returns the file's bytes.
 *
 * A cover image is pasted in by hand, and the link a person copies off GitHub
 * is the `/blob/` page: an HTML document, not an image. Rewriting the host to
 * raw.githubusercontent.com without dropping `/blob/` is the other common
 * mistake, and it 404s — WindoM's og:image did exactly that. Both forms, and
 * github.com's `/raw/` redirect, become `raw.githubusercontent.com/{owner}/
 * {repo}/{ref}/{path}`. Anything else is returned untouched.
 *
 * Applied where a URL is written (admin saves) and where it is read (the
 * public API and the rendered head), so a value stored before this existed is
 * corrected on the way out without a migration.
 */
export function rawImageUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let rest: string[] | null = null;
  if ((host === "github.com" || host === "www.github.com") && (parts[2] === "blob" || parts[2] === "raw")) {
    rest = [parts[0], parts[1], ...parts.slice(3)];
  } else if (host === "raw.githubusercontent.com" && parts[2] === "blob") {
    rest = [parts[0], parts[1], ...parts.slice(3)];
  }
  // owner, repo, ref and at least one path segment, or it is not a file link.
  if (!rest || rest.length < 4) return value;
  return `https://raw.githubusercontent.com/${rest.join("/")}`;
}

/** rawImageUrl over a nullable field. */
export function rawImageUrlOrNull(value: string | null | undefined): string | null {
  return value ? rawImageUrl(value) : null;
}

/* A URL an author may put in front of a reader: http(s) only. z.string().url()
   alone accepts javascript: and data:, since both parse as URLs. */
const httpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), { message: "Must be an http(s) address." });

const LinkItemSchema = z.object({ label: z.string().min(1).max(60), url: httpUrl });

export const PostSeoSchema = z.object({
  title: z.string().max(200).nullable().default(null),
  description: z.string().max(320).nullable().default(null),
  canonical: httpUrl.nullable().default(null),
  noindex: z.boolean().default(false),
});

export const PostHebrewSchema = z.object({
  title: z.string().max(200).default(""),
  subtitle: z.string().max(300).default(""),
  excerpt: z.string().max(320).default(""),
  body: z.string().max(200_000).default(""),
});

/*
 * What the server keeps beside a `he` block (#303, schemas/i18n.ts): per
 * field, the fingerprint of the English the Hebrew was written against, and a
 * note's English body as it was then. A sibling, not inside `he`, so every
 * reader of `he` still sees only words. Accepted on the way in so a round trip
 * keeps it, always restamped by the save routes, never sent to a reader.
 */
export const HebrewMetaSchema = z.object({
  src: z
    .object({ title: Fingerprint, subtitle: Fingerprint, excerpt: Fingerprint, body: Fingerprint, tagline: Fingerprint, description: Fingerprint })
    .partial()
    .default({}),
  bodyBase: z.string().max(200_000).nullable().optional(),
});

/*
 * Everything an author edits about a note, as one object (#250): what a
 * draft holds and what Publish copies onto the note. Validated on the way in
 * by the routes, so a draft in the store is always publishable as it is.
 */
export const PostContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().default(null),
  excerpt: z.string().max(320).default(""),
  body: z.string().max(200_000).default(""),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/).max(40)).max(8).default([]),
  collection: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("site"),
  coverImage: httpUrl.nullable().default(null),
  links: z.array(LinkItemSchema).max(8).default([]),
  featured: z.number().int().min(1).max(99).nullable().default(null),
  publishedAt: z.string().datetime().nullable().default(null),
  seo: PostSeoSchema.default({ title: null, description: null, canonical: null, noindex: false }),
  he: PostHebrewSchema.nullable().default(null),
  heMeta: HebrewMetaSchema.nullable().optional(),
});

/** The Hebrew of an area (#248): its name, its line and its description. */
export const CollectionHebrewSchema = z.object({
  title: z.string().max(120).nullable().default(null),
  tagline: z.string().max(160).nullable().default(null),
  description: z.string().max(400).nullable().default(null),
});

/** A Hebrew block with nothing in it is no Hebrew at all. */
function hebrewOrNull<T extends Record<string, string | null | undefined>>(he: T | null | undefined): T | null {
  if (!he) return null;
  return Object.values(he).some((v) => typeof v === "string" && v.trim() !== "") ? he : null;
}

export const PostSchema = z.object({
  _id: z.string().optional(),
  _rev: z.string().optional(),
  type: z.literal("post"),
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().default(null),
  excerpt: z.string().max(320),
  body: z.string(),
  bodyFormat: z.literal("markdown").default("markdown"),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
  /* Which shelf this sits on. "site" is writing about this site and the craft
     behind it; anything else is a project's own notes. */
  collection: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("site"),
  /* Where this post came from. Everything is authored today; leaving the field
     in place means a future repo ingest fills the same model with no migration. */
  source: z.enum(["authored", "git"]).default("authored"),
  coverImage: z.string().url().nullable().default(null),
  links: z.array(z.object({ label: z.string().min(1).max(60), url: z.string().url() })).max(8).default([]),
  readingMinutes: z.number().int().positive(),
  /* An optional hand-set order for "top posts": 1 comes first. The site keeps
     no analytics, so "top" cannot mean views; it means the owner's pick, then
     the newest. Null is not featured. */
  featured: z.number().int().min(1).max(99).nullable().default(null),
  seo: PostSeoSchema.default({ title: null, description: null, canonical: null, noindex: false }),
  /* The note in Hebrew (#250), when the owner has written it. Null is "not
     translated", and the reader then shows the English. */
  he: PostHebrewSchema.nullable().optional(),
  /* The fingerprints behind `he` (#303). Absent before #303: "unverified". */
  heMeta: HebrewMetaSchema.nullable().optional(),
  /* What the last re-publish changed (#250), one line, shown beside the
     "Updated" date. Null on a first publish. */
  changeNote: z.string().max(200).nullable().optional(),
  /*
   * Unpublished edits to a published note (#250): the editor's autosave
   * writes here and never to the fields above, so what the public reads
   * moves only on Publish. Null when there is nothing unpublished.
   */
  draft: PostContentSchema.nullable().optional(),
  draftSavedAt: z.string().datetime().nullable().optional(),
});

export type Post = z.infer<typeof PostSchema>;
export type PostContent = z.infer<typeof PostContentSchema>;

/** What the public sees. Never leaks status, _rev, or anything about drafts. */
export function toPublicSummary(p: Post) {
  return {
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    excerpt: p.excerpt,
    publishedAt: p.publishedAt,
    tags: p.tags,
    collection: p.collection,
    coverImage: rawImageUrlOrNull(p.coverImage),
    readingMinutes: p.readingMinutes,
    // Read straight from CouchDB, so a document written before the field
    // existed carries nothing; null is "not featured", never undefined.
    featured: p.featured ?? null,
    /* When the note was last saved (#225), for the area page's "updated"
       mark. The admin save path stamps it on every write; a legacy document
       without one says null rather than nothing. */
    updatedAt: p.updatedAt ?? null,
    /* The Hebrew, without the body: a listing never carries a body. */
    he: summaryHebrew(p),
  };
}

function summaryHebrew(p: Post) {
  const he = hebrewOrNull(p.he);
  return he ? { title: he.title || null, subtitle: he.subtitle || null, excerpt: he.excerpt || null } : null;
}

export function toPublicPost(p: Post) {
  /* Never `draft` or `draftSavedAt`: unpublished words stay in the admin. */
  return {
    ...toPublicSummary(p),
    body: p.body,
    links: p.links,
    seo: p.seo,
    changeNote: p.changeNote ?? null,
    he: p.he && (p.he.title || p.he.body) ? p.he : null,
  };
}

/** ~200 wpm, rounded up, floor of one. */
export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

/*
 * An area. Either the site's own writing ("site") or one project.
 *
 * A project can be linked to a GitHub repository, in which case its numbers are
 * fetched server-side on a schedule and stored here. Nothing is read from GitHub
 * at request time: a rate limit or an outage there must never affect a page load,
 * and stale-but-honest beats a spinner.
 */
export const RepoSchema = z.object({
  owner: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  branch: z.string().min(1).max(60).default("main"),
  /* Which paths may ever be published from the repo. Empty means nothing, and
     empty is the default on purpose — a repo holds plenty that was never meant
     to be public, and opting in beats discovering a leak. */
  docPaths: z.array(z.string().max(200)).max(20).default([]),
});

export const RepoStatsSchema = z.object({
  stars: z.number().int().nullable().default(null),
  forks: z.number().int().nullable().default(null),
  openIssues: z.number().int().nullable().default(null),
  language: z.string().nullable().default(null),
  license: z.string().nullable().default(null),
  pushedAt: z.string().nullable().default(null),
  latestRelease: z.object({ tag: z.string(), url: z.string(), publishedAt: z.string().nullable() }).nullable().default(null),
  fetchedAt: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});

export const CollectionSchema = z.object({
  _id: z.string().optional(),
  _rev: z.string().optional(),
  type: z.literal("collection"),
  slug: SlugSchema,
  title: z.string().min(1).max(120),
  description: z.string().max(400).default(""),
  coverImage: z.string().url().nullable().default(null),
  /* An icon from the media library (#253). Absent on documents from before it. */
  icon: z.string().url().nullable().optional(),
  links: z.array(z.object({ label: z.string().min(1).max(60), url: z.string().url() })).max(8).default([]),
  order: z.number().int().default(50),
  status: z.enum(["published", "hidden"]).default("published"),
  kind: z.enum(["site", "project"]).default("project"),
  tagline: z.string().max(160).default(""),
  he: CollectionHebrewSchema.nullable().optional(),
  /* The fingerprints behind `he` (#303). */
  heMeta: HebrewMetaSchema.nullable().optional(),
  repo: RepoSchema.nullable().default(null),
  stats: RepoStatsSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Collection = z.infer<typeof CollectionSchema>;

function collectionHebrew(c: Collection) {
  const he = hebrewOrNull(c.he);
  return he ? { title: he.title ?? null, tagline: he.tagline ?? null, description: he.description ?? null } : null;
}

export function toPublicCollection(c: Collection) {
  return {
    slug: c.slug,
    title: c.title,
    /*
     * Documents written before `kind` existed do not carry it, and these are
     * read straight from CouchDB rather than through the schema, so no default
     * applies. Undefined then became "project" on the client and the site's own
     * notes shelf turned up on /projects. The slug is the reliable signal for
     * those legacy documents.
     */
    kind: c.kind ?? (c.slug === "site" ? "site" : "project"),
    tagline: c.tagline,
    description: c.description,
    he: collectionHebrew(c),
    coverImage: rawImageUrlOrNull(c.coverImage),
    // Documents from before #253 carry no icon; read raw, so no default applies.
    icon: c.icon ?? null,
    links: c.links,
    order: c.order,
    // The repo config itself stays private — it names paths and branches. Only
    // the numbers, a link to the repo and the paths the owner opted in to
    // publishing (`docPaths`) are public.
    repoUrl: c.repo ? `https://github.com/${c.repo.owner}/${c.repo.name}` : null,
    docs: publicDocs(c.repo),
    stats: c.stats
      ? {
          stars: c.stats.stars,
          // `forks` and `fetchedAt` (#225): the area page shows each fact with
          // the time it was read. Older documents carry neither.
          forks: c.stats.forks ?? null,
          language: c.stats.language,
          license: c.stats.license,
          pushedAt: c.stats.pushedAt,
          latestRelease: c.stats.latestRelease,
          fetchedAt: c.stats.fetchedAt ?? null,
        }
      : null,
  };
}

/*
 * The repo docs an area may link (#225): one GitHub link per opted-in path.
 * `docPaths` is the owner's explicit list of what may ever be published, so
 * a path that is in it is public by definition; a repo with none gives none.
 */
export function publicDocs(repo: Collection["repo"]): { path: string; url: string }[] {
  if (!repo) return [];
  return (repo.docPaths ?? [])
    .map((raw) => raw.trim().replace(/^\/+/, ""))
    .filter((path) => path.length > 0 && !path.split("/").includes(".."))
    .map((path) => ({
      path,
      url: `https://github.com/${repo.owner}/${repo.name}/blob/${encodeURIComponent(repo.branch ?? "main")}/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    }));
}

/*
 * This site's own releases, `v*` tags on the portfolio repository.
 *
 * Fetched on the same schedule as the area stats and stored in one document,
 * so the activity feed reads a stored list and never calls GitHub during a
 * request. A failed fetch keeps the last good list and records why.
 */
export const SiteReleaseSchema = z.object({
  tag: z.string(),
  name: z.string().nullable().default(null),
  url: z.string(),
  publishedAt: z.string(),
});

export const SiteReleasesSchema = z.object({
  _id: z.literal("site-releases"),
  _rev: z.string().optional(),
  type: z.literal("site-releases"),
  repo: z.object({ owner: z.string(), name: z.string() }),
  items: z.array(SiteReleaseSchema).max(100).default([]),
  fetchedAt: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});

export type SiteRelease = z.infer<typeof SiteReleaseSchema>;
export type SiteReleases = z.infer<typeof SiteReleasesSchema>;
