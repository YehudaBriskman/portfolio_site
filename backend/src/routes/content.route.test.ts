import fs from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { CONTENT_SEED } from "../content/seed.js";
import type { ContentBundle, ContentDoc, ContentKey } from "../schemas/site-content.js";
import { resetShellCache } from "../services/seo.js";
import { fp } from "../schemas/i18n.js";

/*
 * The site's content in the store (#163): the public read, the editing API
 * behind the admin gate, the seed, and the crawler renders reading the same
 * documents.
 *
 * CouchDB is an in-memory map here, with its two behaviours that matter: a
 * PUT without the current revision of an existing document is 409, and a
 * missing document is 404.
 */

const seed = () => structuredClone(CONTENT_SEED) as ContentBundle;
const NOW = "2026-11-03T08:00:00.000Z";

let store: Map<string, ContentDoc>;
let revs = 0;

function stored(key: ContentKey, published: unknown, draft: unknown = null): ContentDoc {
  return {
    _id: `content:${key}`,
    _rev: `1-${key}`,
    type: "content",
    key,
    published,
    draft,
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: NOW,
    source: "seed",
  };
}

function put(doc: ContentDoc) {
  store.set(doc._id, structuredClone(doc));
}

beforeEach(() => {
  store = new Map();
  vi.spyOn(couch, "get").mockImplementation(async <T>(id: string) => {
    const doc = store.get(id);
    if (!doc) throw new CouchError(404, "couch 404");
    return structuredClone(doc) as T;
  });
  vi.spyOn(couch, "put").mockImplementation(async <T>(id: string, body: unknown) => {
    const doc = body as ContentDoc;
    const existing = store.get(id);
    if (existing ? doc._rev !== existing._rev : doc._rev !== undefined) throw new CouchError(409, "couch 409");
    const rev = `${++revs + 1}-x`;
    store.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as T;
  });
});

afterEach(() => vi.restoreAllMocks());

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

describe("GET /api/content", () => {
  it("serves the seed when the store has nothing, cached for a minute", async () => {
    const res = await request(createApp()).get("/api/content");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    const { ok, ...bundle } = res.body;
    expect(ok).toBe(true);
    expect(bundle).toEqual(seed());
  });

  it("serves what is published, never the draft", async () => {
    const s = seed();
    const published = { ...s.siteCopy, about: { ...s.siteCopy.about, heading: { en: "How I work now" } } };
    const draft = { ...s.siteCopy, about: { ...s.siteCopy.about, heading: { en: "Unfinished draft" } } };
    put(stored("site-copy", published, draft));
    const res = await request(createApp()).get("/api/content");
    expect(res.body.siteCopy.about.heading).toEqual({ en: "How I work now" });
    expect(JSON.stringify(res.body)).not.toContain("Unfinished draft");
    expect(res.body.projects).toEqual(s.projects);
  });

  it("falls back to the seed for a document that no longer parses", async () => {
    put(stored("story", { start: "broken" }));
    const res = await request(createApp()).get("/api/content");
    expect(res.status).toBe(200);
    expect(res.body.story).toEqual(seed().story);
  });

  it("serves one key, and 404s an unknown one", async () => {
    const one = await request(createApp()).get("/api/content/story");
    expect(one.body).toEqual({ ok: true, key: "story", content: seed().story });
    expect((await request(createApp()).get("/api/content/secrets")).status).toBe(404);
  });
});

