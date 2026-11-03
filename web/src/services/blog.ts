import { z } from "zod";
import { INTL } from "@/components/dashboard/i18n";
import { currentLang } from "@/i18n/routing";

const LinkSchema = z.object({ label: z.string(), url: z.string() });

/*
 * The owner's Hebrew for a post or an area (#248), field by field. Absent or
 * null where nothing is translated. `local()` puts each translated field in
 * place of the English on a Hebrew page; a field left out stays English, and
 * the components mark it so with `inEnglish()`.
 */
const HebrewSchema = z.record(z.string(), z.string().nullable()).nullable().optional();

const SummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  excerpt: z.string(),
  publishedAt: z.string().nullable(),
  tags: z.array(z.string()),
  collection: z.string().default("site"),
  coverImage: z.string().nullable().default(null),
  readingMinutes: z.number(),
  /* The owner's pick for "top posts", 1 first; null is not featured. */
  featured: z.number().nullable().optional(),
  /* Last saved (#225); an "updated" mark when well after publishing. */
  updatedAt: z.string().nullable().optional(),
  he: HebrewSchema,
});

const PostSchema = SummarySchema.extend({
  body: z.string(),
  links: z.array(LinkSchema).default([]),
  /* What the last re-publish changed (#250), beside the "Updated" date. */
  changeNote: z.string().nullable().optional(),
});

const StatsSchema = z.object({
  stars: z.number().nullable(),
  forks: z.number().nullable().optional(),
  language: z.string().nullable(),
  license: z.string().nullable(),
  pushedAt: z.string().nullable(),
  latestRelease: z.object({ tag: z.string(), url: z.string(), publishedAt: z.string().nullable() }).nullable(),
  /* When the scheduled job read these numbers (#225): every fact's "as of". */
  fetchedAt: z.string().nullable().optional(),
});

const CollectionSchema = z.object({
  slug: z.string(),
  title: z.string(),
  tagline: z.string().default(""),
  description: z.string(),
  coverImage: z.string().nullable(),
  links: z.array(LinkSchema),
  order: z.number(),
  kind: z.enum(["site", "project"]).default("project"),
  repoUrl: z.string().nullable().default(null),
  stats: StatsSchema.nullable().default(null),
  /* The repo paths the owner opted in to publishing, as GitHub links (#225). */
  docs: z.array(z.object({ path: z.string(), url: z.string() })).optional(),
  he: HebrewSchema,
});

export type PostSummary = z.infer<typeof SummarySchema>;
export type Post = z.infer<typeof PostSchema>;
export type Collection = z.infer<typeof CollectionSchema>;

/* Shared with services/activity.ts, which extends the area with its counts. */
export { CollectionSchema, SummarySchema };

/**
 * "Top posts" without analytics: featured ones in their order, then the
 * newest. The site keeps no view counts, so this is the owner's pick.
 */
export function topPosts<T extends Pick<PostSummary, "featured" | "publishedAt">>(posts: T[], n = 3): T[] {
  return [...posts]
    .sort((a, b) => {
      if (a.featured != null || b.featured != null) {
        if (a.featured == null) return 1;
        if (b.featured == null) return -1;
        if (a.featured !== b.featured) return a.featured - b.featured;
      }
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    })
    .slice(0, n);
}

/**
 * A post or an area in the page's language: every field the owner translated
 * replaces its English, and the rest stay as they are.
 */
export function local<T extends { he?: Record<string, string | null> | null }>(doc: T, lang = currentLang()): T {
  if (lang !== "he" || !doc.he) return doc;
  const out: Record<string, unknown> = { ...doc };
  for (const [k, v] of Object.entries(doc.he)) if (typeof v === "string" && v.trim() !== "" && k in doc) out[k] = v;
  return out as T;
}

/** The envelope every blog endpoint returns; the payload is validated by zod. */
type JsonEnvelope = Record<string, unknown>;

async function get<T>(path: string, schema: z.ZodType<T>, pick: (j: JsonEnvelope) => unknown): Promise<T> {
  const res = await fetch(`/api/blog${path}`);
  if (res.status === 404) throw new Error("not-found");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  // An unreachable API is answered by nginx with the SPA shell; without this
  // the reader gets a JSON parser error instead of a reason.
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Couldn't reach the server.");
  }
  const envelope: JsonEnvelope = typeof body === "object" && body !== null ? (body as JsonEnvelope) : {};
  return schema.parse(pick(envelope));
}

export const blog = {
  posts: (opts: { tag?: string; collection?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.tag) q.set("tag", opts.tag);
    if (opts.collection) q.set("collection", opts.collection);
    const qs = q.toString();
    return get(`/posts${qs ? `?${qs}` : ""}`, z.array(SummarySchema), (j) => j.items ?? []).then((l) => l.map((p) => local(p)));
  },
  post: (slug: string) => get(`/posts/${encodeURIComponent(slug)}`, PostSchema, (j) => j.post).then((p) => local(p)),
  collections: () => get("/collections", z.array(CollectionSchema), (j) => j.items ?? []).then((l) => l.map((c) => local(c))),
  collection: (slug: string) =>
    get(`/collections/${encodeURIComponent(slug)}`, CollectionSchema, (j) => j.collection).then((c) => local(c)),
};

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(INTL[currentLang()], { day: "numeric", month: "long", year: "numeric" });
}

/*
 * Ages a timestamp into something scannable. "pushed 3 days ago" carries the
 * only thing the reader wants from a push date — is this alive — where
 * "12 February 2026" makes them do the subtraction themselves.
 */
export function relativeTime(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 18) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.round(days / 365.25);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
