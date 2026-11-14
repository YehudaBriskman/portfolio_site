import { z } from "zod";
import { NOT_AUTHORISED, NotFoundError } from "./authError";
import { parseList } from "./tolerant";
import { invalidateTranslations } from "./translations";

const LinkSchema = z.object({ label: z.string(), url: z.string() });

const SeoSchema = z.object({
  title: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  canonical: z.string().nullable().default(null),
  noindex: z.boolean().default(false),
});

const HebrewSchema = z
  .object({
    title: z.string().default(""),
    subtitle: z.string().default(""),
    excerpt: z.string().default(""),
    body: z.string().default(""),
  })
  /* Each link's label in Hebrew, under `links.<i>.label` (#306). */
  .catchall(z.string());

/* Everything an author edits about a note, as the draft and publish routes
   take it (#250). The server validates it again; this only shapes it. */
const PostContentSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  excerpt: z.string().default(""),
  body: z.string().default(""),
  tags: z.array(z.string()).default([]),
  collection: z.string().default("site"),
  coverImage: z.string().nullable().default(null),
  links: z.array(LinkSchema).default([]),
  featured: z.number().nullable().default(null),
  publishedAt: z.string().nullable().default(null),
  seo: SeoSchema.default({ title: null, description: null, canonical: null, noindex: false }),
  he: HebrewSchema.nullable().default(null),
});
export type PostContent = z.infer<typeof PostContentSchema>;

const AdminPostSchema = z.object({
  _id: z.string().optional(),
  _rev: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  excerpt: z.string(),
  body: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  collection: z.string().default("site"),
  coverImage: z.string().nullable().default(null),
  links: z.array(LinkSchema).default([]),
  readingMinutes: z.number(),
  featured: z.number().nullable().default(null),
  seo: SeoSchema.default({ title: null, description: null, canonical: null, noindex: false }),
  he: HebrewSchema.nullable().optional(),
  /* The English each Hebrew field was written against (#303); the body's as text. */
  heMeta: z.object({ src: z.record(z.string(), z.string()).default({}), bodyBase: z.string().nullable().optional() }).nullable().optional(),
  changeNote: z.string().nullable().optional(),
  /* Unpublished edits to a published note (#250); null when there are none. */
  draft: z.lazy(() => PostContentSchema).nullable().optional(),
  draftSavedAt: z.string().nullable().optional(),
});

const AdminCollectionSchema = z.object({
  _id: z.string().optional(),
  _rev: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string().default(""),
  he: z.record(z.string(), z.string().nullable()).nullable().optional(),
  kind: z.enum(["site", "project"]).default("project"),
  repo: z
    .object({
      owner: z.string(),
      name: z.string(),
      branch: z.string().default("main"),
      docPaths: z.array(z.string()).default([]),
    })
    .nullable()
    .default(null),
  stats: z
    .object({
      stars: z.number().nullable(),
      language: z.string().nullable(),
      license: z.string().nullable(),
      pushedAt: z.string().nullable(),
      fetchedAt: z.string().nullable(),
      error: z.string().nullable(),
    })
    .nullable()
    .default(null),
  description: z.string(),
  coverImage: z.string().nullable(),
  /* A library icon (#253). Absent on areas saved before it existed. */
  icon: z.string().nullable().optional(),
  /* A label is `Text` since #306; an area saved before holds a string. */
  links: z.array(
    z.object({
      label: z.union([z.string(), z.object({ en: z.string(), he: z.string().optional() }).passthrough()]),
      url: z.string(),
    }),
  ),
  order: z.number(),
  status: z.enum(["published", "hidden"]),
});

export type AdminCollection = z.infer<typeof AdminCollectionSchema>;

export type AdminPost = z.infer<typeof AdminPostSchema>;

const ErrorBodySchema = z.object({
  error: z.string().optional(),
  details: z
    .object({ fieldErrors: z.record(z.string(), z.array(z.string()).optional()).optional() })
    .optional(),
});

/** A 400 the author can act on: which field, and what is wrong with it. */
/* A client connected to the remote MCP server (#263), as Connected apps lists it. */
const McpGrantSchema = z.object({
  id: z.string(),
  client: z.string(),
  scopes: z.array(z.string()),
  login: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked"]),
});
export type McpGrant = z.infer<typeof McpGrantSchema>;

export class AdminValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    const count = Object.keys(fieldErrors).length;
    super(count === 1 ? "1 field needs attention" : `${count} fields need attention`);
    this.name = "AdminValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/* Admin endpoints only exist on the admin host. Using a relative path keeps the
   request on whatever origin the page is served from, which is the gated one. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401 || res.status === 403) throw new Error(NOT_AUTHORISED);
  if (res.status === 404) throw new NotFoundError();
  if (res.status === 409) throw new Error("This post changed elsewhere. Reload and reapply your edit.");
  if (!res.ok) {
    const body: unknown = await readJson(res).catch(() => null);
    const parsed = ErrorBodySchema.safeParse(body);

    // The server already says exactly which field it rejected and why. Throwing
    // that away left the author staring at the word "invalid" with no clue that
    // a slug of "windom.app" was the problem.
    if (parsed.success && parsed.data.details?.fieldErrors) {
      const fields = Object.entries(parsed.data.details.fieldErrors)
        .filter(([, msgs]) => msgs && msgs.length > 0)
        .map(([field, msgs]) => [field, (msgs ?? [])[0] ?? "is not valid"] as const);
      if (fields.length > 0) throw new AdminValidationError(Object.fromEntries(fields));
    }

    throw new Error(parsed.success && parsed.data.error ? parsed.data.error : `Request failed (${res.status})`);
  }
  return (await readJson(res)) as T;
}

