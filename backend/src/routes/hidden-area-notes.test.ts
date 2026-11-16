import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { resetShellCache } from "../services/seo.js";
import { INDEX_HTML } from "../testShell.js";

/*
 * A note whose area is hidden leaves every public surface with the area
 * (#875): the blog API, the sitemap, the feed, the rendered pages and the
 * public MCP tools. The admin routes still see it, a note with no area doc is
 * unaffected, and un-hiding the area brings the note back.
 *
 * The stub is a small stateful store that honours the selectors the routes
 * send, so a route that forgot to ask would show up here.
 */

const T = "2026-10-01T00:00:00.000Z";

function post(slug: string, collection: string, extra: Record<string, unknown> = {}) {
  return {
    _id: `post:${slug}`,
    _rev: "1-a",
    type: "post",
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    excerpt: `Excerpt ${slug}.`,
    body: "Body.",
    bodyFormat: "markdown",
    status: "published",
    publishedAt: T,
    createdAt: T,
    updatedAt: T,
    tags: [`tag-${slug}`],
    collection,
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...extra,
  };
}

function area(slug: string, status = "published") {
  return {
    _id: `collection:${slug}`,
    _rev: "1-a",
    type: "collection",
    slug,
    title: `Area ${slug}`,
    description: "",
    coverImage: null,
    links: [],
    order: 10,
    status,
    kind: "project",
    tagline: "",
    repo: null,
    stats: null,
    createdAt: T,
    updatedAt: T,
  };
}

let docs: Record<string, unknown>[];

function matches(doc: Record<string, unknown>, selector: Record<string, unknown>): boolean {
  return Object.entries(selector).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$ne") return v !== arg;
        if (op === "$eq") return v === arg;
        if (op === "$elemMatch") return Array.isArray(v) && v.some((x) => x === (arg as { $eq: unknown }).$eq);
        return false;
      });
    }
    return v === cond;
  });
}

const setAreaStatus = (slug: string, status: string) => {
  docs = docs.map((d) => (d.type === "collection" && d.slug === slug ? { ...d, status } : d));
};

beforeEach(() => {
  resetShellCache();
  env.MCP_REMOTE = "on";
  docs = [
    area("site"),
    area("windom"),
    area("secret-area"),
    post("site-note", "site"),
    post("windom-note", "windom"),
    post("hidden-note", "secret-area"),
    // An area that has no document at all: unaffected.
    post("orphan-note", "no-such-area"),
  ];
  setAreaStatus("secret-area", "hidden");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } })),
  );
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const { selector, limit } = q as { selector: Record<string, unknown>; limit?: number };
    return { docs: docs.filter((d) => matches(d, selector)).slice(0, limit ?? 25) } as never;
  });
  vi.spyOn(couch, "get").mockImplementation(async (id: string) => {
    const d = docs.find((x) => x._id === id);
    if (!d) throw new CouchError(404, "couch 404");
    return d as never;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

const app = () => createApp();
const asAdmin = (req: request.Test) =>
  req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

const mcp = (name: string, args: Record<string, unknown>) =>
  request(app())
    .post("/mcp/public")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

describe("public blog API", () => {
  it("leaves a hidden area's note out of the list, filtered or not", async () => {
    const all = await request(app()).get("/api/blog/posts");
    const slugs = all.body.items.map((i: { slug: string }) => i.slug).sort();
    expect(slugs).toEqual(["orphan-note", "site-note", "windom-note"]);

    const byArea = await request(app()).get("/api/blog/posts?collection=secret-area");
    expect(byArea.body.items).toEqual([]);
    const byTag = await request(app()).get("/api/blog/posts?tag=tag-hidden-note");
    expect(byTag.body.items).toEqual([]);
  });

  it("does not count its tags", async () => {
    const res = await request(app()).get("/api/blog/tags");
    const tags = res.body.tags.map((t: { tag: string }) => t.tag);
    expect(tags).not.toContain("tag-hidden-note");
    expect(tags).toContain("tag-windom-note");
  });

  it("answers its direct URL with the same 404 as an unpublished note", async () => {
    docs.push(post("draft-note", "site", { status: "draft" }));
    const hidden = await request(app()).get("/api/blog/posts/hidden-note");
    const draft = await request(app()).get("/api/blog/posts/draft-note");
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(draft.body);
    expect(JSON.stringify(hidden.body)).not.toContain("secret-area");
  });

  it("serves a note with no area document, and a note of a visible area", async () => {
    expect((await request(app()).get("/api/blog/posts/orphan-note")).status).toBe(200);
    expect((await request(app()).get("/api/blog/posts/windom-note")).status).toBe(200);
  });

  it("brings the note back when the area is published again", async () => {
    setAreaStatus("secret-area", "published");
    expect((await request(app()).get("/api/blog/posts/hidden-note")).status).toBe(200);
    const all = await request(app()).get("/api/blog/posts");
    expect(all.body.items.map((i: { slug: string }) => i.slug)).toContain("hidden-note");
  });
});

describe("crawler surfaces", () => {
  it("keeps the note out of the sitemap and the main feed", async () => {
    const sitemap = await request(app()).get("/api/seo/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain("/blog/windom-note");
    expect(sitemap.text).not.toContain("hidden-note");

    const feed = await request(app()).get("/api/seo/feed.xml");
    expect(feed.text).toContain("windom-note");
    expect(feed.text).not.toContain("hidden-note");
  });

  it("keeps it out of the area feed and the activity feed", async () => {
    expect((await request(app()).get("/api/seo/feed/secret-area.xml")).status).toBe(404);
    const log = await request(app()).get("/api/seo/feed/log.xml");
    expect(log.text).not.toContain("hidden-note");
  });

  it("keeps it out of the rendered list and 404s its rendered page and card", async () => {
    const list = await request(app()).get("/api/seo/render/blog");
    expect(list.text).not.toContain("hidden-note");
    expect(list.text).toContain("windom-note");

    const page = await request(app()).get("/api/seo/render/blog/hidden-note");
    expect(page.status).toBe(404);
    const card = await request(app()).get("/api/seo/og/blog/hidden-note.png");
    expect(card.status).toBe(404);
  });

  it("restores the sitemap entry when the area is published again", async () => {
    setAreaStatus("secret-area", "published");
    const sitemap = await request(app()).get("/api/seo/sitemap.xml");
    expect(sitemap.text).toContain("/blog/hidden-note");
  });
});

describe("public MCP tools", () => {
  it("do not list or fetch the note, nor count its tags", async () => {
    const list = await mcp("list_posts", {});
    expect(list.body.result.content[0].text).toContain("windom-note");
    expect(list.body.result.content[0].text).not.toContain("hidden-note");

    const one = await mcp("get_post", { slug: "hidden-note" });
    expect(one.body.result.isError).toBe(true);

    const tags = await mcp("list_tags", {});
    expect(tags.body.result.content[0].text).not.toContain("tag-hidden-note");
  });
});

describe("admin routes", () => {
  it("still see the note of a hidden area", async () => {
    const list = await asAdmin(request(app()).get("/api/admin/posts"));
    expect(list.body.items.map((i: { slug: string }) => i.slug)).toContain("hidden-note");
    const one = await asAdmin(request(app()).get("/api/admin/posts/hidden-note"));
    expect(one.status).toBe(200);
  });
});
