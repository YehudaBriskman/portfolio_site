import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { CONTENT_SEED } from "../content/seed.js";
import { fp } from "../schemas/i18n.js";
import type { ContentBundle } from "../schemas/site-content.js";

/*
 * GET /api/admin/translations (#301): the report the Translations page and
 * the MCP tools read. A read only: these tests also hold that it never writes.
 */

const NOW = "2026-11-03T08:00:00.000Z";

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

function note(slug: string, over: Record<string, unknown> = {}) {
  return {
    _id: `post:${slug}`,
    _rev: "1-a",
    type: "post",
    slug,
    title: `Title of ${slug}`,
    subtitle: null,
    excerpt: "A lede.",
    body: "Body.",
    status: "published",
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    tags: [],
    collection: "site",
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...over,
  };
}

function area(slug: string, over: Record<string, unknown> = {}) {
  return {
    _id: `collection:${slug}`,
    _rev: "1-b",
    type: "collection",
    slug,
    title: slug,
    tagline: "A line.",
    description: "",
    status: "published",
    order: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

let docs: Record<string, unknown>[];
let contentDocs: Map<string, unknown>;

beforeEach(() => {
  docs = [];
  contentDocs = new Map();
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => ({
    docs: docs.filter((d) => d.type === (q as { selector: { type: string } }).selector.type),
  }));
  vi.spyOn(couch, "get").mockImplementation(async <T>(id: string) => {
    const d = contentDocs.get(id);
    if (!d) throw new CouchError(404, "couch 404");
    return structuredClone(d) as T;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/admin/translations", () => {
  it("is behind the admin gate", async () => {
    const res = await request(createApp()).get("/api/admin/translations");
    expect([401, 403]).toContain(res.status);
  });

  it("reports every item, ranked by visibility, with unit counts and coverage", async () => {
    docs = [
      note("older", { publishedAt: "2026-01-01T00:00:00.000Z" }),
      note("newer", { he: { title: "כותרת", subtitle: "", excerpt: "פתיח.", body: "גוף." } }),
      note("hidden", { status: "draft" }),
      note("gone", { status: "archived" }),
      area("bothy"),
    ];
    const put = vi.spyOn(couch, "put");
    const res = await asAdmin(request(createApp()).get("/api/admin/translations"));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.ok).toBe(true);

    const items = res.body.items as { type: string; id: string; rank: number; status: string; visibility: string }[];
    const ids = items.map((i) => `${i.type}:${i.id}`);
    /* The home page first, notes last and newest first; an archived note is not listed. */
    expect(ids[0]).toBe("site-copy:hero");
    expect(ids).toContain("area:bothy");
    expect(ids).not.toContain("post:gone");
    expect(ids.indexOf("post:newer")).toBeLessThan(ids.indexOf("post:older"));
    expect(ids.indexOf("area:bothy")).toBeLessThan(ids.indexOf("post:newer"));
    expect(items.map((i) => i.rank)).toEqual([...items.map((i) => i.rank)].sort((a, b) => a - b));

    expect(items.find((i) => i.id === "newer")).toMatchObject({ status: "unverified", visibility: "public" });
    expect(items.find((i) => i.id === "older")).toMatchObject({ status: "missing" });
    expect(items.find((i) => i.id === "hidden")).toMatchObject({ visibility: "private" });

    const { counts, coverage } = res.body;
    expect(Object.keys(counts).sort()).toEqual(["draft", "missing", "stale", "translated", "unverified"]);
    const total = Object.values(counts as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(items.reduce((n, i) => n + (i as unknown as { units: unknown[] }).units.length, 0));
    expect(coverage).toBeGreaterThanOrEqual(0);
    expect(coverage).toBeLessThanOrEqual(100);
    expect(put).not.toHaveBeenCalled();
  });

  it("reads the stored content, its draft, and any fingerprint already there", async () => {
    const seed = structuredClone(CONTENT_SEED) as ContentBundle;
    const project = seed.projects.items[0];
    project.fact = { en: project.fact.en, he: "עובדה.", heSrc: fp(project.fact.en) } as typeof project.fact;
    project.description = { en: project.description.en, he: "תיאור.", heSrc: fp("What it said before.") } as typeof project.description;
    /* Published without Hebrew, so the Hebrew the draft gives it is draft-only. */
    project.storyLine = { en: project.storyLine.en };
    const draft = structuredClone(seed.projects);
    draft.items[0].storyLine = { en: project.storyLine.en, he: "שורה." };
    contentDocs.set("content:projects", { _id: "content:projects", type: "content", key: "projects", published: seed.projects, draft });

    const res = await asAdmin(request(createApp()).get(`/api/admin/translations?type=project`));
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: { id: string }) => i.id === project.slug);
    const byPath = Object.fromEntries(item.units.map((u: { path: string; status: string }) => [u.path, u.status]));
    expect(byPath.fact).toBe("translated");
    expect(byPath.description).toBe("stale");
    expect(byPath.storyLine).toBe("draft");
    expect(item.status).toBe("stale");
    expect(item.route).toBe(`/projects/${project.slug}`);
    expect(res.body.items.every((i: { type: string }) => i.type === "project")).toBe(true);
  });

  it("filters by status (keeping only the matching units), type and visibility", async () => {
    docs = [note("one"), note("two", { status: "draft" }), area("bothy", { he: { title: "Bothy", tagline: null, description: null } })];
    const res = await asAdmin(request(createApp()).get("/api/admin/translations?status=unverified&type=post,area&visibility=public"));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual(["bothy"]);
    expect(res.body.items[0].units.map((u: { path: string }) => u.path)).toEqual(["title"]);
    /* Counts ignore the status filter, so every tab keeps its number. */
    expect(res.body.counts.missing).toBeGreaterThan(0);

    const repeated = await asAdmin(request(createApp()).get("/api/admin/translations?type=post&type=area"));
    expect(new Set(repeated.body.items.map((i: { type: string }) => i.type))).toEqual(new Set(["post", "area"]));
  });

  it("refuses a status or type it does not know", async () => {
    const res = await asAdmin(request(createApp()).get("/api/admin/translations?status=done"));
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    const bad = await asAdmin(request(createApp()).get("/api/admin/translations?type=video"));
    expect(bad.status).toBe(400);
  });
});
