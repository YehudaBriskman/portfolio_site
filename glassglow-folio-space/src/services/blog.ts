import { z } from "zod";

const LinkSchema = z.object({ label: z.string(), url: z.string() });

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
});

const PostSchema = SummarySchema.extend({
  body: z.string(),
  links: z.array(LinkSchema).default([]),
});

const StatsSchema = z.object({
  stars: z.number().nullable(),
  language: z.string().nullable(),
  license: z.string().nullable(),
  pushedAt: z.string().nullable(),
  latestRelease: z.object({ tag: z.string(), url: z.string(), publishedAt: z.string().nullable() }).nullable(),
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
});

export type PostSummary = z.infer<typeof SummarySchema>;
export type Post = z.infer<typeof PostSchema>;
export type Collection = z.infer<typeof CollectionSchema>;

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
    return get(`/posts${qs ? `?${qs}` : ""}`, z.array(SummarySchema), (j) => j.items ?? []);
  },
  post: (slug: string) => get(`/posts/${encodeURIComponent(slug)}`, PostSchema, (j) => j.post),
  collections: () => get("/collections", z.array(CollectionSchema), (j) => j.items ?? []),
  collection: (slug: string) =>
    get(`/collections/${encodeURIComponent(slug)}`, CollectionSchema, (j) => j.collection),
};

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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