describe("/api/admin/content", () => {
  it("sits behind the admin gate", async () => {
    const res = await request(createApp()).get("/api/admin/content/projects");
    expect(res.status).toBe(401);
    const write = await request(createApp()).post("/api/admin/content/seed");
    expect(write.status).toBe(401);
    expect(couch.put).not.toHaveBeenCalled();
  });

  it("reads a key that was never seeded as the seed, with no revision", async () => {
    const res = await asAdmin(request(createApp()).get("/api/admin/content/projects"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ key: "projects", exists: false, _rev: null, draft: null });
    expect(res.body.published).toEqual(seed().projects);
  });

  it("saves a draft without publishing it", async () => {
    put(stored("site-copy", seed().siteCopy));
    const data = seed().siteCopy;
    data.hero.phrases[2] = { en: "Build boldly", he: "בונים באומץ" };
    const res = await asAdmin(request(createApp()).put("/api/admin/content/site-copy/draft")).send({ data, _rev: "1-site-copy" });
    expect(res.status).toBe(200);
    const doc = store.get("content:site-copy")!;
    /* New Hebrew is stamped with the English it was written against (#303). */
    expect((doc.draft as ContentBundle["siteCopy"]).hero.phrases[2]).toEqual({ en: "Build boldly", he: "בונים באומץ", heSrc: fp("Build boldly") });
    expect(doc.published).toEqual(seed().siteCopy);
    const pub = await request(createApp()).get("/api/content");
    expect(pub.body.siteCopy.hero.phrases[2]).toEqual({ en: "Build boldly", he: "לבנות באומץ" });
  });

  it("answers a schema failure with each field's path and message", async () => {
    const data = seed().projects;
    data.items[0].fact = { en: "" };
    data.items[1].tint = [300, 0, 0];
    data.items[2].slug = data.items[0].slug;
    const res = await asAdmin(request(createApp()).put("/api/admin/content/projects/draft")).send({ data });
    expect(res.status).toBe(400);
    const paths = res.body.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["items.0.fact.en", "items.1.tint.0", "items.2.slug"]));
    expect(res.body.issues.find((i: { path: string }) => i.path === "items.0.fact.en").message).toBe("English is required");
    expect(couch.put).not.toHaveBeenCalled();
  });

  it("refuses a write that does not name the current revision", async () => {
    put(stored("story", seed().story));
    const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data: seed().story });
    expect(res.status).toBe(409);
    const stale = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({
      data: seed().story,
      _rev: "0-old",
    });
    expect(stale.status).toBe(409);
    expect(couch.put).not.toHaveBeenCalled();
  });

  it("publishes: the draft becomes live and is cleared", async () => {
    const data = seed().story;
    data.roles[1].when = { en: "2024" };
    put(stored("story", seed().story, data));
    const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data, _rev: "1-story" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ exists: true, draft: null, source: "admin" });
    expect(store.get("content:story")!.published).toEqual(data);
    const pub = await request(createApp()).get("/api/content");
    expect(pub.body.story.roles[1].when).toEqual({ en: "2024" });
  });

  /* The guarantees buildStory() gave at build time. */
  describe("refuses what buildStory() would have refused", () => {
    it("an interlude that follows no beat", async () => {
      const data = seed().story;
      data.interludes[0].after = "no-such-beat";
      const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues).toEqual([
        { path: "interludes.0.after", message: 'Interlude "loop-open" follows "no-such-beat", which is not a beat' },
      ]);
    });

    it("an interlude missing a language", async () => {
      const data = seed().story;
      data.interludes[1].words.he = "";
      const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].path).toBe("interludes.1.words.he");
    });

    it("a picture or a layout filed under a beat that does not exist", async () => {
      const data = seed().story;
      data.layouts["windon"] = "under";
      data.images["nwo"] = { src: "/story/now.jpg", alt: { en: "A desk" } };
      const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data });
      expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(["layouts.windon", "images.nwo"]);
    });

    it("a project with no story line", async () => {
      const data = seed().projects;
      data.items[0].storyLine = { en: " " };
      const res = await asAdmin(request(createApp()).post("/api/admin/content/projects/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].path).toBe("items.0.storyLine.en");
    });

    it("removing a project the story still places, and says where to fix it", async () => {
      const data = seed().projects;
      data.items = data.items.filter((p) => p.slug !== "bothy");
      const res = await asAdmin(request(createApp()).post("/api/admin/content/projects/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].message).toBe(
        'The story sets a layout for "bothy", which is not a beat (edit the story first)',
      );
    });

    it("a role whose id is a project's slug", async () => {
      const data = seed().story;
      data.roles[0].id = "windom";
      const res = await asAdmin(request(createApp()).post("/api/admin/content/story/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].message).toMatch(/Two beats share the id "windom"/);
    });

    it("a change of start year that strands the start beat's layout", async () => {
      put(stored("story", { ...seed().story, layouts: { ...seed().story.layouts, "start-2021": "under" } }));
      const data = seed().siteCopy;
      data.hero.shippingSince = 2020;
      const res = await asAdmin(request(createApp()).post("/api/admin/content/site-copy/publish")).send({ data });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].message).toMatch(/"start-2021", which is not a beat/);
    });
  });

  it("discards a draft against its revision", async () => {
    put(stored("story", seed().story, seed().story));
    expect((await asAdmin(request(createApp()).delete("/api/admin/content/story/draft"))).status).toBe(409);
    const res = await asAdmin(request(createApp()).delete("/api/admin/content/story/draft?rev=1-story"));
    expect(res.status).toBe(200);
    expect(store.get("content:story")!.draft).toBeNull();
  });

  it("previews the drafts where there are any", async () => {
    const draft = seed().siteCopy;
    draft.about.heading = { en: "Draft heading" };
    put(stored("site-copy", seed().siteCopy, draft));
    const res = await asAdmin(request(createApp()).get("/api/admin/content/preview"));
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.siteCopy.about.heading).toEqual({ en: "Draft heading" });
    expect(res.body.projects).toEqual(seed().projects);
  });

  it("lists each key's state", async () => {
    put(stored("story", seed().story, seed().story));
    const res = await asAdmin(request(createApp()).get("/api/admin/content"));
    expect(res.body.items).toEqual([
      { key: "projects", exists: false, hasDraft: false, updatedAt: null, publishedAt: null },
      { key: "story", exists: true, hasDraft: true, updatedAt: NOW, publishedAt: NOW },
      { key: "site-copy", exists: false, hasDraft: false, updatedAt: null, publishedAt: null },
    ]);
  });
});

