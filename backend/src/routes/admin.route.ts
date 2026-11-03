import { Router } from "express";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  CollectionHebrewSchema,
  CollectionSchema,
  PostContentSchema,
  PostSchema,
  SlugSchema,
  rawImageUrlOrNull,
  readingMinutes,
  type Collection,
  type Post,
  type PostContent,
} from "../schemas/content.js";
import { z } from "zod";
import { fetchRepoStats } from "../services/github.js";
import { requireProxySession } from "../middlewares/requireAdmin.js";
import { readAudit } from "../services/audit.js";
import { grantDocId, grantLive, revokeGrant, type McpGrantDoc } from "../mcp/oauth/provider.js";
import mediaRoutes from "./media.admin.route.js";
import {
  TOKEN_SCOPES,
  TOKEN_TTL_DAYS_DEFAULT,
  TOKEN_TTL_DAYS_MAX,
  newTokenDoc,
  publicToken,
  tokenDocId,
  type StoredToken,
} from "../services/apiTokenFormat.js";
import adminContentRoutes from "./admin-content.route.js";
import adminSettingsRoutes from "./admin-settings.route.js";
import adminTranslationsRoutes from "./admin-translations.route.js";

const router = Router();

const LinkSchema = z.object({ label: z.string().min(1).max(60), url: z.string().url() });

export const PostWrite = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().default(null),
  excerpt: z.string().max(320).default(""),
  body: z.string().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
  collection: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("site"),
  coverImage: z.string().url().nullable().default(null).transform(rawImageUrlOrNull),
  links: z.array(LinkSchema).max(8).default([]),
  publishedAt: z.string().datetime().nullable().default(null),
  /* Optional, not defaulted: a client that does not know the field leaves it
     as it was, and only an explicit null clears it. */
  featured: z.number().int().min(1).max(99).nullable().optional(),
  _rev: z.string().optional(),
});

const RepoWrite = z.object({
  owner: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  branch: z.string().min(1).max(60).default("main"),
  docPaths: z.array(z.string().max(200)).max(20).default([]),
});

export const CollectionWrite = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(120),
  tagline: z.string().max(160).default(""),
  kind: z.enum(["site", "project"]).default("project"),
  repo: RepoWrite.nullable().default(null),
  description: z.string().max(400).default(""),
  coverImage: z.string().url().nullable().default(null).transform(rawImageUrlOrNull),
  /* An icon from the media library (#253). Optional, not defaulted, like
     `featured`: a client that does not send it leaves it as it was. */
  icon: z.string().url().nullable().optional(),
  links: z.array(LinkSchema).max(8).default([]),
  order: z.coerce.number().int().default(50),
  status: z.enum(["published", "hidden"]).default("published"),
  he: CollectionHebrewSchema.nullable().optional(),
  _rev: z.string().optional(),
});

const postId = (slug: string) => `post:${slug}`;
const colId = (slug: string) => `collection:${slug}`;

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

router.get("/me", (req, res) => res.json({ ok: true, ...req.admin }));

/* The site's own content (#163): projects, the story, the site copy. */
router.use("/content", adminContentRoutes);

/* The site's settings (#254): section order and visibility, the visual defaults. */
router.use("/settings", adminSettingsRoutes);

/* The media library (#253): its own file, behind this router's gate and audit. */
router.use("/media", mediaRoutes);

/* What is missing or stale in Hebrew (#301): a read over everything above. */
router.use("/translations", adminTranslationsRoutes);

/* ---------------------------------------------------------------- posts -- */

router.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    /*
     * Sorted here rather than in the query, for the reason the collections
     * list below gives and one more: Mango refuses a sort it has no index
     * for, and the only index the API creates is [type, status, publishedAt].
     * So on any store nobody had hand-indexed for [type, updatedAt], every
     * request 400'd and the admin's Notes list answered "store unavailable".
     */
    const { docs } = await couch.find<Post>({
      selector: { type: "post" },
      limit: 300,
    });
    docs.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    res.json({ ok: true, items: docs });
  })
);