/**
 * Parse a JSON body, or report the transport failure honestly. An unreachable
 * API is answered by nginx with the SPA shell, and letting res.json() throw
 * puts "Unexpected token '<'" in front of the author instead of the reason.
 */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The admin API did not respond. It may be restarting.");
  }
}


/*
 * A small session cache.
 *
 * AdminShell is rendered inside each page rather than as a layout route, so it
 * remounts on every navigation and refires its own fetch; each page then
 * refetches the post and area lists on mount. Moving between Posts and Areas
 * therefore re-requested everything through the auth proxy and showed a
 * "Loading…" state each time — which reads exactly like a full page reload even
 * though the router never leaves the app.
 *
 * `me` cannot change within a session, so it is remembered outright. The lists
 * are held briefly and dropped the moment anything is written, so an edit is
 * never followed by a stale list.
 */
const LIST_TTL_MS = 30_000;

type Cached<T> = { at: number; value: T };

let meCache: Promise<{ ok: true; login: string; email: string | null }> | null = null;
let postsCache: Cached<AdminPost[]> | null = null;
let collectionsCache: Cached<AdminCollection[]> | null = null;

/** Called after every write, so the next read is authoritative. */
function invalidateLists(): void {
  invalidateTranslations();
  postsCache = null;
  collectionsCache = null;
}

function fresh<T>(entry: Cached<T> | null): T | null {
  return entry && Date.now() - entry.at < LIST_TTL_MS ? entry.value : null;
}

export const admin = {
  me: () => {
    meCache ??= call<{ ok: true; login: string; email: string | null }>("/me").catch((e: unknown) => {
      meCache = null; // A failure must not be remembered.
      throw e;
    });
    return meCache;
  },
  list: async () => {
    const hit = fresh(postsCache);
    if (hit) return hit;
    const r = await call<{ items: unknown[] }>("/posts");
    const items = parseList(AdminPostSchema, r.items);
    postsCache = { at: Date.now(), value: items };
    return items;
  },
  get: async (slug: string) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}`);
    invalidateLists();
    return AdminPostSchema.parse(r.post);
  },
  save: async (slug: string, body: Record<string, unknown>) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    invalidateLists();
    return AdminPostSchema.parse(r.post);
  },
  /* Autosave (#250): on a published note this writes only its draft. */
  saveDraft: async (slug: string, body: PostContent & { _rev?: string }) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}/draft`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    invalidateLists();
    return AdminPostSchema.parse(r.post);
  },
  publish: async (slug: string, body: PostContent & { _rev?: string; changeNote?: string; scope?: "both" | "en" | "he" }) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidateLists();
    return AdminPostSchema.parse(r.post);
  },
  discardDraft: async (slug: string, rev: string) => {
    const r = await call<{ post: unknown }>(
      `/posts/${encodeURIComponent(slug)}/draft?rev=${encodeURIComponent(rev)}`,
      { method: "DELETE" },
    );
    invalidateLists();
    return AdminPostSchema.parse(r.post);
  },
  archive: async (slug: string) => {
    const r = await call<{ ok: true }>(`/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    invalidateLists();
    return r;
  },

  collections: async () => {
    const hit = fresh(collectionsCache);
    if (hit) return hit;
    const r = await call<{ items: unknown[] }>("/collections");
    const items = parseList(AdminCollectionSchema, r.items);
    collectionsCache = { at: Date.now(), value: items };
    return items;
  },
  saveCollection: async (slug: string, body: Record<string, unknown>) => {
    const r = await call<{ collection: unknown }>(`/collections/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    invalidateLists();
    return AdminCollectionSchema.parse(r.collection);
  },
  syncCollection: async (slug: string) => {
    const r = await call<{ ok: true; stats: unknown }>(`/collections/${encodeURIComponent(slug)}/sync`, { method: "POST" });
    invalidateLists();
    return r;
  },
  mcpGrants: async () => {
    const r = await call<{ items: unknown[] }>("/mcp/grants");
    return parseList(McpGrantSchema, r.items);
  },
  revokeMcpGrant: async (id: string) => {
    const r = await call<{ item: unknown }>(`/mcp/grants/${encodeURIComponent(id)}`, { method: "DELETE" });
    return McpGrantSchema.parse(r.item);
  },
  hideCollection: async (slug: string) => {
    const r = await call<{ ok: true }>(`/collections/${encodeURIComponent(slug)}`, { method: "DELETE" });
    invalidateLists();
    return r;
  },
};

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    // a-z0-9 only: `\w` lets underscores through, which the server's slug rule rejects
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
