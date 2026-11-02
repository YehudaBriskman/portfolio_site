import { z } from "zod";

export const SlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by single hyphens");

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
  seo: z
    .object({
      title: z.string().nullable().default(null),
      description: z.string().nullable().default(null),
      canonical: z.string().url().nullable().default(null),
      noindex: z.boolean().default(false),
    })
    .default({ title: null, description: null, canonical: null, noindex: false }),
});

export type Post = z.infer<typeof PostSchema>;

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
    coverImage: p.coverImage,
    readingMinutes: p.readingMinutes,
    // Read straight from CouchDB, so a document written before the field
    // existed carries nothing; null is "not featured", never undefined.
    featured: p.featured ?? null,
    /* When the note was last saved (#225), for the area page's "updated"
       mark. The admin save path stamps it on every write; a legacy document
       without one says null rather than nothing. */
    updatedAt: p.updatedAt ?? null,
  };
}

export function toPublicPost(p: Post) {
  return { ...toPublicSummary(p), body: p.body, links: p.links, seo: p.seo };
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
  links: z.array(z.object({ label: z.string().min(1).max(60), url: z.string().url() })).max(8).default([]),
  order: z.number().int().default(50),
  status: z.enum(["published", "hidden"]).default("published"),
  kind: z.enum(["site", "project"]).default("project"),
  tagline: z.string().max(160).default(""),
  repo: RepoSchema.nullable().default(null),
  stats: RepoStatsSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Collection = z.infer<typeof CollectionSchema>;

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
    coverImage: c.coverImage,
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