router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Post>(postId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    res.json({ ok: true, post: doc });
  })
);

router.put(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const parsed = PostWrite.safeParse({ ...req.body, slug: req.params.slug });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const i = parsed.data;
    const now = new Date().toISOString();
    const existing = await tryGet<Post>(postId(i.slug));

    /*
     * The optimistic lock must not be defeatable by omission. Falling back to
     * `existing._rev` meant a client that simply left `_rev` out overwrote
     * whatever was there unconditionally — which is the one thing the lock
     * exists to prevent. A write against an existing document has to name the
     * revision it was editing.
     */
    if (existing?._rev && !i._rev) {
      return res.status(409).json({
        ok: false,
        error: "This changed elsewhere. Reload and reapply your edit.",
      });
    }

    const doc: Post & { _rev?: string } = {
      _id: postId(i.slug),
      ...(existing?._rev ? { _rev: i._rev } : {}),
      type: "post",
      slug: i.slug,
      title: i.title,
      subtitle: i.subtitle,
      excerpt: i.excerpt || i.body.replace(/[#*`>_-]/g, "").slice(0, 300),
      body: i.body,
      bodyFormat: "markdown",
      status: i.status,
      // Stamped once on first publish, never moved by later edits.
      publishedAt: i.status === "published" ? existing?.publishedAt ?? i.publishedAt ?? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      tags: i.tags,
      collection: i.collection,
      coverImage: i.coverImage,
      links: i.links,
      source: existing?.source ?? "authored",
      readingMinutes: readingMinutes(i.body),
      featured: i.featured === undefined ? existing?.featured ?? null : i.featured,
      seo: existing?.seo ?? { title: null, description: null, canonical: null, noindex: false },
      /* Fields this route does not write (#250) are carried, never dropped. */
      he: existing?.he ?? null,
      changeNote: existing?.changeNote ?? null,
      draft: existing?.draft ?? null,
      draftSavedAt: existing?.draftSavedAt ?? null,
    };

    const ok = PostSchema.safeParse(doc);
    if (!ok.success) {
      return res.status(400).json({ ok: false, error: "invalid document", details: ok.error.flatten() });
    }
    try {
      const put = await couch.put<{ rev?: string }>(doc._id!, doc);
      /* The revision the store now holds, so the editor's next write names it. */
      if (put?.rev) doc._rev = put.rev;
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) {
        return res.status(409).json({ ok: false, error: "This post changed elsewhere. Reload and reapply." });
      }
      throw e;
    }
    res.locals.audit = { target: doc._id, before: existing, after: doc };
    res.json({ ok: true, post: doc });
  })
);

/*
 * The editor's draft and publish (#250).
 *
 * The rule is that a published note changes for the public only when the
 * author presses Publish. So:
 *
 *  - PUT  /posts/:slug/draft    autosave. On a published note it writes only
 *                               `draft` and `draftSavedAt`; the fields the
 *                               public reads, and `updatedAt` (the "Updated"
 *                               badge), are untouched. On a note that is not
 *                               published (or not yet stored) nothing is
 *                               public, so the fields are written directly
 *                               and the status stays what it was.
 *  - POST /posts/:slug/publish  copies the content onto the note, marks it
 *                               published, stamps `updatedAt`, records the
 *                               author's "what changed" line on a re-publish,
 *                               and clears the draft.
 *  - DELETE /posts/:slug/draft  throws the draft away.
 *
 * Every write names the revision it edited (the optimistic lock, as above),
 * and every body is the whole content, validated by zod, so a stored draft
 * is always publishable as it stands.
 */
const DraftWrite = PostContentSchema.extend({ _rev: z.string().optional() });
const PublishWrite = DraftWrite.extend({ changeNote: z.string().trim().max(200).optional() });

function invalid(res: import("express").Response, error: z.ZodError) {
  return res.status(400).json({ ok: false, error: "invalid", details: error.flatten() });
}

function conflict(res: import("express").Response) {
  return res.status(409).json({ ok: false, error: "This post changed elsewhere. Reload and reapply." });
}

