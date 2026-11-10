import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FetchLike } from "./api.js";
import { loadConfig } from "./config.js";
import { lineDiff } from "./diff.js";
import { ADMIN_TOOLS, PUBLIC_TOOLS, STDIO_TOOLS, createServer } from "./server.js";

/*
 * The server against a mocked HTTP API: which tools exist with and without a
 * token, the dry-run diff, the confirm gate on deletes, and how an auth
 * refusal reads. No network.
 */

const API = "http://api.test";
/* A token-shaped fixture, assembled so no literal in the source looks like a
   credential to the secret scan (Static's gitleaks step). */
const TOKEN = ["ptk", "0".repeat(16), "x".repeat(43)].join("_");

type Call = { method: string; path: string; auth: string | null; body: unknown };

const POST = {
  _id: "post:hello",
  _rev: "3-abc",
  slug: "hello",
  title: "Hello",
  subtitle: null,
  excerpt: "e",
  body: "line one\nline two\nline three",
  status: "draft",
  tags: ["a"],
  collection: "site",
  coverImage: null,
  links: [],
  publishedAt: null,
  featured: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const AREA = {
  _id: "collection:tools",
  _rev: "1-x",
  slug: "tools",
  title: "Tools",
  tagline: "",
  kind: "project",
  repo: null,
  description: "",
  coverImage: null,
  links: [],
  order: 10,
  status: "published",
};

/* A tiny fake of the API. `routes` maps "METHOD /path" to [status, body]. */
function fakeApi(routes: Record<string, [number, unknown]>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const u = new URL(input);
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      method,
      path: u.pathname + u.search,
      auth: headers.Authorization ?? null,
      body: init?.body instanceof Uint8Array || init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const hit = routes[`${method} ${u.pathname}`] ?? [404, { ok: false, error: "Not Found" }];
    return new Response(JSON.stringify(hit[1]), { status: hit[0], headers: { "Content-Type": "application/json" } });
  };
  return { calls, fetchImpl, writes: () => calls.filter((c) => c.method !== "GET") };
}

async function connect(token: string | null, routes: Record<string, [number, unknown]> = {}) {
  const api = fakeApi(routes);
  const server = createServer({ apiUrl: API, adminToken: token }, api.fetchImpl);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: { type: string; text: string }[];
    };
    const text = r.content[0]?.text ?? "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* an error message */
    }
    return { isError: !!r.isError, text, json: parsed as Record<string, any> };
  };
  return { client, call, api };
}

const adminRoutes = (extra: Record<string, [number, unknown]> = {}) => ({
  "GET /api/admin/posts/hello": [200, { ok: true, post: POST }] as [number, unknown],
  "PUT /api/admin/posts/hello": [200, { ok: true, post: { ...POST, status: "published" } }] as [number, unknown],
  "DELETE /api/admin/posts/hello": [200, { ok: true }] as [number, unknown],
  "GET /api/admin/collections": [200, { ok: true, items: [AREA] }] as [number, unknown],
  "PUT /api/admin/collections/tools": [200, { ok: true, collection: AREA }] as [number, unknown],
  "DELETE /api/admin/collections/tools": [200, { ok: true }] as [number, unknown],
  ...extra,
});

describe("configuration", () => {
  it("requires PORTFOLIO_API_URL and has no default", () => {
    expect(() => loadConfig({})).toThrow(/PORTFOLIO_API_URL is required/);
    expect(() => loadConfig({ PORTFOLIO_API_URL: "not a url" })).toThrow(/not a URL/);
  });

  it("makes the token optional, and will not send it over plain http to a remote host", () => {
    expect(loadConfig({ PORTFOLIO_API_URL: "http://localhost:8080/" })).toEqual({
      apiUrl: "http://localhost:8080",
      adminToken: null,
    });
    expect(() => loadConfig({ PORTFOLIO_API_URL: "http://example.com", PORTFOLIO_ADMIN_TOKEN: TOKEN })).toThrow(/plain http/);
    expect(loadConfig({ PORTFOLIO_API_URL: "https://example.com", PORTFOLIO_ADMIN_TOKEN: TOKEN }).adminToken).toBe(TOKEN);
  });
});

