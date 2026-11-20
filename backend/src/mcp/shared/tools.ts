// GENERATED from mcp/src/tools.ts by mcp/scripts/sync-shared.mjs. Edit that file and rerun the script.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ApiError, type PortfolioApi } from "./api.js";
import { diffFields, lineDiff } from "./diff.js";

/*
 * Shared by both transports: stdio (src/server.ts, a ptk_ token over HTTP)
 * and the remote server the backend mounts at /mcp (OAuth). The backend holds
 * a generated copy in backend/src/mcp/shared/, because its image is built
 * from backend/ alone; after editing this file, api.ts or diff.ts, run
 * `node mcp/scripts/sync-shared.mjs`. A test in each package fails while the
 * copy differs.
 *
 * The translation tools write Hebrew into drafts only; the glossary is the
 * resource glossary://he.
 *
 * Safety rules every write tool follows:
 *   - registered only for `access: "write"` (stdio: PORTFOLIO_ADMIN_TOKEN is
 *     set; remote: the OAuth grant carries mcp:write);
 *   - `dryRun` defaults to TRUE: a call without it reads the current state,
 *     computes the change and returns the diff, and writes nothing;
 *   - saving never changes a post's status: publish_post and unpublish_post
 *     are the only tools that do;
 *   - delete_* refuses to act unless `confirm: true` is passed with
 *     `dryRun: false`.
 * Every write that reaches the API is recorded in its audit log, under the
 * token's name.
 */

export const VERSION = "0.1.0";

export const PUBLIC_TOOLS = ["list_posts", "get_post", "list_tags", "list_areas", "get_area", "list_activity"] as const;
/* Admin tools that only read: an `access: "read"` session gets these. */
export const ADMIN_READ_TOOLS = [
  "admin_list_posts",
  "admin_get_post",
  "admin_list_areas",
  "list_content",
  "get_content",
  "get_settings",
  "read_audit_log",
  "list_media",
  "list_translations",
  "get_translation",
] as const;
export const ADMIN_TOOLS = [
  "list_media",
  "admin_list_posts",
  "admin_get_post",
  "save_post_draft",
  "publish_post",
  "unpublish_post",
  "delete_post",
  "save_area",
  "delete_area",
  "sync_area",
  "admin_list_areas",
  "list_content",
  "get_content",
  "save_content_draft",
  "publish_content",
  "discard_content_draft",
  "get_settings",
  "save_settings",
  "revert_settings",
  "update_media",
  "delete_media",
  "read_audit_log",
  "list_translations",
  "get_translation",
  "put_translation",
  "ack_translation",
] as const;

/* The keys of the site's editable content documents, as backend/src/schemas/site-content.ts. */
export const CONTENT_KEYS = ["projects", "story", "site-copy"] as const;

/* The resource a drafting client reads before writing Hebrew (#307). */
export const GLOSSARY_URI = "glossary://he";

/* As backend/src/schemas/i18n.ts names them. */
export const TRANSLATION_TYPES = ["post", "area", "project", "story", "site-copy", "media"] as const;
export const TRANSLATION_STATUSES = ["missing", "stale", "draft", "unverified", "translated"] as const;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words joined by dashes")
  .max(120);
export const dryRun = z
  .boolean()
  .default(true)
  .describe("Default true: return the diff and write nothing. Pass false to apply.");
/* http(s) only: z.string().url() alone accepts javascript: and data:. Mirrors
   httpUrl in backend/src/schemas/content.ts, which this package cannot import. */
const httpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), { message: "Must be an http(s) address." });
const link = z.object({ label: z.string().min(1).max(60), url: httpUrl });
const lang = z.enum(["en", "he"]).optional().describe("Language to read in; default en");
const translationType = z.enum(TRANSLATION_TYPES);
/* Never a path: no slash, dot-only segment, query or escape reaches an admin URL. */
const itemId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_:-]*(?:\.[A-Za-z0-9_:-]+)*$/, "letters, digits, dashes, colons and inner dots only")
  .describe("The item's id, as list_translations gives it (a slug, `start`, `role:<id>`, `hero`…)");

type AdminPost = {
  _rev?: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  collection: string;
  coverImage: string | null;
  links: { label: string; url: string }[];
  publishedAt: string | null;
  featured?: number | null;
  updatedAt?: string;
  heMeta?: { bodyBase?: string | null } | null;
};

type AdminArea = {
  _rev?: string;
  slug: string;
  title: string;
  tagline: string;
  kind: "site" | "project";
  repo: { owner: string; name: string; branch: string; docPaths: string[] } | null;
  description: string;
  coverImage: string | null;
  icon?: string | null;
  /* A label is `Text` since #306 (a string before). A string sent back keeps
     the Hebrew of a link whose English is unchanged. */
  links: { label: string | { en: string; he?: string }; url: string }[];
  order: number;
  status: "published" | "hidden";
};

/* What PUT /api/admin/posts/:slug accepts. */
const POST_FIELDS = [
  "title",
  "subtitle",
  "excerpt",
  "body",
  "status",
  "tags",
  "collection",
  "coverImage",
  "links",
  "publishedAt",
  "featured",
] as const;
/* What PUT /api/admin/collections/:slug accepts. */
const AREA_FIELDS = [
  "title",
  "tagline",
  "kind",
  "repo",
  "description",
  "coverImage",
  "icon",
  "links",
  "order",
  "status",
] as const;

export type MediaKind = "image" | "icon" | "video";
export type MediaItem = {
  id: string;
  name: string;
  kind: MediaKind;
  alt: string;
  caption: string;
  credit: string;
  width: number;
  height: number;
  durationMs?: number;
  visibility?: "draft" | "public";
  live?: boolean;
  url: string;
  usedBy?: { id: string; type: string; slug: string | null; field: string }[];
};


/* ------------------------------------------------------ path editing -- */

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const parts = (path: string) => path.split(".").filter((k) => k !== "");

