import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { FetchLike } from "./api.js";
import { loadConfig } from "./config.js";
import { lineDiff } from "./diff.js";
import { ADMIN_TOOLS, PUBLIC_TOOLS, createServer } from "./server.js";

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
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
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
    expect(tools.map((t) => t.name).sort()).toEqual([...PUBLIC_TOOLS, ...ADMIN_TOOLS].sort());
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