describe("tool registration", () => {
  it("registers only the public read tools without a token", async () => {
    const { client } = await connect(null);
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...PUBLIC_TOOLS].sort());
  });

  it("adds the admin tools with a token, and every write defaults to a dry run", async () => {
    const { client } = await connect(TOKEN);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...PUBLIC_TOOLS, ...ADMIN_TOOLS, ...STDIO_TOOLS].sort());
    for (const name of ["save_post_draft", "publish_post", "unpublish_post", "delete_post", "save_area", "delete_area"]) {
      const schema = tools.find((t) => t.name === name)!.inputSchema as { properties: Record<string, { default?: unknown }> };
      expect(schema.properties.dryRun.default, name).toBe(true);
    }
    for (const name of ["delete_post", "delete_area"]) {
      expect(tools.find((t) => t.name === name)!.annotations?.destructiveHint).toBe(true);
    }
  });

  it("sends the token only on admin calls", async () => {
    const { call, api } = await connect(TOKEN, { "GET /api/blog/posts": [200, { ok: true, items: [] }], ...adminRoutes() });
    await call("list_posts", { area: "tools" });
    await call("admin_get_post", { slug: "hello" });
    expect(api.calls[0]).toMatchObject({ path: "/api/blog/posts?collection=tools", auth: null });
    expect(api.calls[1]).toMatchObject({ path: "/api/admin/posts/hello", auth: `Bearer ${TOKEN}` });
  });
});

describe("dry-run diffs", () => {
  it("publish_post shows the status change and writes nothing by default", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const r = await call("publish_post", { slug: "hello" });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({
      dryRun: true,
      action: "publish_post",
      target: "post:hello",
      changes: [{ field: "status", before: "draft", after: "published" }],
    });
    expect(api.writes()).toHaveLength(0);
  });

  it("applies with dryRun: false, sending the revision it read", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const r = await call("publish_post", { slug: "hello", dryRun: false });
    expect(r.json.dryRun).toBe(false);
    const [w] = api.writes();
    expect(w).toMatchObject({ method: "PUT", path: "/api/admin/posts/hello", body: { status: "published", _rev: "3-abc", title: "Hello" } });
  });

  it("save_post_draft diffs only what changed, a body as lines, and keeps the status", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const r = await call("save_post_draft", { slug: "hello", title: "Hello again", body: "line one\nline 2\nline three" });
    expect(r.json.changes).toEqual([
      { field: "title", before: "Hello", after: "Hello again" },
      { field: "body", lines: ["  line one", "- line two", "+ line 2", "  line three"] },
    ]);
    expect(api.writes()).toHaveLength(0);
  });

  it("creates a new post as a draft, and needs a title to do so", async () => {
    const { call } = await connect(TOKEN, adminRoutes());
    const missing = await call("save_post_draft", { slug: "fresh" });
    expect(missing.isError).toBe(true);
    const r = await call("save_post_draft", { slug: "fresh", title: "Fresh" });
    expect(r.json).toMatchObject({ dryRun: true, action: "create_post_draft", exists: false });
    expect(r.json.changes).toContainEqual({ field: "status", before: null, after: "draft" });
  });

  it("save_area diffs an update to an existing area", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const r = await call("save_area", { slug: "tools", tagline: "Small sharp things" });
    expect(r.json).toMatchObject({ action: "update_area", changes: [{ field: "tagline", before: "", after: "Small sharp things" }] });
    expect(api.writes()).toHaveLength(0);
  });
});

describe("deletes need confirm", () => {
  it("refuses delete_post without confirm: true and writes nothing", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const r = await call("delete_post", { slug: "hello", dryRun: false });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/confirm: true/);
    expect(api.writes()).toHaveLength(0);
  });

  it("previews by default, and deletes with confirm: true and dryRun: false", async () => {
    const { call, api } = await connect(TOKEN, adminRoutes());
    const preview = await call("delete_area", { slug: "tools", confirm: true });
    expect(preview.json).toMatchObject({ dryRun: true, changes: [{ field: "status", before: "published", after: "hidden" }] });
    expect(api.writes()).toHaveLength(0);

    await call("delete_area", { slug: "tools", confirm: true, dryRun: false });
    expect(api.writes()).toEqual([expect.objectContaining({ method: "DELETE", path: "/api/admin/collections/tools" })]);
  });
});