function fromContent(c: PostContent) {
  return {
    title: c.title,
    subtitle: c.subtitle,
    excerpt: c.excerpt || c.body.replace(/[#*`>_[\]-]/g, "").slice(0, 300),
    body: c.body,
    tags: c.tags,
    collection: c.collection,
    coverImage: rawImageUrlOrNull(c.coverImage),
    links: c.links,
    featured: c.featured,
    seo: c.seo,
    he: c.he && (c.he.title || c.he.subtitle || c.he.excerpt || c.he.body) ? c.he : null,
    readingMinutes: readingMinutes(c.body),
  };
}

async function store(res: import("express").Response, doc: Post, before: Post | null) {
  const ok = PostSchema.safeParse(doc);
  if (!ok.success) return res.status(400).json({ ok: false, error: "invalid document", details: ok.error.flatten() });
  try {
    const put = await couch.put<{ rev?: string }>(doc._id!, doc);
    if (put?.rev) doc._rev = put.rev;
  } catch (e) {
    if (e instanceof CouchError && e.status === 409) return conflict(res);
    throw e;
  }
  res.locals.audit = { target: doc._id, before, after: doc };
  return res.json({ ok: true, post: doc });
}

router.put(
  "/posts/:slug/draft",
  asyncHandler(async (req, res) => {
    const slug = SlugSchema.safeParse(req.params.slug);
    if (!slug.success) return invalid(res, slug.error);
    const parsed = DraftWrite.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { _rev, ...content } = parsed.data;
    const existing = await tryGet<Post>(postId(slug.data));
    if (existing?._rev && _rev !== existing._rev) return conflict(res);
    const now = new Date().toISOString();

    if (existing && existing.status === "published") {
      return store(res, { ...existing, _rev, draft: content, draftSavedAt: now }, existing);
    }
    const doc: Post = {
      ...(existing ?? {}),
      _id: postId(slug.data),
      ...(existing?._rev ? { _rev } : {}),
      type: "post",
      slug: slug.data,
      ...fromContent(content),
      bodyFormat: "markdown",
      status: existing?.status ?? "draft",
      publishedAt: existing?.publishedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      source: existing?.source ?? "authored",
      changeNote: existing?.changeNote ?? null,
      draft: null,
      draftSavedAt: now,
    } as Post;
    return store(res, doc, existing);
  })
);

router.post(
  "/posts/:slug/publish",
  asyncHandler(async (req, res) => {
    const slug = SlugSchema.safeParse(req.params.slug);
    if (!slug.success) return invalid(res, slug.error);
    const parsed = PublishWrite.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { _rev, changeNote, ...content } = parsed.data;
    const existing = await tryGet<Post>(postId(slug.data));
    if (existing?._rev && _rev !== existing._rev) return conflict(res);
    const now = new Date().toISOString();
    const republish = existing?.status === "published";

    const doc: Post = {
      ...(existing ?? {}),
      _id: postId(slug.data),
      ...(existing?._rev ? { _rev } : {}),
      type: "post",
      slug: slug.data,
      ...fromContent(content),
      bodyFormat: "markdown",
      status: "published",
      /* The author's date when one is given; otherwise the first publish's,
         kept; otherwise now. */
      publishedAt: content.publishedAt ?? existing?.publishedAt ?? now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      source: existing?.source ?? "authored",
      changeNote: republish ? changeNote || null : null,
      draft: null,
      draftSavedAt: null,
    } as Post;
    return store(res, doc, existing);
  })
);

router.delete(
  "/posts/:slug/draft",
  asyncHandler(async (req, res) => {
    const slug = SlugSchema.safeParse(req.params.slug);
    if (!slug.success) return invalid(res, slug.error);
    const existing = await tryGet<Post>(postId(slug.data));
    if (!existing) return res.status(404).json({ ok: false, error: "Not Found" });
    const rev = typeof req.query.rev === "string" ? req.query.rev : "";
    if (rev !== existing._rev) return conflict(res);
    return store(res, { ...existing, draft: null, draftSavedAt: null }, existing);
  })
);

router.delete(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Post>(postId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    const next = { ...doc, status: "archived" as const, updatedAt: new Date().toISOString() };
    await couch.put(doc._id!, next);
    res.locals.audit = { target: doc._id, before: doc, after: next };
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------- collections -- */

router.get(
  "/collections",
  asyncHandler(async (_req, res) => {
    /*
     * Sorted here rather than in the query. CouchDB's Mango rejects a sort
     * whose fields disagree on direction, and this asked for type descending
     * with order ascending — so every request 400'd and the admin's Areas list
     * was permanently empty. The selector already pins `type` to one value, so
     * sorting on it bought nothing anyway, and a hundred rows sort for free.
     */
    const { docs } = await couch.find<Collection>({
      selector: { type: "collection" },
      limit: 100,
    });
    docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    res.json({ ok: true, items: docs });
  })
);

router.put(
  "/collections/:slug",
  asyncHandler(async (req, res) => {
    const parsed = CollectionWrite.safeParse({ ...req.body, slug: req.params.slug });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const i = parsed.data;
    const now = new Date().toISOString();
    const existing = await tryGet<Collection>(colId(i.slug));

    /*
     * The optimistic lock must not be defeatable by omission. Falling back to
     * `existing._rev` meant a client that simply left `_rev` out overwrote
     * whatever was there unconditionally — which is the one thing the lock
     * exists to prevent. A write against an existing document has to name the
     * revision it was editing.
     */
    if (existing?._rev && !i._rev) {
      return res.status(409).json({
        ok: false,
        error: "This changed elsewhere. Reload and reapply your edit.",
      });
    }

    const doc: Collection & { _rev?: string } = {
      _id: colId(i.slug),
      ...(existing?._rev ? { _rev: i._rev } : {}),
      type: "collection",
      slug: i.slug,
      title: i.title,
      description: i.description,
      coverImage: i.coverImage,
      icon: i.icon !== undefined ? i.icon : (existing?.icon ?? null),
      links: i.links,
      order: i.order,
      status: i.status,
      kind: i.kind,
      tagline: i.tagline,
      he: i.he === undefined ? existing?.he ?? null : i.he,
      repo: i.repo,
      // Stats belong to the sync job, not to this form — never clear them here.
      stats: existing?.stats ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const ok = CollectionSchema.safeParse(doc);
    if (!ok.success) {
      return res.status(400).json({ ok: false, error: "invalid document", details: ok.error.flatten() });
    }
    try {
      await couch.put(doc._id!, doc);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) {
        return res.status(409).json({ ok: false, error: "This collection changed elsewhere. Reload." });
      }
      throw e;
    }
    res.locals.audit = { target: doc._id, before: existing, after: doc };
    res.json({ ok: true, collection: doc });
  })
);

router.delete(
  "/collections/:slug",
  asyncHandler(async (req, res) => {
    if (req.params.slug === "site") {
      return res.status(400).json({ ok: false, error: "The site collection cannot be removed." });
    }
    const doc = await tryGet<Collection>(colId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    // Hidden, not deleted — posts still reference it by slug.
    const next = { ...doc, status: "hidden" as const, updatedAt: new Date().toISOString() };
    await couch.put(doc._id!, next);
    res.locals.audit = { target: doc._id, before: doc, after: next };
    res.json({ ok: true });
  })
);

/* Refresh one project's repository numbers on demand. The schedule does this
   anyway; this exists so a change is visible immediately after editing a repo. */
router.post(
  "/collections/:slug/sync",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Collection>(colId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    if (!doc.repo) return res.status(400).json({ ok: false, error: "No repository configured for this area." });
    const stats = await fetchRepoStats(doc.repo);
    const next = { ...doc, stats, updatedAt: new Date().toISOString() };
    await couch.put(doc._id!, next);
    res.locals.audit = { target: doc._id, before: doc, after: next };
    res.json({ ok: true, stats });
  })
);

/* ---------------------------------------------------------- api tokens -- */

/*
 * Scoped tokens for automation (#252). Managed only from a signed-in admin
 * session: a token, whatever its scope, cannot list, mint or revoke tokens.
 * The plaintext is returned once, at creation, and never stored.
 */
const TokenCreate = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "lowercase letters, digits and dashes"),
  // Least privilege unless asked: `write` has to be said out loud.
  scope: z.enum(TOKEN_SCOPES).default("read"),
  expiresInDays: z.number().int().min(1).max(TOKEN_TTL_DAYS_MAX).default(TOKEN_TTL_DAYS_DEFAULT),
});

router.get(
  "/tokens",
  requireProxySession,
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<StoredToken>({ selector: { type: "apitoken" }, limit: 200 });
    docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, items: docs.map(publicToken) });
  })
);

