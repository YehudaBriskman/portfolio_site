import fs from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";

/*
 * The content database now also holds API tokens and the admin audit log
 * (#252). Nothing public may return them, or count them, whatever is asked.
 *
 * The store here is a small Mango interpreter over a fixed set of documents,
 * and the two sensitive ones are dressed as bait: `status: "published"`, a
 * slug, a tag and an area, so that ANY selector which forgot to pin `type`
 * would match them. Only the selectors' own `type` keeps them out — which is
 * the property under test. Every selector a public route sends is also
 * checked directly.
 */

const NOW = "2026-10-01T10:00:00.000Z";
const CANARY = "leakcanary";

const bait = {
  status: "published",
  slug: CANARY,
  title: `${CANARY} title`,
  tags: [CANARY],
  collection: "site",
  publishedAt: NOW,
  updatedAt: NOW,
  createdAt: NOW,
  order: 1,
};

const DOCS: Record<string, unknown>[] = [
  {
    _id: "post:hello",
    type: "post",
    slug: "hello",
    title: "Hello",
    subtitle: null,
    excerpt: "e",
    body: "b",
    bodyFormat: "markdown",
    status: "published",
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    tags: ["intro"],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    featured: null,
    seo: { title: null, description: null, canonical: null, noindex: false },
  },
  {
    _id: "collection:site",
    type: "collection",
    slug: "site",
    title: "Site",
    description: "",
    coverImage: null,
    links: [],
    order: 0,
    status: "published",
    kind: "site",
    tagline: "",
    repo: null,
    stats: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    _id: `apitoken:${"a".repeat(16)}`,
    type: "apitoken",
    id: "a".repeat(16),
    name: CANARY,
    scope: "write",
    hash: `${CANARY}hash`,
    revokedAt: null,
    expiresAt: "2099-01-01T00:00:00.000Z",
    lastUsedAt: null,
    createdBy: `${CANARY}-actor`,
    ...bait,
  },
  {
    _id: `audit:${NOW}:0000abcd`,
    type: "audit",
    at: NOW,
    actor: { login: `${CANARY}-actor`, via: "token", tokenId: "a".repeat(16) },
    method: "PUT",
    path: `/api/admin/posts/${CANARY}`,
    target: `post:${CANARY}`,
    beforeHash: null,
    afterHash: `${CANARY}hash`,
    ...bait,
  },
];

/* Enough of Mango for the selectors the public routes send. */
function matches(doc: Record<string, unknown>, selector: Record<string, unknown>): boolean {
  return Object.entries(selector).every(([key, cond]) => {
    const v = doc[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
        if (op === "$eq") return v === arg;
        if (op === "$ne") return v !== arg;
        if (op === "$in") return (arg as unknown[]).includes(v);
        if (op === "$gt") return String(v) > String(arg);
        if (op === "$lt") return String(v) < String(arg);
        if (op === "$elemMatch") return Array.isArray(v) && v.some((x) => matches({ x }, { x: arg }));
        throw new Error(`operator ${op} not modelled`);
      });
    }
    return v === cond;
  });
}

let selectors: Record<string, unknown>[] = [];

beforeEach(() => {
  selectors = [];
  resetShellCache();
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const { selector, limit } = q as { selector: Record<string, unknown>; limit?: number };
    selectors.push(selector);
    return { docs: DOCS.filter((d) => matches(d, selector)).slice(0, limit ?? 25) } as never;
  });
  vi.spyOn(couch, "get").mockImplementation(async (id: string) => {
    const doc = DOCS.find((d) => d._id === id);
    // Public routes read by id only for the site's release list.
    if (!doc || (doc.type !== "post" && doc.type !== "collection")) throw new CouchError(404, "couch 404");
    return doc as never;
  });
  const shell = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/index.html")) return new Response(shell, { status: 200 });
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

const PATHS = [
  "/api/blog/posts",
  `/api/blog/posts?tag=${CANARY}`,
  "/api/blog/posts?collection=site",
  "/api/blog/posts?tag[$ne]=x",
  "/api/blog/posts?collection[$gt]=",
  `/api/blog/posts/${CANARY}`,
  "/api/blog/tags",
  "/api/blog/collections",
  `/api/blog/collections/${CANARY}`,
  "/api/activity",
  "/api/activity?limit=50&area=site",
  "/api/activity?kind=post,area,site",
  "/api/areas",
  "/api/seo/sitemap.xml",
  "/api/seo/feed.xml",
  "/api/seo/feed/log.xml",
  "/api/seo/feed/site.xml",
  "/api/seo/render/home",
  "/api/seo/render/blog",
  "/api/seo/render/blog/log",
  "/api/seo/render/projects",
  `/api/seo/render/blog/${CANARY}`,
  "/api/seo/render/blog/area/site",
  `/api/seo/render/projects/${CANARY}`,
];

describe("public routes never expose tokens or the audit log", () => {
  it.each(PATHS)("%s", async (p) => {
    const res = await request(createApp()).get(p);
    expect(res.status).toBeLessThan(500);
    const text = res.text ?? "";
    // Not the bare slug: a render of an unknown page echoes the URL it was asked for.
    for (const marker of [`${CANARY} title`, `${CANARY}hash`, `${CANARY}-actor`, "apitoken"]) {
      expect(text).not.toContain(marker);
    }
    expect(text).not.toContain("audit:");
  });

  it("the bait is reachable to a selector that forgets `type` (the fake is honest)", () => {
    expect(DOCS.filter((d) => matches(d, { status: "published", slug: CANARY }))).toHaveLength(2);
  });

  it("every selector a public route sends pins type to post or collection", async () => {
    const app = createApp();
    for (const p of PATHS) await request(app).get(p);
    expect(selectors.length).toBeGreaterThan(PATHS.length / 2);
    for (const s of selectors) expect(["post", "collection"]).toContain(s.type);
  });

  it("tag and area counts are not inflated by them", async () => {
    const tags = await request(createApp()).get("/api/blog/tags");
    expect(tags.body.tags).toEqual([{ tag: "intro", count: 1 }]);
    const areas = await request(createApp()).get("/api/areas");
    expect(areas.body.items.map((a: { slug: string }) => a.slug)).toEqual(["site"]);
  });
});