describe("the seed", () => {
  it("creates what is missing, is idempotent, and never overwrites an edit", async () => {
    const edited = seed().siteCopy;
    edited.contact.availability = { en: "Edited in the admin" };
    put({ ...stored("site-copy", edited), source: "admin" });

    const first = await asAdmin(request(createApp()).post("/api/admin/content/seed"));
    expect(first.body).toEqual({ ok: true, created: ["projects", "story"], kept: ["site-copy"] });
    expect(store.get("content:projects")!.published).toEqual(seed().projects);
    expect(store.get("content:projects")!.source).toBe("seed");
    expect((store.get("content:site-copy")!.published as ContentBundle["siteCopy"]).contact.availability).toEqual({
      en: "Edited in the admin",
    });

    const before = JSON.stringify([...store.entries()]);
    const second = await asAdmin(request(createApp()).post("/api/admin/content/seed"));
    expect(second.body).toEqual({ ok: true, created: [], kept: ["projects", "story", "site-copy"] });
    expect(JSON.stringify([...store.entries()])).toBe(before);
  });
});

describe("the crawler renders read the store", () => {
  const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

  beforeEach(() => {
    resetShellCache();
    /* The built shell; the store is the spied couch above, never fetched. */
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } })),
    );
    vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetShellCache();
  });

  it("echoes the home page's copy as published", async () => {
    const s = seed().siteCopy;
    s.about.principles[0].claim = { en: "A claim edited in the admin" };
    put(stored("site-copy", s));
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.status).toBe(200);
    const body = res.text.slice(res.text.indexOf("</head>"));
    expect(body).toContain("<h3>A claim edited in the admin</h3>");
    expect(body).toContain("<h2>How I work</h2>");
    expect(body).toContain("I lead a small team building and running internal software");
  });

  it("renders a project that exists only in the store", async () => {
    const p = seed().projects;
    p.items.push({ ...p.items[1], slug: "new-thing", title: "New Thing", order: 12 });
    put(stored("projects", p));
    const res = await request(createApp()).get("/api/seo/render/projects/new-thing");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>New Thing · Yehuda Briskman</title>");
    const list = await request(createApp()).get("/api/seo/render/projects");
    expect(list.text).toContain('<a href="/projects/new-thing">New Thing</a>');
    expect(list.text).toContain("A console for one machine that asks Docker what is running");
  });

  it("lists the story's beats in the page's order", async () => {
    const res = await request(createApp()).get("/api/seo/render/story");
    const body = res.text.slice(res.text.indexOf("<ol>"), res.text.indexOf("</ol>"));
    /* No tag stripping: a heading is plain escaped text, or a year and one
       link to its project, and anything else fails the match outright. */
    const heads = [...body.matchAll(/<h2>(.*?)<\/h2>/g)].map(([, inner]) => {
      const link = /^(\d{4}: )<a href="\/projects\/[a-z0-9-]+">([^<>]*)<\/a>$/.exec(inner);
      if (link) return link[1] + link[2];
      expect(inner).not.toMatch(/[<>]/);
      return inner;
    });
    expect(heads).toEqual([
      "2021: Started shipping",
      "2025: Programming with Yehuda",
      "2025: Icaros",
      "2026: WindoM",
      "2026: Bothy",
      "2026: Portfolio site",
      "2026: oci-free",
      "Then: Full-stack engineer",
      "Now: Technical team lead",
    ]);
  });
});
