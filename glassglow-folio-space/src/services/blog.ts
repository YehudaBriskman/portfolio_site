import { z } from "zod";

const SummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  excerpt: z.string(),
  publishedAt: z.string().nullable(),
  tags: z.array(z.string()),
  readingMinutes: z.number(),
});

const PostSchema = SummarySchema.extend({
  body: z.string(),
  seo: z
    .object({
      title: z.string().nullable(),
      description: z.string().nullable(),
      canonical: z.string().nullable(),
      noindex: z.boolean(),
    })
    .optional(),
});

export type PostSummary = z.infer<typeof SummarySchema>;
export type Post = z.infer<typeof PostSchema>;

/* Responses are validated rather than trusted. The store is separate from the
   app and can be written to by the admin surface; a shape change should surface
   as a clean error here, not as undefined halfway down a render. */
export async function fetchPosts(tag?: string): Promise<PostSummary[]> {
  const res = await fetch(`/api/blog/posts${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`);
  if (!res.ok) throw new Error(`Couldn't load posts (${res.status})`);
  const json = await res.json();
  return z.array(SummarySchema).parse(json.items ?? []);
}

export async function fetchPost(slug: string): Promise<Post> {
  const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new Error("not-found");
  if (!res.ok) throw new Error(`Couldn't load that post (${res.status})`);
  const json = await res.json();
  return PostSchema.parse(json.post);
}

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