router.post(
  "/tokens",
  requireProxySession,
  asyncHandler(async (req, res) => {
    const parsed = TokenCreate.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const { token, doc } = newTokenDoc({
      name: parsed.data.name,
      scope: parsed.data.scope,
      ttlDays: parsed.data.expiresInDays,
      createdBy: req.admin!.login,
    });
    await couch.put(doc._id, doc);
    res.locals.audit = { target: doc._id, before: null, after: doc };
    res.status(201).json({ ok: true, token, item: publicToken(doc) });
  })
);

router.delete(
  "/tokens/:id",
  requireProxySession,
  asyncHandler(async (req, res) => {
    const doc = await tryGet<StoredToken>(tokenDocId(req.params.id));
    if (!doc || doc.type !== "apitoken") return res.status(404).json({ ok: false, error: "Not Found" });
    if (doc.revokedAt) return res.json({ ok: true, item: publicToken(doc) });
    const next = { ...doc, revokedAt: new Date().toISOString() };
    await couch.put(doc._id, next);
    res.locals.audit = { target: doc._id, before: doc, after: next };
    res.json({ ok: true, item: publicToken(next) });
  })
);

/* ------------------------------------------------- connected MCP apps -- */

/*
 * The remote MCP server's OAuth grants (#263): one per client the owner
 * allowed. Listed and revoked from the signed-in admin session only, like
 * tokens. Nothing hashed leaves here.
 */
