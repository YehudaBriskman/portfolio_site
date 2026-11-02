import { z } from "zod";
import { CollectionSchema } from "./blog";

/*
 * The activity API (#223): one feed of what happened on the site, and the
 * areas ranked by it. The client for the Blogs and Work dashboards and the
 * channel log (#224–#227).
 *
 *   GET /api/activity?limit&before&area&kind  → { items, nextCursor }
 *   GET /api/areas                            → { items }
 *   /api/seo/feed/<area>.xml                  → one area's RSS
 */

export const ACTIVITY_KINDS = ["post", "release", "push", "site", "area"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

const AreaRefSchema = z.object({ slug: z.string(), title: z.string() });

const ActivityEventSchema = z.object({
  id: z.string(),
  kind: z.enum(ACTIVITY_KINDS),
  /** ISO 8601, UTC. */
  at: z.string(),
  area: AreaRefSchema.nullable(),
  title: z.string(),
  /** A site path ("/blog/…") for notes and areas; an absolute GitHub URL for repo events. */
  href: z.string(),
  /*
   * Per kind:
   *   post    { slug, excerpt, tags, readingMinutes, featured }
   *   release { tag, repoUrl }
   *   push    { repoUrl }
   *   site    { tag }
   *   area    { kind: "site" | "project", tagline }
   */
  meta: z.record(z.string(), z.unknown()),
});

const ActivityPageSchema = z.object({
  items: z.array(ActivityEventSchema),
  /** Pass back as `before` for the next page; null on the last page. */
  nextCursor: z.string().nullable(),
});

const AreaSchema = CollectionSchema.extend({
  noteCount: z.number(),
  /** The area's newest event of any kind; null only if it has none. */
  lastActivityAt: z.string().nullable(),
  topics: z.array(z.object({ tag: z.string(), count: z.number() })).default([]),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type ActivityPage = z.infer<typeof ActivityPageSchema>;
export type Area = z.infer<typeof AreaSchema>;

export type ActivityQuery = {
  /** 1–50; the server's default is 20. */
  limit?: number;
  /** The previous page's `nextCursor`. */
  before?: string | null;
  area?: string;
  kind?: ActivityKind | ActivityKind[];
};

async function get(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(path);
  if (res.status === 404) throw new Error("not-found");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  // An unreachable API is answered by nginx with the SPA shell.
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Couldn't reach the server.");
  }
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

export function activityQueryString(q: ActivityQuery = {}): string {
  const params = new URLSearchParams();
  if (q.limit !== undefined) params.set("limit", String(q.limit));
  if (q.before) params.set("before", q.before);
  if (q.area) params.set("area", q.area);
  const kinds = q.kind === undefined ? [] : Array.isArray(q.kind) ? q.kind : [q.kind];
  if (kinds.length > 0) params.set("kind", kinds.join(","));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const activity = {
  /** One page of events, newest first. */
  page: async (q: ActivityQuery = {}): Promise<ActivityPage> =>
    ActivityPageSchema.parse(await get(`/api/activity${activityQueryString(q)}`)),
  /** Public areas with note counts, most recently active first. */
  areas: async (): Promise<Area[]> => z.array(AreaSchema).parse((await get("/api/areas")).items ?? []),
};

/** One area's RSS feed, for a "subscribe" link. */
export function areaFeedUrl(slug: string): string {
  return `/api/seo/feed/${encodeURIComponent(slug)}.xml`;
}