/* The value at a dotted path (`projects.0.title`), or undefined. */
export function getPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const k of parts(path)) {
    if (cur === null || typeof cur !== "object" || UNSAFE.has(k)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/*
 * A copy of `root` with `path` set to `value`. Arrays are addressed by index;
 * the index one past the end appends. An intermediate that does not exist is
 * an error, not something to guess a shape for.
 */
export function setPath(root: unknown, path: string, value: unknown): unknown {
  const keys = parts(path);
  if (keys.length === 0) throw new Error("An empty path.");
  const out = structuredClone(root) as Record<string, unknown>;
  let cur: unknown = out;
  keys.forEach((k, i) => {
    if (UNSAFE.has(k)) throw new Error(`Path "${path}": "${k}" is not allowed.`);
    if (cur === null || typeof cur !== "object") throw new Error(`Path "${path}": "${keys.slice(0, i).join(".")}" is not an object or list.`);
    const node = cur as Record<string, unknown>;
    if (Array.isArray(node) && !/^\d+$/.test(k)) throw new Error(`Path "${path}": "${k}" is not an index into a list.`);
    if (i === keys.length - 1) {
      if (value === undefined) delete node[k];
      else node[k] = value;
      return;
    }
    if (node[k] === undefined || node[k] === null) throw new Error(`Path "${path}": nothing at "${keys.slice(0, i + 1).join(".")}".`);
    cur = node[k];
  });
  return out;
}

/* Applies { path: value } edits in order; returns the new document and what each changed. */
function applySet(base: unknown, set: Record<string, unknown>) {
  let doc = base;
  const changes: { field: string; before: unknown; after: unknown }[] = [];
  for (const [path, value] of Object.entries(set)) {
    const before = getPath(doc, path) ?? null;
    doc = setPath(doc, path, value);
    if (JSON.stringify(before) !== JSON.stringify(value ?? null)) changes.push({ field: path, before, after: value ?? null });
  }
  return { doc, changes };
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2) ?? "null";

/* ------------------------------------------------------ translations -- */


type TranslationUnit = {
  path: string;
  status: (typeof TRANSLATION_STATUSES)[number];
  primary: boolean;
  en: string;
  he: string | null;
  draftHe: string | null;
};
type TranslationItem = {
  type: (typeof TRANSLATION_TYPES)[number];
  id: string;
  title: string;
  route: string;
  visibility: "public" | "private";
  status: TranslationUnit["status"] | null;
  units: TranslationUnit[];
};
type TranslationReport = { counts: Record<string, number>; coverage: number; items: TranslationItem[] };

const POST_LANG_FIELDS = ["title", "subtitle", "excerpt", "body"] as const;

/*
 * A public post (or summary) in one language. `en` returns it as the API
 * does. `he` puts the published Hebrew in the fields and keeps the English
 * where there is none, as the Hebrew page does, and says which fell back.
 */
export function inLanguage<T extends Record<string, unknown>>(post: T, lang: "en" | "he" | undefined) {
  if (lang !== "he") return post;
  const he = (post.he ?? null) as Record<string, string | null> | null;
  const out: Record<string, unknown> = { ...post };
  delete out.he;
  const english: string[] = [];
  for (const f of POST_LANG_FIELDS) {
    if (!(f in post) || post[f] == null || post[f] === "") continue;
    const v = he?.[f];
    if (typeof v === "string" && v.trim()) out[f] = v;
    else english.push(f);
  }
  return { ...out, lang: "he", fallback: english.length > 0, englishFields: english };
}

function pick<T extends object>(doc: T, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in doc) out[f] = (doc as Record<string, unknown>)[f];
  return out;
}

export const json = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
export const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: message }] });

function explain(e: unknown): CallToolResult {
  if (e instanceof ApiError) {
    if (e.status === 401) return fail(`The API refused the credentials (401: ${e.message}). The admin token or sign-in is missing, expired or revoked.`);
    if (e.status === 403) return fail(`The API refused this action (403: ${e.message}). A read-scoped token cannot write.`);
    if (e.status === 409) return fail(`Conflict (409: ${e.message}). The document changed since it was read; run the tool again.`);
    return fail(`API error ${e.status}: ${e.message}`);
  }
  return fail(e instanceof Error ? e.message : String(e));
}

/* Wraps a handler so a thrown ApiError becomes a readable tool error. */
export function safe<A>(fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      return explain(e);
    }
  };
}

type WriteResult = {
  dryRun: boolean;
  action: string;
  target: string;
  exists: boolean;
  changes: ReturnType<typeof diffFields>;
  note?: string;
  result?: unknown;
};

function writeResult(r: WriteResult): CallToolResult {
  const note = r.dryRun
    ? r.changes.length === 0
      ? "Dry run: nothing would change."
      : "Dry run: nothing was written. Call again with dryRun: false to apply."
    : undefined;
  return json({ ...r, note: r.note ?? note });
}

/*
 * Which tools a session gets:
 *   public  the six public reads, nothing else;
 *   read    plus the admin reads (drafts, the audit log);
 *   write   plus every write tool.
 */
export type ToolAccess = "public" | "read" | "write";

export function instructionsFor(access: ToolAccess) {
  if (access === "write") {
    return (
      "Reads and edits everything in the portfolio site's admin: posts, areas (hidden ones too), the site's content documents " +
      "(projects, story, site-copy), site settings, the media library's metadata, and Hebrew translations (read the glossary://he " +
      "resource before writing Hebrew). Every write tool defaults to dryRun: true and returns a diff. " +
      "ASK THE USER FIRST: before any edit, publish, unpublish or delete, show them the diff from the dry run and get their " +
      "go-ahead; only then repeat the call with dryRun: false (and confirm: true for deletes). Reads never need asking. " +
      "Content and settings are saved as drafts or versions; publish_content is the step that makes content live."
    );
  }
  if (access === "read") return "Reads the portfolio site's posts (drafts included), areas (hidden included), content documents and their drafts, settings, tags, activity feed, media library, translation status and admin audit log.";
  return "Read-only access to the portfolio site's posts, areas, tags and activity feed.";
}