describe("auth refusals", () => {
  it("reports a 401 from the API as a token problem", async () => {
    const { call } = await connect(TOKEN, {
      "GET /api/admin/posts/hello": [401, { ok: false, error: "unauthenticated" }],
    });
    const r = await call("publish_post", { slug: "hello" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/refused the admin token \(401/);
  });

  it("reports a 403 from a read-scoped token on a write", async () => {
    const { call } = await connect(
      TOKEN,
      adminRoutes({ "PUT /api/admin/posts/hello": [403, { ok: false, error: "This token is read-only." }] }),
    );
    const r = await call("publish_post", { slug: "hello", dryRun: false });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/403: This token is read-only/);
  });
});

describe("lineDiff", () => {
  it("elides long unchanged runs", () => {
    const a = ["a", "b", "c", "d", "e", "f"].join("\n");
    const b = ["a", "b", "c", "d", "e", "F"].join("\n");
    expect(lineDiff(a, b)).toEqual(["  ...", "  e", "- f", "+ F"]);
  });
});

describe("media library tools", () => {
  const ITEM = {
    id: "windom-abc123",
    name: "windom.jpg",
    alt: "A clock over the aurora",
    caption: "",
    credit: "",
    width: 1600,
    height: 900,
    url: "https://yehudabriskman.com/api/images/media/windom-abc123",
    usedBy: [{ id: "collection:windom", type: "collection", slug: "windom", field: "coverImage" }],
  };
  const dir = mkdtempSync(join(tmpdir(), "mcp-media-"));
  const file = join(dir, "photo.png");
  writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));

  it("list_media is a read, and says what uses each picture", async () => {
    const { call, api } = await connect(TOKEN, { "GET /api/admin/media": [200, { ok: true, items: [ITEM] }] });
    const r = await call("list_media", { q: "windom" });
    expect(r.json).toEqual([
      expect.objectContaining({ id: "windom-abc123", url: ITEM.url, size: "1600x900", usedBy: ["collection:windom (coverImage)"] }),
    ]);
    expect(api.calls[0].path).toBe("/api/admin/media?q=windom");
    expect(api.writes()).toHaveLength(0);
  });

  it("upload_media is a dry run by default, and sends nothing", async () => {
    const { call, api } = await connect(TOKEN, { "GET /api/admin/media": [200, { ok: true, items: [] }] });
    const r = await call("upload_media", { path: file, alt: "A test" });
    expect(r.json).toMatchObject({ dryRun: true, file: "photo.png", type: "image/png", bytes: 11 });
    expect(api.writes()).toHaveLength(0);
  });

  it("upload_media with dryRun false sends the bytes with the token and the alt text", async () => {
    const { call, api } = await connect(TOKEN, {
      "GET /api/admin/media": [200, { ok: true, items: [] }],
      "POST /api/admin/media": [201, { ok: true, item: { ...ITEM, id: "photo-1a2b3c", name: "photo.png" } }],
    });
    const r = await call("upload_media", { path: file, alt: "A test", dryRun: false });
    expect(r.isError).toBe(false);
    expect(r.json.result).toMatchObject({ id: "photo-1a2b3c" });
    const [w] = api.writes();
    expect(w.auth).toBe(`Bearer ${TOKEN}`);
    expect(w.path).toMatch(/^\/api\/admin\/media\?alt=A\+test&filename=photo\.png&kind=image$/);
    expect(w.body).toBeInstanceOf(Uint8Array);
  });

  it("upload_media refuses what is not an image file, and needs alt text", async () => {
    const { call, api } = await connect(TOKEN);
    expect((await call("upload_media", { path: "/etc/passwd", alt: "x" })).text).toMatch(/must be \.jpg/);
    expect((await call("upload_media", { path: "photo.png", alt: "x" })).text).toMatch(/absolute/);
    expect((await call("upload_media", { path: file, alt: "" })).isError).toBe(true);
    expect(api.writes()).toHaveLength(0);
  });

  const video = join(dir, "clip.mp4");
  writeFileSync(video, Buffer.alloc(64));
  const captions = join(dir, "clip.vtt");
  writeFileSync(captions, "WEBVTT\n");

  it("list_media filters by kind and shows it", async () => {
    const { call, api } = await connect(TOKEN, {
      "GET /api/admin/media": [200, { ok: true, items: [{ ...ITEM, kind: "video", durationMs: 12_400 }] }],
    });
    const r = await call("list_media", { kind: "video" });
    expect(r.json[0]).toMatchObject({ kind: "video", seconds: 12 });
    expect(api.calls[0].path).toBe("/api/admin/media?kind=video");
  });

  it("upload_media: a video needs a poster, and posters are for videos only", async () => {
    const { call, api } = await connect(TOKEN, { "GET /api/admin/media": [200, { ok: true, items: [] }] });
    expect((await call("upload_media", { path: video, alt: "x", kind: "video" })).text).toMatch(/needs posterPath/);
    expect((await call("upload_media", { path: file, alt: "x", posterPath: file })).text).toMatch(/for a video/);
    expect((await call("upload_media", { path: video, alt: "x", kind: "image" })).text).toMatch(/must be \.jpg/);
    expect((await call("upload_media", { path: file, alt: "x", kind: "icon" })).isError).toBe(false);
    expect(api.writes()).toHaveLength(0);
  });

  it("upload_media sends a video, its poster and captions as one multipart form", async () => {
    const { call, api } = await connect(TOKEN, {
      "GET /api/admin/media": [200, { ok: true, items: [] }],
      "POST /api/admin/media": [201, { ok: true, item: { ...ITEM, id: "clip-1a2b3c", kind: "video" } }],
    });
    const r = await call("upload_media", {
      path: video,
      alt: "A clip",
      kind: "video",
      posterPath: file,
      captionsPath: captions,
      captionsLang: "he",
      dryRun: false,
    });
    expect(r.isError).toBe(false);
    expect(r.json.result).toMatchObject({ id: "clip-1a2b3c", kind: "video" });
    const [w] = api.writes();
    expect(w.path).toMatch(/kind=video/);
    expect(w.path).toMatch(/captionsLang=he/);
    expect(w.body).toBeInstanceOf(FormData);
    const form = w.body as FormData;
    expect([...form.keys()]).toEqual(["file", "poster", "captions"]);
  });
});