const publicGrant = (g: McpGrantDoc, now = Date.now()) => ({
  id: g.id,
  client: g.clientName,
  scopes: g.scopes,
  login: g.login,
  createdAt: g.createdAt,
  lastUsedAt: g.lastUsedAt,
  expiresAt: g.refresh.expiresAt,
  revokedAt: g.revokedAt,
  revokedReason: g.revokedReason,
  status: g.revokedAt ? "revoked" : grantLive(g, now) ? "active" : "expired",
});

router.get(
  "/mcp/grants",
  requireProxySession,
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<McpGrantDoc>({ selector: { type: "mcpgrant" }, limit: 200 });
    docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, items: docs.map((g) => publicGrant(g)) });
  })
);

router.delete(
  "/mcp/grants/:id",
  requireProxySession,
  asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{16}$/.test(req.params.id)) return res.status(404).json({ ok: false, error: "Not Found" });
    const before = await tryGet<McpGrantDoc>(grantDocId(req.params.id));
    if (!before || before.type !== "mcpgrant") return res.status(404).json({ ok: false, error: "Not Found" });
    const after = await revokeGrant(before.id, `revoked by ${req.admin!.login}`);
    if (!before.revokedAt) res.locals.audit = { target: before._id, before, after };
    res.json({ ok: true, item: publicGrant(after ?? before) });
  })
);

/* ---------------------------------------------------------------- audit -- */

const AuditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().regex(/^audit:[0-9TZ:.-]+:[0-9a-f]{8}$/).optional(),
});

router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const parsed = AuditQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const items = await readAudit(parsed.data);
    const nextBefore = items.length === parsed.data.limit ? items[items.length - 1].id : null;
    res.json({ ok: true, items, next: nextBefore });
  })
);

export default router;
