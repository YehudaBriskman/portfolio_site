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

async function get<T>(path: string, schema: z.ZodType<T>, pick: (j: any) => unknown): Promise<T> {
  const res = await fetch(`/api/blog${path}`);
  if (res.status === 404) throw new Error("not-found");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return schema.parse(pick(await res.json()));
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