describe("translation tools (#307)", () => {
  const REPORT = {
    ok: true,
    counts: { missing: 1, stale: 1, draft: 0, unverified: 0, translated: 1 },
    coverage: 0.33,
    items: [
      {
        type: "post",
        id: "hello",
        title: "Hello",
        route: "/notes/hello",
        rank: 100,
        visibility: "public",
        status: "stale",
        units: [
          { path: "title", status: "translated", primary: true, en: "Hello", he: "שלום", draftHe: null },
          { path: "body", status: "stale", primary: true, en: "line one\nline 2\nline three", he: "שורה", draftHe: null },
          { path: "excerpt", status: "missing", primary: true, en: "e", he: null, draftHe: null },
        ],
      },
    ],
  };
  const STALE_POST = { ...POST, status: "published", body: "line one\nline 2\nline three", heMeta: { src: {}, bodyBase: POST.body } };
  const DRAFT_RESULT = {
    ok: true,
    dryRun: true,
    target: "post:hello",
    changes: [{ path: "excerpt", en: "e", before: null, after: "בGitHub" }],
    warnings: [{ path: "excerpt", rule: "prefix-glued", match: "בGitHub", use: "ב־GitHub" }],
  };
  const routes = () =>
    adminRoutes({
      "GET /api/admin/translations": [200, REPORT],
      "GET /api/admin/posts/hello": [200, { ok: true, post: STALE_POST }],
      "PUT /api/admin/translations/draft": [200, DRAFT_RESULT],
      "GET /api/admin/content/projects": [200, { ok: true, _rev: "7-p", published: {}, draft: null }],
      "GET /api/admin/translations/glossary": [200, { ok: true, glossary: { version: 1, terms: [] } }],
      "GET /api/blog/posts/hello": [
        200,
        { ok: true, post: { slug: "hello", title: "Hello", subtitle: null, excerpt: "e", body: "b", he: { title: "שלום", subtitle: "", excerpt: "", body: "" } } },
      ],
      "GET /api/blog/posts": [200, { ok: true, items: [{ slug: "hello", title: "Hello", excerpt: "e", he: null }] }],
    });

  it("list_translations passes the filters and lists units by path", async () => {
    const { call, api } = await connect(TOKEN, routes());
    const r = await call("list_translations", { status: ["missing", "stale"], type: ["post"] });
    expect(api.calls[0].path).toBe("/api/admin/translations?status=missing%2Cstale&type=post");
    expect(r.json.items[0]).toMatchObject({ id: "hello", status: "stale", units: ["title: translated", "body: stale", "excerpt: missing"] });
  });

  it("get_translation gives both languages, and the English body's diff since the Hebrew", async () => {
    const { call } = await connect(TOKEN, routes());
    const r = await call("get_translation", { type: "post", id: "hello" });
    expect(r.json.units[0]).toMatchObject({ path: "title", en: "Hello", he: "שלום" });
    expect(r.json.bodyDiff).toEqual(["  line one", "- line two", "+ line 2", "  line three"]);
    expect((await call("get_translation", { type: "post", id: "nope" })).isError).toBe(true);
  });

  it("put_translation is a dry run by default, with the revision it read and the glossary warnings", async () => {
    const { call, api } = await connect(TOKEN, routes());
    const r = await call("put_translation", { type: "post", id: "hello", units: { excerpt: "בGitHub" } });
    expect(r.json).toMatchObject({ dryRun: true, target: "post:hello", warnings: [{ rule: "prefix-glued" }] });
    expect(r.json.note).toMatch(/nothing was written/);
    expect(api.writes()[0]).toMatchObject({
      method: "PUT",
      path: "/api/admin/translations/draft",
      body: { type: "post", id: "hello", rev: "3-abc", units: [{ path: "excerpt", he: "בGitHub" }], dryRun: true },
    });
  });

  it("put_translation reads a content document's revision, and sends an area with no rev, noting it goes live", async () => {
    const { call, api } = await connect(TOKEN, routes());
    await call("put_translation", { type: "project", id: "windom", units: { fact: "עובדה" }, dryRun: false });
    expect(api.writes()[0].body).toMatchObject({ type: "project", rev: "7-p", dryRun: false });
    const area = await call("put_translation", { type: "area", id: "tools", units: { title: "כלים" } });
    expect(area.isError).toBeFalsy();
    expect(area.json.note).toMatch(/LIVE/);
    expect(api.writes()).toHaveLength(2);
    expect(api.writes()[1].body).toEqual({ type: "area", id: "tools", units: [{ path: "title", he: "כלים" }], dryRun: true });
  });

  it("serves the glossary as glossary://he, to admin sessions only", async () => {
    const { client } = await connect(TOKEN, routes());
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(["glossary://he"]);
    const read = await client.readResource({ uri: "glossary://he" });
    expect(JSON.parse((read.contents[0] as { text: string }).text)).toEqual({ version: 1, terms: [] });
    const pub = await connect(null, routes());
    await expect(pub.client.listResources()).rejects.toThrow();
  });

  it("get_post and list_posts read in Hebrew with lang: he, falling back to English per field", async () => {
    const { call } = await connect(null, routes());
    const one = await call("get_post", { slug: "hello", lang: "he" });
    expect(one.json.post).toMatchObject({ title: "שלום", excerpt: "e", body: "b", lang: "he", fallback: true, englishFields: ["excerpt", "body"] });
    expect(one.json.post.he).toBeUndefined();
    const en = await call("get_post", { slug: "hello" });
    expect(en.json.post.he.title).toBe("שלום");
    const list = await call("list_posts", { lang: "he" });
    expect(list.json.items[0]).toMatchObject({ title: "Hello", fallback: true });
  });
});
