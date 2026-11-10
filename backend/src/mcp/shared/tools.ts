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
 * The tools (#252). v1 covers posts, areas, tags and the activity feed; the
 * set grows as more content becomes editable in the backend (#163, #253,
 * #254) — each new admin endpoint gets its read tool and its dry-run write.
 * The translation tools (#307) read the Translations report and write Hebrew
 * into drafts only; the glossary is the resource glossary://he.
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
  "read_audit_log",
  "list_translations",
  "get_translation",
  "put_translation",
] as const;

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
const link = z.object({ label: z.string().min(1).max(60), url: z.string().url() });
const lang = z.enum(["en", "he"]).optional().describe("Language to read in; default en");
const translationType = z.enum(TRANSLATION_TYPES);
const itemId = z.string().min(1).max(200).describe("The item's id, as list_translations gives it (a slug, `start`, `role:<id>`, `hero`…)");

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
  url: string;
  usedBy?: { id: string; type: string; slug: string | null; field: string }[];
};

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
    if (e.status === 401) return fail(`The API refused the admin token (401: ${e.message}). Check PORTFOLIO_ADMIN_TOKEN, or whether it was revoked.`);
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
    return "Reads and edits the portfolio site's posts and areas, reads its media library, and reads and drafts its Hebrew translations (read the glossary://he resource before writing Hebrew). Every write tool defaults to dryRun: true and returns a diff; show it to the user before applying with dryRun: false.";
  }
  if (access === "read") return "Reads the portfolio site's posts (drafts included), areas, tags, activity feed, media library, translation status and admin audit log.";
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
      return (await api.adminGet<{ post: AdminPost }>(`/api/admin/posts/${s}`)).post;
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
    return writeResult({ dryRun: false, action, target, exists: !!current, changes, result: { slug: res.post.slug, status: res.post.status, updatedAt: (res.post as { updatedAt?: string }).updatedAt } });
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
      const { items } = await api.adminGet<{ items: (AdminPost & { updatedAt: string })[] }>("/api/admin/posts");
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
        const meta = (post as { heMeta?: { bodyBase?: string | null } | null } | null)?.heMeta;
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
      let rev: string | undefined;
      if (live) {
        rev = undefined; /* The server reads and writes the document in one step. */
      } else if (type === "post") {
        const post = await loadPost(id);
        if (!post) return fail(`No post "${id}".`);
        rev = post._rev ?? "";
      } else {
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
        coverImage: z.string().url().nullable().optional(),
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
        coverImage: z.string().url().nullable().optional(),
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
        : { tagline: "", kind: "project", repo: null, description: "", coverImage: null, links: [], order: 50, status: "published" };
      const proposed = { ...base, ...defined };
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
}
