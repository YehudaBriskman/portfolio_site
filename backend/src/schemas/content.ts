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
  readingMinutes: z.number().int().positive(),
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
    readingMinutes: p.readingMinutes,
  };
}

export function toPublicPost(p: Post) {
  return { ...toPublicSummary(p), body: p.body, seo: p.seo };
}

/** ~200 wpm, rounded up, floor of one. */
export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}