export function registerTools(server: McpServer, api: PortfolioApi, access: ToolAccess) {
  const ro = { readOnlyHint: true, openWorldHint: false } as const;

  /* ------------------------------------------------------------ public -- */

  server.registerTool(
    "list_posts",
    {
      title: "List published posts",
      description:
        "Published posts, newest first (summaries, no body). Filter by tag or area slug. " +
        "lang: \"he\" gives each in Hebrew where it is published, English where not (fallback: true).",
      inputSchema: { tag: z.string().max(60).optional(), area: slug.optional(), lang },
      annotations: ro,
    },
    safe(async ({ tag, area, lang }) => {
      const res = await api.get<{ items: Record<string, unknown>[] }>("/api/blog/posts", { tag, collection: area });
      return json(lang ? { ...res, items: res.items.map((p) => inLanguage(p, lang)) } : res);
    }),
  );

  server.registerTool(
    "get_post",
    {
      title: "Get a published post",
      description:
        "One published post by slug, with its markdown body. Drafts are not visible here (use admin_get_post). " +
        "lang: \"he\" gives it in Hebrew where it is published, English where not (fallback: true).",
      inputSchema: { slug, lang },
      annotations: ro,
    },
    safe(async ({ slug, lang }) => {
      const res = await api.get<{ post: Record<string, unknown> }>(`/api/blog/posts/${slug}`);
      return json(lang ? { ...res, post: inLanguage(res.post, lang) } : res);
    }),
  );

  server.registerTool(
    "list_tags",
    { title: "List tags", description: "Tags on published posts, with counts.", annotations: ro },
    safe(async () => json(await api.get("/api/blog/tags"))),
  );

  server.registerTool(
    "list_areas",
    {
      title: "List areas",
      description: "Published areas (the site's projects and shelves) with activity counts, most recently active first.",
      annotations: ro,
    },
    safe(async () => json(await api.get("/api/areas"))),
  );

  server.registerTool(
    "get_area",
    { title: "Get an area", description: "One published area by slug.", inputSchema: { slug }, annotations: ro },
    safe(async ({ slug }) => json(await api.get(`/api/blog/collections/${slug}`))),
  );

  server.registerTool(
    "list_activity",
    {
      title: "List activity",
      description: "The site's activity feed, newest first. Page with `before` (the cursor from the previous page).",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
        before: z.string().max(200).optional(),
        area: slug.optional(),
        kind: z.array(z.string().max(30)).max(10).optional().describe("Event kinds to include"),
      },
      annotations: ro,
    },
    safe(async ({ limit, before, area, kind }) =>
      json(await api.get("/api/activity", { limit, before, area, kind: kind?.join(",") })),
    ),
  );

  if (access === "public") return;

  /* ------------------------------------------------------------- admin -- */

  const loadPost = async (s: string): Promise<AdminPost | null> => {
    try {
      return (await api.adminGet<{ post: AdminPost }>(`/api/admin/posts/${encodeURIComponent(s)}`)).post;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  };
  const loadArea = async (s: string): Promise<AdminArea | null> => {
    const { items } = await api.adminGet<{ items: AdminArea[] }>("/api/admin/collections");
    return items.find((a) => a.slug === s) ?? null;
  };

  /* Diff, then PUT unless dry. `proposed` is the full write body. */
  async function putPost(action: string, current: AdminPost | null, proposed: Record<string, unknown>, dry: boolean) {
    const target = `post:${proposed.slug}`;
    const changes = diffFields(current ? pick(current, POST_FIELDS) : null, pick(proposed, POST_FIELDS), POST_FIELDS);
    if (dry || (current && changes.length === 0)) {
      return writeResult({ dryRun: dry, action, target, exists: !!current, changes, ...(dry ? {} : { note: "No change; nothing written." }) });
    }
    const body = { ...pick(proposed, POST_FIELDS), ...(current?._rev ? { _rev: current._rev } : {}) };
    const res = await api.adminSend<{ post: AdminPost }>("PUT", `/api/admin/posts/${proposed.slug}`, body);
    return writeResult({ dryRun: false, action, target, exists: !!current, changes, result: { slug: res.post.slug, status: res.post.status, updatedAt: res.post.updatedAt } });
  }

  server.registerTool(
    "admin_list_posts",
    {
      title: "List all posts (admin)",
      description: "Every post including drafts and archived, as slug/title/status/updatedAt.",
      inputSchema: { status: z.enum(["draft", "published", "archived"]).optional() },
      annotations: ro,
    },
    safe(async ({ status }) => {
      const { items } = await api.adminGet<{ items: AdminPost[] }>("/api/admin/posts");
      return json(
        items
          .filter((p) => !status || p.status === status)
          .map((p) => ({ slug: p.slug, title: p.title, status: p.status, area: p.collection, updatedAt: p.updatedAt })),
      );
    }),
  );

  server.registerTool(
    "admin_get_post",
    {
      title: "Get any post (admin)",
      description: "One post by slug, drafts included, with its body.",
      inputSchema: { slug },
      annotations: ro,
    },
    safe(async ({ slug }) => {
      const post = await loadPost(slug);
      return post ? json(post) : fail(`No post "${slug}".`);
    }),
  );

  server.registerTool(
    "read_audit_log",
    {
      title: "Read the admin audit log",
      description: "Admin writes, newest first: who (or which token), when, what, and before/after hashes. Page with `before`.",
      inputSchema: { limit: z.number().int().min(1).max(200).optional(), before: z.string().max(80).optional() },
      annotations: ro,
    },
    safe(async ({ limit, before }) => json(await api.adminGet("/api/admin/audit", { limit, before }))),
  );

  server.registerTool(
    "list_media",
    {
      title: "List the media library",
      description:
        "Pictures, icons and short videos in the media library (#253), newest first: id, kind, alt text, caption, size, " +
        "the stable `url` to put in a coverImage or a project image (a picture) or an area's icon (an icon), and " +
        "`visibility` (draft or public; a new upload is a draft) and `live` (whether the public can fetch it now: a published page that uses it counts), and " +
        "`usedBy` (what references it). Filter with `q` (name, alt, caption, credit) and `kind`.",
      inputSchema: {
        q: z.string().max(100).optional(),
        kind: z.enum(["image", "icon", "video"]).optional(),
      },
      annotations: ro,
    },
    safe(async ({ q, kind }) => {
      const { items } = await api.adminGet<{ items: MediaItem[] }>("/api/admin/media", { q, kind });
      return json(
        items.map((m) => ({
          id: m.id,
          kind: m.kind,
          name: m.name,
          alt: m.alt,
          caption: m.caption,
          credit: m.credit,
          size: `${m.width}x${m.height}`,
          ...(m.kind === "video" && m.durationMs ? { seconds: Math.round(m.durationMs / 1000) } : {}),
          url: m.url,
          visibility: m.visibility ?? "public",
          live: m.live ?? true,
          usedBy: (m.usedBy ?? []).map((u) => `${u.type}:${u.slug ?? u.id} (${u.field})`),
        })),
      );
    }),
  );

  const loadTranslation = async (type: TranslationItem["type"], id: string) => {
    const r = await api.adminGet<TranslationReport>("/api/admin/translations", { type });
    return r.items.find((i) => i.id === id) ?? null;
  };

  server.registerTool(
    "list_translations",
    {
      title: "List translations",
      description:
        "The Translations report: every note, area, project, story beat and site-copy section, with its Hebrew status " +
        "(missing, stale, draft, unverified, translated) and counts. Filter by status, type and visibility. " +
        "Units list paths only; get_translation gives the words.",
      inputSchema: {
        status: z.array(z.enum(TRANSLATION_STATUSES)).max(5).optional(),
        type: z.array(translationType).max(5).optional(),
        visibility: z.enum(["public", "private", "all"]).optional(),
      },
      annotations: ro,
    },
    safe(async ({ status, type, visibility }) => {
      const r = await api.adminGet<TranslationReport>("/api/admin/translations", {
        status: status?.join(","),
        type: type?.join(","),
        visibility,
      });
      return json({
        counts: r.counts,
        coverage: r.coverage,
        items: r.items.map((i) => ({
          type: i.type,
          id: i.id,
          title: i.title,
          route: i.route,
          visibility: i.visibility,
          status: i.status,
          units: i.units.map((u) => `${u.path}: ${u.status}`),
        })),
      });
    }),
  );

  server.registerTool(
    "get_translation",
    {
      title: "Get one item's translation",
      description:
        "One item in both languages, unit by unit: the English, the published Hebrew, the draft Hebrew and the status. " +
        "For a note whose Hebrew body is stale, `bodyDiff` is what changed in the English body since the Hebrew was written.",
      inputSchema: { type: translationType, id: itemId },
      annotations: ro,
    },
    safe(async ({ type, id }) => {
      const item = await loadTranslation(type, id);
      if (!item) return fail(`No ${type} "${id}" in the translations report.`);
      let bodyDiff: string[] | undefined;
      if (type === "post" && item.units.some((u) => u.path === "body" && u.status === "stale")) {
        const post = await loadPost(id);
        const meta = post?.heMeta;
        if (post && typeof meta?.bodyBase === "string") bodyDiff = lineDiff(meta.bodyBase, post.body);
      }
      return json({ ...item, ...(bodyDiff !== undefined ? { bodyDiff } : {}) });
    }),
  );

  server.registerResource(
    "glossary",
    GLOSSARY_URI,
    {
      title: "Hebrew glossary",
      description:
        "How the site writes Hebrew: which names stay in Latin, the preferred Hebrew term for each concept, and the " +
        "variants never to use. Read it before put_translation.",
      mimeType: "application/json",
    },
    async (uri) => {
      const { glossary } = await api.adminGet<{ glossary: unknown }>("/api/admin/translations/glossary");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(glossary, null, 2) }] };
    },
  );


  /* Hidden areas too, which the public list does not show. */
  server.registerTool(
    "admin_list_areas",
    {
      title: "List all areas (admin)",
      description:
        "Every area, hidden ones included, with all its fields: title, tagline, description, Hebrew, links, repo, cover, icon, " +
        "order, status. The public list_areas hides hidden areas and drops the fields below.",
      inputSchema: { slug: slug.optional().describe("Return just this area") },
      annotations: ro,
    },
    safe(async ({ slug }) => {
      const { items } = await api.adminGet<{ items: (AdminArea & { stats?: unknown })[] }>("/api/admin/collections");
      const rows = items.filter((a) => !slug || a.slug === slug);
      if (slug && rows.length === 0) return fail(`No area "${slug}".`);
      return json(rows.map(({ _rev, ...a }) => a));
    }),
  );

  type ContentView = {
    key: string;
    exists: boolean;
    _rev: string | null;
    published: unknown;
    draft: unknown | null;
    updatedAt: string | null;
    publishedAt: string | null;
    source: string;
  };
  const contentKey = z.enum(CONTENT_KEYS);
  const loadContent = (key: string) => api.adminGet<ContentView>(`/api/admin/content/${key}`);

  server.registerTool(
    "list_content",
    {
      title: "List the site's content documents",
      description:
        "The site's editable content documents (projects, story, site-copy): whether each has been edited in the admin, whether it " +
        "has an unpublished draft, and when it changed. get_content reads one.",
      annotations: ro,
    },
    safe(async () => json(await api.adminGet("/api/admin/content"))),
  );

  server.registerTool(
    "get_content",
    {
      title: "Read a content document",
      description:
        "One content document: the draft if there is one (what the next publish would make live), else the published version. " +
        "Documents are large; pass `path` (dotted, indices for lists: `projects.0.links`, `story.beats.2`) to read a part. " +
        "Use `which: \"published\"` to see what is live while a draft exists. Reading with no path returns the whole document.",
      inputSchema: {
        key: contentKey,
        path: z.string().max(200).optional(),
        which: z.enum(["draft", "published"]).optional().describe("Default: the draft when there is one"),
      },
      annotations: ro,
    },
    safe(async ({ key, path, which }) => {
      const v = await loadContent(key);
      const useDraft = which ? which === "draft" : v.draft != null;
      if (useDraft && v.draft == null) return fail(`${key} has no draft.`);
      const doc = useDraft ? v.draft : v.published;
      const value = path ? getPath(doc, path) : doc;
      if (value === undefined) return fail(`Nothing at "${path}" in ${key}.`);
      return json({ key, which: useDraft ? "draft" : "published", hasDraft: v.draft != null, updatedAt: v.updatedAt, publishedAt: v.publishedAt, ...(path ? { path } : {}), value });
    }),
  );

  server.registerTool(
    "get_settings",
    {
      title: "Read the site settings",
      description:
        "The site settings: which home-page sections show and in what order, the theme and motion defaults, the accent. " +
        "Also the version and the history (version numbers and dates; revert_settings takes one of them).",
      annotations: ro,
    },
    safe(async () => {
      const r = await api.adminGet<{ settings: unknown; version: number; updatedAt: string | null; history: { version: number; at: string }[] }>("/api/admin/settings");
      return json({ settings: r.settings, version: r.version, updatedAt: r.updatedAt, history: r.history.map((h) => ({ version: h.version, at: h.at })) });
    }),
  );

  if (access === "read") return;

  server.registerTool(
    "put_translation",
    {
      title: "Write Hebrew (draft for posts and content; LIVE for areas and media)",
      description:
        "Sets the Hebrew of one or more units of one item (paths from get_translation). Posts, projects, the story and site " +
        "copy are written into their DRAFT: nothing goes live until the owner publishes in the admin. Areas and media have no " +
        "draft, so a write to an area (title, tagline, description, links.N.label) or to a media item (alt, caption) goes LIVE " +
        "immediately, stamped as the admin's own save. Returns the changes and the glossary warnings, which never block " +
        "(read glossary://he first). An empty string removes a unit's Hebrew. dryRun defaults to true.",
      inputSchema: {
        type: translationType,
        id: itemId,
        units: z.record(z.string().min(1).max(200), z.string().max(200_000)).describe("{ path: Hebrew }"),
        dryRun,
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ type, id, units, dryRun }) => {
      const list = Object.entries(units).map(([path, he]) => ({ path, he }));
      if (list.length === 0) return fail("Give at least one unit.");
      const live = type === "area" || type === "media";
      // Live documents (area, media): the server reads and writes in one step, so no rev.
      let rev: string | undefined;
      if (type === "post") {
        const post = await loadPost(id);
        if (!post) return fail(`No post "${id}".`);
        rev = post._rev ?? "";
      } else if (!live) {
        const key = type === "project" ? "projects" : type;
        rev = (await api.adminGet<{ _rev: string | null }>(`/api/admin/content/${key}`))._rev ?? "";
      }
      const res = await api.adminSend<{ target: string; changes: { path: string; en: string; before: string | null; after: string | null }[]; warnings: unknown[] }>(
        "PUT",
        "/api/admin/translations/draft",
        { type, id, rev, units: list, dryRun },
      );
      const note = dryRun
        ? res.changes.length === 0
          ? "Dry run: nothing would change."
          : live
            ? "Dry run: nothing was written. Call again with dryRun: false to write; it goes LIVE at once (no draft)."
            : "Dry run: nothing was written. Call again with dryRun: false to write the draft."
        : res.changes.length === 0
          ? "No change; nothing written."
          : live
            ? `Written LIVE: ${type === "area" ? "areas" : "media"} have no draft, so the Hebrew is on the site now.`
            : "Written to the draft. The owner publishes it from the admin.";
      return json({ dryRun, action: "put_translation", target: res.target, changes: res.changes, warnings: res.warnings, note });
    }),
  );

  server.registerTool(
    "save_post_draft",
    {
      title: "Create or update a post (draft)",
      description:
        "Creates a new post as a draft, or updates fields of an existing one. Omitted fields keep their current value. " +
        "Never changes status: use publish_post / unpublish_post. dryRun defaults to true and returns the diff.",
      inputSchema: {
        slug,
        title: z.string().min(1).max(200).optional().describe("Required when creating"),
        subtitle: z.string().max(300).nullable().optional(),
        excerpt: z.string().max(320).optional(),
        body: z.string().optional().describe("Markdown"),
        tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).optional(),
        area: slug.optional().describe("Area slug; default `site`"),
        coverImage: httpUrl.nullable().optional(),
        links: z.array(link).max(8).optional(),
        featured: z.number().int().min(1).max(99).nullable().optional(),
        dryRun,
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ slug, dryRun, area, ...fields }) => {
      const current = await loadPost(slug);
      if (!current && !fields.title) return fail("A new post needs a title.");
      const defined = Object.fromEntries(Object.entries({ ...fields, collection: area }).filter(([, v]) => v !== undefined));
      const base: Record<string, unknown> = current
        ? pick(current, POST_FIELDS)
        : { subtitle: null, excerpt: "", body: "", tags: [], collection: "site", coverImage: null, links: [], publishedAt: null, featured: null };
      const proposed = { ...base, ...defined, slug, status: current?.status ?? "draft" };
      return putPost(current ? "update_post" : "create_post_draft", current, proposed, dryRun);
    }),
  );

  for (const [name, status, verb] of [
    ["publish_post", "published", "Publishes"],
    ["unpublish_post", "draft", "Returns to draft (unpublishes)"],
  ] as const) {
    server.registerTool(
      name,
      {
        title: name === "publish_post" ? "Publish a post" : "Unpublish a post",
        description: `${verb} an existing post. Only its status changes. dryRun defaults to true and returns the diff.`,
        inputSchema: { slug, dryRun },
        annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      safe(async ({ slug, dryRun }) => {
        const current = await loadPost(slug);
        if (!current) return fail(`No post "${slug}".`);
        return putPost(name, current, { ...pick(current, POST_FIELDS), slug, status }, dryRun);
      }),
    );
  }

  server.registerTool(
    "delete_post",
    {
      title: "Delete (archive) a post",
      description:
        "Archives a post: it leaves the site but stays in the store. Requires confirm: true together with dryRun: false; " +
        "otherwise returns what would change.",
      inputSchema: { slug, confirm: z.boolean().optional().describe("Must be true to delete"), dryRun },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ slug, confirm, dryRun }) => {
      const current = await loadPost(slug);
      if (!current) return fail(`No post "${slug}".`);
      const changes = diffFields(pick(current, POST_FIELDS), { ...pick(current, POST_FIELDS), status: "archived" }, POST_FIELDS);
      if (dryRun) return writeResult({ dryRun, action: "delete_post", target: `post:${slug}`, exists: true, changes });
      if (confirm !== true) return fail("delete_post needs confirm: true. Nothing was deleted.");
      await api.adminSend("DELETE", `/api/admin/posts/${slug}`);
      return writeResult({ dryRun, action: "delete_post", target: `post:${slug}`, exists: true, changes });
    }),
  );

  server.registerTool(
    "save_area",
    {
      title: "Create or update an area",
      description:
        "Creates an area or updates fields of an existing one. Omitted fields keep their current value. " +
        "dryRun defaults to true and returns the diff.",
      inputSchema: {
        slug,
        title: z.string().min(1).max(120).optional().describe("Required when creating"),
        tagline: z.string().max(160).optional(),
        kind: z.enum(["site", "project"]).optional(),
        repo: z
          .object({
            owner: z.string().min(1).max(60),
            name: z.string().min(1).max(100),
            branch: z.string().min(1).max(60).default("main"),
            docPaths: z.array(z.string().max(200)).max(20).default([]),
          })
          .nullable()
          .optional(),
        description: z.string().max(400).optional(),
        coverImage: httpUrl.nullable().optional(),
        icon: httpUrl.nullable().optional().describe("An icon's url from list_media"),
        links: z.array(link).max(8).optional(),
        order: z.number().int().optional(),
        status: z.enum(["published", "hidden"]).optional(),
        dryRun,
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ slug, dryRun, ...fields }) => {
      const current = await loadArea(slug);
      if (!current && !fields.title) return fail("A new area needs a title.");
      const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const base: Record<string, unknown> = current
        ? pick(current, AREA_FIELDS)
        : { tagline: "", kind: "project", repo: null, description: "", coverImage: null, icon: null, links: [], order: 50, status: "published" };
      const proposed: Record<string, unknown> = { ...base, ...defined };
      const target = `collection:${slug}`;
      const changes = diffFields(current ? pick(current, AREA_FIELDS) : null, proposed, AREA_FIELDS);
      const action = current ? "update_area" : "create_area";
      if (dryRun) return writeResult({ dryRun, action, target, exists: !!current, changes });
      if (current && changes.length === 0) {
        return writeResult({ dryRun, action, target, exists: true, changes, note: "No change; nothing written." });
      }
      const body = { ...proposed, ...(current?._rev ? { _rev: current._rev } : {}) };
      await api.adminSend("PUT", `/api/admin/collections/${slug}`, body);
      return writeResult({ dryRun, action, target, exists: !!current, changes });
    }),
  );

  server.registerTool(
    "delete_area",
    {
      title: "Delete (hide) an area",
      description:
        "Hides an area: posts keep referring to it, but it leaves the site. The `site` area cannot be removed. " +
        "Requires confirm: true together with dryRun: false.",
      inputSchema: { slug, confirm: z.boolean().optional().describe("Must be true to delete"), dryRun },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ slug, confirm, dryRun }) => {
      const current = await loadArea(slug);
      if (!current) return fail(`No area "${slug}".`);
      const changes = diffFields(pick(current, AREA_FIELDS), { ...pick(current, AREA_FIELDS), status: "hidden" }, AREA_FIELDS);
      if (dryRun) return writeResult({ dryRun, action: "delete_area", target: `collection:${slug}`, exists: true, changes });
      if (confirm !== true) return fail("delete_area needs confirm: true. Nothing was deleted.");
      await api.adminSend("DELETE", `/api/admin/collections/${slug}`);
      return writeResult({ dryRun, action: "delete_area", target: `collection:${slug}`, exists: true, changes });
    }),
  );

  /* ----------------------------------------------------- content -- */

  const WRITE = { destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
  const DESTRUCTIVE = { destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

  server.registerTool(
    "save_content_draft",
    {
      title: "Edit a content document (draft)",
      description:
        "Edits a content document (projects, story, site-copy) as a DRAFT: nothing is live until publish_content. " +
        "`set` is { dotted.path: value }, applied in order to the current draft (or the published version if there is none): " +
        "`projects.0.title`, `projects.0.links.1.url`, `story.beats.2.body`. Text that has a Hebrew is { en, he }: set " +
        "`....title.en` or the whole object. The index one past the end of a list appends. Or pass `data` to replace the whole document. " +
        "The server validates the result and says which fields are wrong. dryRun defaults to true and returns the changes.",
      inputSchema: {
        key: contentKey,
        set: z.record(z.string().min(1).max(200), z.unknown()).optional(),
        data: z.unknown().optional().describe("The whole document, replacing the current one. Prefer `set`."),
        dryRun,
      },
      annotations: WRITE,
    },
    safe(async ({ key, set, data, dryRun }) => {
      if (set === undefined && data === undefined) return fail("Give `set` (path edits) or `data` (the whole document).");
      if (set !== undefined && data !== undefined) return fail("Give `set` or `data`, not both.");
      const v = await loadContent(key);
      const base = v.draft ?? v.published;
      let next: unknown;
      let changes: unknown[];
      if (set !== undefined) {
        const r = applySet(base, set);
        next = r.doc;
        changes = r.changes;
      } else {
        next = data;
        changes = JSON.stringify(base) === JSON.stringify(data) ? [] : [{ field: key, lines: lineDiff(pretty(base), pretty(data)) }];
      }
      const target = `content:${key}`;
      const out = { dryRun, action: "save_content_draft", target, exists: v.exists, changes };
      if (dryRun) return writeResult({ ...out, changes: changes as never });
      if (changes.length === 0) return writeResult({ ...out, changes: [], note: "No change; nothing written." });
      const body = { data: next, ...(v._rev ? { _rev: v._rev } : {}) };
      await api.adminSend("PUT", `/api/admin/content/${key}/draft`, body);
      return writeResult({ ...out, changes: changes as never, note: "Saved as a draft. Nothing is live until publish_content." });
    }),
  );

  server.registerTool(
    "publish_content",
    {
      title: "Publish a content document's draft",
      description:
        "Makes a content document's draft the live version (after the server checks it, and the other documents it points into). " +
        "The dry run shows what goes live: the difference between the published version and the draft. dryRun defaults to true.",
      inputSchema: { key: contentKey, dryRun },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ key, dryRun }) => {
      const v = await loadContent(key);
      if (v.draft == null) return fail(`${key} has no draft to publish. Save one with save_content_draft.`);
      const same = JSON.stringify(v.published) === JSON.stringify(v.draft);
      const changes = same ? [] : [{ field: key, lines: lineDiff(pretty(v.published), pretty(v.draft)) }];
      const out = { dryRun, action: "publish_content", target: `content:${key}`, exists: v.exists, changes };
      if (dryRun) return writeResult(out);
      await api.adminSend("POST", `/api/admin/content/${key}/publish`, { data: v.draft, ...(v._rev ? { _rev: v._rev } : {}) });
      return writeResult({ ...out, note: "Published. It is live." });
    }),
  );

  server.registerTool(
    "discard_content_draft",
    {
      title: "Discard a content document's draft",
      description:
        "Throws away a content document's unpublished draft; the live version is untouched. Requires confirm: true together with dryRun: false.",
      inputSchema: { key: contentKey, confirm: z.boolean().optional().describe("Must be true to discard"), dryRun },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ key, confirm, dryRun }) => {
      const v = await loadContent(key);
      if (v.draft == null) return fail(`${key} has no draft.`);
      const changes = [{ field: key, lines: lineDiff(pretty(v.draft), pretty(v.published)) }];
      const out = { dryRun, action: "discard_content_draft", target: `content:${key}`, exists: true, changes };
      if (dryRun) return writeResult(out);
      if (confirm !== true) return fail("discard_content_draft needs confirm: true. Nothing was discarded.");
      await api.adminSend("DELETE", `/api/admin/content/${key}/draft?rev=${encodeURIComponent(v._rev ?? "")}`);
      return writeResult({ ...out, note: "Draft discarded." });
    }),
  );

  /* --------------------------------------------------- settings -- */

  type SettingsView = { _rev: string | null; version: number; settings: unknown; history: { version: number; at: string; settings: unknown }[] };

  server.registerTool(
    "save_settings",
    {
      title: "Change the site settings",
      description:
        "Changes the site settings, live at once (every save is a version; revert_settings undoes it). `set` is { dotted.path: value } " +
        "against get_settings' `settings` (`home.sections.2.visible`, `theme.default`); or pass `settings` to replace them all. " +
        "The server refuses a combination the design forbids and says why. dryRun defaults to true.",
      inputSchema: {
        set: z.record(z.string().min(1).max(200), z.unknown()).optional(),
        settings: z.unknown().optional().describe("The whole settings object. Prefer `set`."),
        dryRun,
      },
      annotations: WRITE,
    },
    safe(async ({ set, settings, dryRun }) => {
      if (set === undefined && settings === undefined) return fail("Give `set` (path edits) or `settings` (all of them).");
      if (set !== undefined && settings !== undefined) return fail("Give `set` or `settings`, not both.");
      const v = await api.adminGet<SettingsView>("/api/admin/settings");
      let next: unknown;
      let changes: unknown[];
      if (set !== undefined) {
        const r = applySet(v.settings, set);
        next = r.doc;
        changes = r.changes;
      } else {
        next = settings;
        changes = JSON.stringify(v.settings) === JSON.stringify(settings) ? [] : [{ field: "settings", lines: lineDiff(pretty(v.settings), pretty(settings)) }];
      }
      const out = { dryRun, action: "save_settings", target: "settings", exists: v._rev !== null, changes: changes as never };
      if (dryRun) return writeResult(out);
      if (changes.length === 0) return writeResult({ ...out, note: "No change; nothing written." });
      await api.adminSend("PUT", "/api/admin/settings", { settings: next, ...(v._rev ? { _rev: v._rev } : {}) });
      return writeResult({ ...out, note: "Saved. It is live." });
    }),
  );

  server.registerTool(
    "revert_settings",
    {
      title: "Revert the site settings to an earlier version",
      description: "Puts an earlier settings version (from get_settings' history) back, as a new version. dryRun defaults to true.",
      inputSchema: { version: z.number().int().min(0), dryRun },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ version, dryRun }) => {
      const v = await api.adminGet<SettingsView>("/api/admin/settings");
      const target = v.history.find((h) => h.version === version);
      if (!target) return fail(`No settings version ${version}. get_settings lists them.`);
      const changes = JSON.stringify(v.settings) === JSON.stringify(target.settings) ? [] : [{ field: "settings", lines: lineDiff(pretty(v.settings), pretty(target.settings)) }];
      const out = { dryRun, action: "revert_settings", target: "settings", exists: true, changes };
      if (dryRun) return writeResult(out);
      await api.adminSend("POST", "/api/admin/settings/revert", { version, ...(v._rev ? { _rev: v._rev } : {}) });
      return writeResult({ ...out, note: `Reverted to version ${version}. It is live.` });
    }),
  );

  /* ------------------------------------------------------- media -- */

  const MEDIA_FIELDS = ["alt", "caption", "credit", "he"] as const;
  type MediaFull = MediaItem & { _rev: string; he?: { alt?: string; caption?: string } | null };
  const loadMedia = async (id: string): Promise<MediaFull | null> => {
    try {
      return (await api.adminGet<{ item: MediaFull }>(`/api/admin/media/${id}`)).item;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  };

  server.registerTool(
    "update_media",
    {
      title: "Edit a media item's words",
      description:
        "Edits a picture's, icon's or video's alt text, caption, credit and Hebrew alt/caption. Omitted fields keep their value. " +
        "(Uploading or replacing the file is not offered remotely.) dryRun defaults to true and returns the diff.",
      inputSchema: {
        id: z.string().min(1).max(60),
        alt: z.string().min(1).max(300).optional(),
        caption: z.string().max(500).optional(),
        credit: z.string().max(200).optional(),
        he: z
          .object({ alt: z.string().max(300).optional(), caption: z.string().max(500).optional() })
          .nullable()
          .optional()
          .describe("Hebrew alt and caption; empty means the English is read"),
        dryRun,
      },
      annotations: WRITE,
    },
    safe(async ({ id, dryRun, ...fields }) => {
      const current = await loadMedia(id);
      if (!current) return fail(`No media "${id}".`);
      const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const before = pick({ ...current, he: current.he ?? null }, MEDIA_FIELDS);
      const proposed: Record<string, unknown> = { ...before, ...defined };
      if (defined.he && typeof defined.he === "object") proposed.he = { ...((before.he as object | null) ?? {}), ...(defined.he as object) };
      const changes = diffFields(before, proposed, MEDIA_FIELDS);
      const out = { dryRun, action: "update_media", target: `media:${id}`, exists: true, changes };
      if (dryRun) return writeResult(out);
      if (changes.length === 0) return writeResult({ ...out, note: "No change; nothing written." });
      await api.adminSend("PUT", `/api/admin/media/${id}`, { ...proposed, _rev: current._rev });
      return writeResult(out);
    }),
  );

  server.registerTool(
    "delete_media",
    {
      title: "Delete a media item",
      description:
        "Deletes a picture, icon or video and its files for good. Refused while anything uses it (list_media shows `usedBy`). " +
        "Requires confirm: true together with dryRun: false.",
      inputSchema: { id: z.string().min(1).max(60), confirm: z.boolean().optional().describe("Must be true to delete"), dryRun },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ id, confirm, dryRun }) => {
      const current = await loadMedia(id);
      if (!current) return fail(`No media "${id}".`);
      const used = (current.usedBy ?? []).map((u) => `${u.type}:${u.slug ?? u.id} (${u.field})`);
      const out = { dryRun, action: "delete_media", target: `media:${id}`, exists: true, changes: [] as never };
      if (dryRun) return writeResult({ ...out, note: used.length ? `Dry run: would be refused, in use by ${used.join(", ")}.` : "Dry run: nothing was deleted. Call again with confirm: true and dryRun: false to delete." });
      if (confirm !== true) return fail("delete_media needs confirm: true. Nothing was deleted.");
      await api.adminSend("DELETE", `/api/admin/media/${id}?rev=${encodeURIComponent(current._rev)}`);
      return writeResult({ ...out, note: "Deleted." });
    }),
  );

  /* -------------------------------------------- areas, translations -- */

  server.registerTool(
    "sync_area",
    {
      title: "Refresh an area's repository numbers",
      description: "Re-reads the area's GitHub repository (stars, release, language, last push) now, rather than at the next scheduled sync. Changes only the numbers. Do this after repointing an area's repo.",
      inputSchema: { slug },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safe(async ({ slug }) => json({ action: "sync_area", target: `collection:${slug}`, ...(await api.adminSend<object>("POST", `/api/admin/collections/${slug}/sync`)) })),
  );

  server.registerTool(
    "ack_translation",
    {
      title: "Mark a Hebrew text as still correct",
      description:
        "Says the Hebrew of one unit is still right although its English changed (clears `stale`), without rewriting it. " +
        "Only after reading the English and the Hebrew with get_translation. Not for areas or media.",
      inputSchema: { type: translationType, id: itemId, path: z.string().min(1).max(200).describe("The unit's path, as get_translation gives it"), dryRun },
      annotations: WRITE,
    },
    safe(async ({ type, id, path, dryRun }) => {
      if (type === "area" || type === "media") return fail("Areas and media have no stale marker to clear.");
      const item = await loadTranslation(type, id);
      const unit = item?.units.find((u) => u.path === path);
      if (!item || !unit) return fail(`No unit "${path}" in ${type} "${id}". get_translation lists them.`);
      const out = { dryRun, action: "ack_translation", target: `${type}:${id}`, exists: true, changes: [{ field: path, before: unit.status, after: "translated" }] as never };
      if (dryRun) return writeResult(out);
      let rev: string;
      if (type === "post") {
        const post = await loadPost(id);
        if (!post) return fail(`No post "${id}".`);
        rev = post._rev ?? "";
      } else {
        rev = (await api.adminGet<{ _rev: string | null }>(`/api/admin/content/${type === "project" ? "projects" : type}`))._rev ?? "";
      }
      await api.adminSend("POST", "/api/admin/translations/ack", { type, id, path, rev });
      return writeResult({ ...out, note: "Marked as still correct." });
    }),
  );

}
