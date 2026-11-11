import { createHash, randomBytes } from "crypto";
import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { resetSweep } from "./oauth/provider.js";

/*
 * The remote MCP server and its OAuth 2.1 authorization server (#263), end
 * to end through the HTTP surface: registration, the browser sign-in with a
 * mocked GitHub, consent, the token endpoint, the MCP endpoint, and the tools
 * reaching the admin API in-process. CouchDB is an in-memory fake that keeps
 * CouchDB's revision rules (409 on a stale _rev), because rotation and
 * single-use codes are built on them.
 */

const SITE = "https://yehudabriskman.com";
const OWNER = { id: 4242, login: env.ADMIN_GITHUB_LOGIN };
const NOW = "2026-10-01T10:00:00.000Z";

/* ------------------------------------------------------------ the store -- */

let store: Map<string, Record<string, unknown>>;
let revs = 0;

function seed() {
  store = new Map();
  const put = (d: Record<string, unknown>) => store.set(d._id as string, { ...d, _rev: `1-${++revs}` });
  put({
    _id: "post:hello",
    type: "post",
    slug: "hello",
    title: "Hello",
    subtitle: null,
    excerpt: "e",
    body: "b",
    bodyFormat: "markdown",
    status: "draft",
    publishedAt: null,
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
  });
  put({
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
  });
}

function matches(doc: Record<string, unknown>, selector: Record<string, unknown>): boolean {
  return Object.entries(selector).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$in") return (arg as unknown[]).includes(v);
        if (op === "$eq") return v === arg;
        if (op === "$ne") return v !== arg;
        if (op === "$gt") return String(v) > String(arg);
        if (op === "$lt") return String(v) < String(arg);
        return false;
      });
    }
    return v === cond;
  });
}

function fakeCouch() {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  vi.spyOn(couch, "get").mockImplementation(async (id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "couch 404");
    return clone(d) as never;
  });
  vi.spyOn(couch, "put").mockImplementation(async (id: string, doc: unknown) => {
    const d = doc as Record<string, unknown>;
    const cur = store.get(id);
    if ((cur && cur._rev !== d._rev) || (!cur && d._rev)) throw new CouchError(409, "couch 409");
    const rev = `${++revs}-x`;
    store.set(id, { ...clone(d), _id: id, _rev: rev });
    return { ok: true, id, rev } as never;
  });
  vi.spyOn(couch, "append").mockImplementation(async (id: string, doc: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "couch 409");
    const { _rev: _ignored, ...fresh } = doc;
    store.set(id, { ...clone(fresh), _id: id, _rev: `${++revs}-x` });
    return { ok: true } as never;
  });
  vi.spyOn(couch, "del").mockImplementation(async (id: string, rev: string) => {
    const cur = store.get(id);
    if (!cur) throw new CouchError(404, "couch 404");
    if (cur._rev !== rev) throw new CouchError(409, "couch 409");
    store.delete(id);
    return { ok: true };
  });
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const { selector, limit } = q as { selector: Record<string, unknown>; limit?: number };
    return { docs: [...store.values()].filter((d) => matches(d, selector)).slice(0, limit ?? 25).map(clone) } as never;
  });
}

const byType = (type: string) => [...store.values()].filter((d) => d.type === type);

/* --------------------------------------------------------------- GitHub -- */

let githubUser = OWNER;
let githubCalls: { url: string; body?: string }[] = [];

function fakeGithub() {
  const real = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://github.com/login/oauth/access_token")) {
        githubCalls.push({ url, body: String(init?.body) });
        const body = new URLSearchParams(String(init?.body));
        if (body.get("code") !== "gh-code" || !body.get("code_verifier")) {
          return Response.json({ error: "bad_verification_code" });
        }
        return Response.json({ access_token: "gho_secret_github_token", token_type: "bearer" });
      }
      if (url.startsWith("https://api.github.com/user")) {
        githubCalls.push({ url });
        return Response.json(githubUser);
      }
      return real(input, init);
    }),
  );
}

/* ---------------------------------------------------------------- setup -- */

const saved = { remote: env.MCP_REMOTE, id: env.MCP_GITHUB_CLIENT_ID, secret: env.MCP_GITHUB_CLIENT_SECRET, ghId: env.ADMIN_GITHUB_ID };
let logged: unknown[] = [];

beforeEach(() => {
  env.MCP_REMOTE = "on";
  env.MCP_GITHUB_CLIENT_ID = "gh-client-id";
  env.MCP_GITHUB_CLIENT_SECRET = "gh-client-secret";
  env.ADMIN_GITHUB_ID = undefined;
  githubUser = OWNER;
  githubCalls = [];
  logged = [];
  resetSweep();
  seed();
  fakeCouch();
  fakeGithub();
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => {
      logged.push(args);
    }) as never);
  }
});

afterEach(() => {
  env.MCP_REMOTE = saved.remote;
  env.MCP_GITHUB_CLIENT_ID = saved.id;
  env.MCP_GITHUB_CLIENT_SECRET = saved.secret;
  env.ADMIN_GITHUB_ID = saved.ghId;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------- helpers -- */

const REDIRECT = "http://localhost:53682/callback";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function register(app: ReturnType<typeof createApp>, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/mcp/oauth/register")
    .send({ client_name: "Claude Code (test)", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", ...extra });
  expect(res.status).toBe(201);
  return res.body as { client_id: string; client_secret?: string };
}

const cookieFrom = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("mcp_txn="))!;

/** Register, sign in through (fake) GitHub, consent; returns the code and what it takes to spend it. */
async function signIn(app: ReturnType<typeof createApp>, opts: { write?: boolean; scope?: string; client?: { client_id: string } } = {}) {
  const client = opts.client ?? (await register(app));
  const { verifier, challenge } = pkce();
  const auth = await request(app).get("/mcp/oauth/authorize").query({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "client-state",
    scope: opts.scope ?? "mcp:read",
    resource: `${SITE}/mcp`,
  });
  expect(auth.status).toBe(302);
  const gh = new URL(auth.headers.location);
  expect(gh.origin + gh.pathname).toBe("https://github.com/login/oauth/authorize");
  expect(gh.searchParams.get("code_challenge_method")).toBe("S256");
  expect(gh.searchParams.get("redirect_uri")).toBe(`${SITE}/mcp/oauth/github/callback`);
  const cookie = cookieFrom(auth);

  const cb = await request(app)
    .get("/mcp/oauth/github/callback")
    .query({ code: "gh-code", state: gh.searchParams.get("state")! })
    .set("Cookie", cookie);
  if (cb.status !== 200) return { client, verifier, cookie, callback: cb, code: null as string | null };
  const txn = /name="txn" value="([^"]+)"/.exec(cb.text)![1];
  const csrf = /name="csrf" value="([^"]+)"/.exec(cb.text)![1];

  const form: Record<string, string> = { txn, csrf, decision: "approve" };
  if (opts.write) form.write = "on";
  const consent = await request(app).post("/mcp/oauth/consent").type("form").send(form).set("Cookie", cookie).set("Origin", SITE);
  expect(consent.status).toBe(200);
  const back = new URL(/content="0;url=([^"]+)"/.exec(consent.text)![1].replace(/&amp;/g, "&"));
  expect(back.origin + back.pathname).toBe(REDIRECT);
  expect(back.searchParams.get("state")).toBe("client-state");
  return { client, verifier, cookie, callback: cb, consentPage: cb.text, code: back.searchParams.get("code") };
}

async function exchange(app: ReturnType<typeof createApp>, code: string, clientId: string, verifier: string) {
  return request(app).post("/mcp/oauth/token").type("form").send({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: REDIRECT,
    resource: `${SITE}/mcp`,
  });
}

async function tokensFor(app: ReturnType<typeof createApp>, opts: { write?: boolean } = {}) {
  const s = await signIn(app, opts);
  const res = await exchange(app, s.code!, s.client.client_id, s.verifier);
  expect(res.status).toBe(200);
  return { ...(res.body as { access_token: string; refresh_token: string; scope: string; expires_in: number }), client: s.client };
}

let rpcId = 0;
function rpc(app: ReturnType<typeof createApp>, path: string, method: string, params: unknown, token?: string) {
  const req = request(app)
    .post(path)
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json");
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send({ jsonrpc: "2.0", id: ++rpcId, method, params });
}

const toolNames = async (app: ReturnType<typeof createApp>, path: string, token?: string) => {
  const res = await rpc(app, path, "tools/list", {}, token);
  expect(res.status).toBe(200);
  return (res.body.result.tools as { name: string }[]).map((t) => t.name).sort();
};

const PUBLIC = ["get_area", "get_post", "list_activity", "list_areas", "list_posts", "list_tags"];
const ADMIN_READ = ["admin_get_post", "admin_list_posts", "get_translation", "list_media", "list_translations", "read_audit_log"];

/* ---------------------------------------------------------------- tests -- */

describe("MCP_REMOTE switch", () => {
  it("off (the default): every MCP and OAuth path is a 404", async () => {
    env.MCP_REMOTE = "off";
    const app = createApp();
    for (const [method, path] of [
      ["get", "/mcp"],
      ["post", "/mcp"],
      ["post", "/mcp/public"],
      ["get", "/.well-known/oauth-protected-resource"],
      ["get", "/.well-known/oauth-protected-resource/mcp"],
      ["get", "/.well-known/oauth-authorization-server"],
      ["post", "/mcp/oauth/register"],
      ["get", "/mcp/oauth/authorize"],
      ["post", "/mcp/oauth/token"],
      ["get", "/mcp/oauth/github/callback"],
      ["post", "/mcp/oauth/consent"],
    ] as const) {
      const res = await request(app)[method](path);
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
    expect(store.size).toBe(2);
  });

  it("defaults to off", () => {
    expect(saved.remote).toBe("off");
  });
});

describe("discovery", () => {
  it("serves protected-resource metadata (RFC 9728) at both paths, CORS-open", async () => {
    const app = createApp();
    for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
      const res = await request(app).get(path).set("Origin", "http://localhost:6274");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.body).toMatchObject({
        resource: `${SITE}/mcp`,
        authorization_servers: [SITE],
        scopes_supported: ["mcp:read", "mcp:write"],
      });
    }
  });

  it("serves authorization-server metadata (RFC 8414): S256 only, DCR, revocation", async () => {
    const res = await request(createApp()).get("/.well-known/oauth-authorization-server");
    expect(res.body).toMatchObject({
      issuer: SITE,
      authorization_endpoint: `${SITE}/mcp/oauth/authorize`,
      token_endpoint: `${SITE}/mcp/oauth/token`,
      registration_endpoint: `${SITE}/mcp/oauth/register`,
      revocation_endpoint: `${SITE}/mcp/oauth/revoke`,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    });
  });

  it("answers an unauthenticated /mcp with 401 and a resource_metadata pointer", async () => {
    const res = await rpc(createApp(), "/mcp", "tools/list", {});
    expect(res.status).toBe(401);
    const header = res.headers["www-authenticate"];
    expect(header).toMatch(/^Bearer /);
    expect(header).toContain(`resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`);
    expect(header).toContain('scope="mcp:read"');
  });

  it("CORS on authenticated endpoints: an arbitrary Origin gets no ACAO, the allowlist gets itself", async () => {
    const app = createApp();
    const evil = "https://evil.example";
    for (const res of [
      await rpc(app, "/mcp", "tools/list", {}).set("Origin", evil),
      await request(app).options("/mcp").set("Origin", evil).set("Access-Control-Request-Method", "POST"),
      await request(app).post("/mcp/oauth/token").set("Origin", evil).type("form").send({ grant_type: "refresh_token" }),
      await request(app).options("/mcp/oauth/token").set("Origin", evil).set("Access-Control-Request-Method", "POST"),
      await request(app).post("/mcp/oauth/register").set("Origin", evil).send({ client_name: "x", redirect_uris: [REDIRECT] }),
    ]) {
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    }
    const ok = await rpc(app, "/mcp", "tools/list", {}).set("Origin", "https://claude.ai");
    expect(ok.status).toBe(401);
    expect(ok.headers["access-control-allow-origin"]).toBe("https://claude.ai");
    expect(ok.headers["access-control-allow-credentials"]).toBeUndefined();
    const tok = await request(app).post("/mcp/oauth/token").set("Origin", "https://claude.com").type("form").send({ grant_type: "refresh_token" });
    expect(tok.headers["access-control-allow-origin"]).toBe("https://claude.com");
  });

  it("CORS on the public, read-only endpoints is `*`, without credentials", async () => {
    const app = createApp();
    const res = await rpc(app, "/mcp/public", "tools/list", {}).set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    const pre = await request(app).options("/.well-known/oauth-authorization-server").set("Origin", "https://x.example");
    expect(pre.status).toBe(204);
    expect(pre.headers["access-control-allow-origin"]).toBe("*");
  });

  it("sends a browser on /mcp to the page that explains it", async () => {
    const res = await request(createApp()).get("/mcp").set("Accept", "text/html,application/xhtml+xml");
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/developers/mcp");
  });
});

describe("public tools, no sign-in", () => {
  it("/mcp/public lists the six public tools and nothing else", async () => {
    expect(await toolNames(createApp(), "/mcp/public")).toEqual(PUBLIC);
  });

  it("calls one through the API in-process", async () => {
    const res = await rpc(createApp(), "/mcp/public", "tools/call", { name: "list_areas", arguments: {} });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBeFalsy();
    expect(res.body.result.content[0].text).toContain('"site"');
  });

  it("a draft is not visible to the public tools", async () => {
    const res = await rpc(createApp(), "/mcp/public", "tools/call", { name: "get_post", arguments: { slug: "hello" } });
    expect(res.body.result.isError).toBe(true);
  });
});

describe("dynamic client registration (RFC 7591)", () => {
  it.each([
    ["a custom scheme", "myapp://callback"],
    ["plain http to a real host", "http://example.com/callback"],
    ["javascript:", "javascript:alert(1)"],
    ["a fragment", "https://example.com/cb#x"],
  ])("refuses %s", async (_label, uri) => {
    const res = await request(createApp()).post("/mcp/oauth/register").send({ client_name: "x", redirect_uris: [uri] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_client_metadata");
    expect(byType("mcpclient")).toHaveLength(0);
  });

  it("accepts loopback on any port and https", async () => {
    const app = createApp();
    await register(app, { redirect_uris: ["http://127.0.0.1:9999/cb", "https://claude.ai/api/mcp/auth_callback"] });
  });

  it("stores a confidential client's secret hashed, and checks it", async () => {
    const app = createApp();
    const c = await register(app, { token_endpoint_auth_method: "client_secret_post" });
    expect(c.client_secret).toBeTruthy();
    expect(JSON.stringify([...store.values()])).not.toContain(c.client_secret!);
    const bad = await request(app).post("/mcp/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: "x", client_id: c.client_id, client_secret: "wrong" });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe("invalid_client");
  });

  it("is rate-limited", async () => {
    const app = createApp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await request(app).post("/mcp/oauth/register").send({ client_name: "x", redirect_uris: [REDIRECT] });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("expires a client that never completed a sign-in", async () => {
    const app = createApp();
    const c = await register(app);
    const doc = store.get(`mcpclient:${c.client_id}`)!;
    store.set(doc._id as string, { ...doc, createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString() });
    const res = await request(app).get("/mcp/oauth/authorize").query({
      response_type: "code", client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: pkce().challenge, code_challenge_method: "S256",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_client");
  });
});

describe("the sign-in", () => {
  it("issues tokens for the owner: 1 hour access, a refresh token, the scope chosen", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    expect(t.access_token).toMatch(/^mat_[0-9a-f]{16}_/);
    expect(t.refresh_token).toMatch(/^mrt_[0-9a-f]{16}_/);
    expect(t.expires_in).toBe(3600);
    expect(t.scope).toBe("mcp:read");
    // Hashed at rest: no token, code or GitHub token is in the store.
    const dump = JSON.stringify([...store.values()]);
    for (const secret of [t.access_token, t.refresh_token, "gho_secret_github_token"]) expect(dump).not.toContain(secret);
    // GitHub was asked with PKCE, and its token never reached a log.
    expect(githubCalls[0].body).toContain("code_verifier=");
    const logs = JSON.stringify(logged);
    for (const secret of [t.access_token, t.refresh_token, "gho_secret_github_token", "gh-code"]) expect(logs).not.toContain(secret);
  });

  it("refuses anyone but the owner: a page, and no token", async () => {
    githubUser = { id: 999, login: "someone-else" };
    const app = createApp();
    const s = await signIn(app);
    expect(s.callback.status).toBe(403);
    expect(s.callback.text).toContain("Not authorized");
    expect(s.callback.text).toContain("@someone-else");
    expect(byType("mcptxn")).toHaveLength(0);
    expect(byType("mcpcode")).toHaveLength(0);
    expect(byType("mcpgrant")).toHaveLength(0);
  });

  it("holds the owner to the numeric id recorded on first sign-in", async () => {
    const app = createApp();
    await tokensFor(app);
    expect(store.get("mcpowner")).toMatchObject({ githubId: OWNER.id });
    // The login changed hands: same name, another account.
    githubUser = { id: 777, login: OWNER.login };
    const s = await signIn(app);
    expect(s.callback.status).toBe(403);
  });

  it("holds the owner to ADMIN_GITHUB_ID when it is set", async () => {
    env.ADMIN_GITHUB_ID = "1";
    const s = await signIn(createApp());
    expect(s.callback.status).toBe(403);
    expect(store.has("mcpowner")).toBe(false);
  });

  it("refuses a callback whose state is not this browser's", async () => {
    const app = createApp();
    const c = await register(app);
    const auth = await request(app).get("/mcp/oauth/authorize").query({
      response_type: "code", client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: pkce().challenge, code_challenge_method: "S256",
    });
    const cb = await request(app).get("/mcp/oauth/github/callback").query({ code: "gh-code", state: "forged" }).set("Cookie", cookieFrom(auth));
    expect(cb.status).toBe(400);
    const noCookie = await request(app).get("/mcp/oauth/github/callback").query({ code: "gh-code", state: "x" });
    expect(noCookie.status).toBe(400);
    expect(githubCalls).toHaveLength(0);
  });

  it("consent is CSRF-safe: cookie, one-time token and Origin all checked", async () => {
    const app = createApp();
    const c = await register(app);
    const { challenge } = pkce();
    const auth = await request(app).get("/mcp/oauth/authorize").query({
      response_type: "code", client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256",
      scope: "mcp:read mcp:write",
    });
    const cookie = cookieFrom(auth);
    const state = new URL(auth.headers.location).searchParams.get("state")!;
    const cb = await request(app).get("/mcp/oauth/github/callback").query({ code: "gh-code", state }).set("Cookie", cookie);
    // mcp:write is never pre-checked, even though this client asked for it.
    expect(cb.text).toMatch(/<input type="checkbox" name="write" value="on">/);
    expect(cb.text).not.toMatch(/name="write"[^>]*checked/);
    expect(cb.headers["content-security-policy"]).toMatch(/default-src 'none'.*form-action 'self'.*frame-ancestors 'none'/);
    const txn = /name="txn" value="([^"]+)"/.exec(cb.text)![1];
    const csrf = /name="csrf" value="([^"]+)"/.exec(cb.text)![1];
    const post = (form: Record<string, string>, cookieHeader?: string, origin = SITE) => {
      const r = request(app).post("/mcp/oauth/consent").type("form").set("Origin", origin);
      if (cookieHeader) r.set("Cookie", cookieHeader);
      return r.send(form);
    };
    expect((await post({ txn, csrf, decision: "approve" })).status).toBe(403); // no cookie
    expect((await post({ txn, csrf: "wrong", decision: "approve" }, cookie)).status).toBe(403);
    expect((await post({ txn, csrf, decision: "approve" }, cookie, "https://evil.example")).status).toBe(403);
    expect(byType("mcpcode")).toHaveLength(0);
    const ok = await post({ txn, csrf, decision: "approve" }, cookie);
    expect(ok.status).toBe(200);
    // Spent: the same form again is refused.
    expect((await post({ txn, csrf, decision: "approve" }, cookie)).status).toBe(400);
  });

  it("deny sends access_denied back and issues nothing", async () => {
    const app = createApp();
    const c = await register(app);
    const auth = await request(app).get("/mcp/oauth/authorize").query({
      response_type: "code", client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: pkce().challenge, code_challenge_method: "S256", state: "s1",
    });
    const cookie = cookieFrom(auth);
    const cb = await request(app).get("/mcp/oauth/github/callback").query({ code: "gh-code", state: new URL(auth.headers.location).searchParams.get("state")! }).set("Cookie", cookie);
    const txn = /name="txn" value="([^"]+)"/.exec(cb.text)![1];
    const csrf = /name="csrf" value="([^"]+)"/.exec(cb.text)![1];
    const res = await request(app).post("/mcp/oauth/consent").type("form").set("Cookie", cookie).send({ txn, csrf, decision: "deny" });
    expect(res.text).toContain("error=access_denied");
    expect(byType("mcpcode")).toHaveLength(0);
  });
});

describe("PKCE", () => {
  it("is required, and S256 only", async () => {
    const app = createApp();
    const c = await register(app);
    const base = { response_type: "code", client_id: c.client_id, redirect_uri: REDIRECT, state: "s" };
    for (const q of [base, { ...base, code_challenge: "abc", code_challenge_method: "plain" }]) {
      const res = await request(app).get("/mcp/oauth/authorize").query(q);
      expect(res.status).toBe(302);
      expect(new URL(res.headers.location).searchParams.get("error")).toBe("invalid_request");
    }
    expect(byType("mcptxn")).toHaveLength(0);
  });

  it("a wrong code_verifier gets nothing, and the code is single-use", async () => {
    const app = createApp();
    const s = await signIn(app);
    const wrong = await exchange(app, s.code!, s.client.client_id, pkce().verifier);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe("invalid_grant");
    const right = await exchange(app, s.code!, s.client.client_id, s.verifier);
    expect(right.status).toBe(200);
    // Second use of the same code: refused, and what the first issued is revoked.
    const again = await exchange(app, s.code!, s.client.client_id, s.verifier);
    expect(again.status).toBe(400);
    expect((await rpc(app, "/mcp", "tools/list", {}, right.body.access_token)).status).toBe(401);
  });
});

describe("a code replayed while the first exchange is still writing its grant", () => {
  it("leaves no live grant", async () => {
    const app = createApp();
    const s = await signIn(app);
    const append = vi.mocked(couch.append);
    const real = append.getMockImplementation()!;
    let replay: request.Response | undefined;
    append.mockImplementation(async (id: string, doc: Record<string, unknown>) => {
      if (id.startsWith("mcpgrant:") && !replay) {
        // The code is spent but the grant is not written yet: a second exchange lands here.
        replay = await exchange(app, s.code!, s.client.client_id, s.verifier);
      }
      return real(id, doc);
    });
    const first = await exchange(app, s.code!, s.client.client_id, s.verifier);
    expect(replay?.status).toBe(400);
    expect(first.status).toBe(400);
    expect(byType("mcpgrant")[0]).toMatchObject({ revokedReason: "authorization code reused" });
  });
});

describe("malformed percent-encoding", () => {
  it("in a Basic client id or secret is a 401, not a 500", async () => {
    const app = createApp();
    const basic = Buffer.from("%zz:%zz").toString("base64");
    const res = await request(app).post("/mcp/oauth/token").set("Authorization", `Basic ${basic}`).type("form").send({ grant_type: "refresh_token", refresh_token: "x" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_client");
  });

  it("in the sign-in cookie is a client error, not a 500", async () => {
    const app = createApp();
    const res = await request(app).get("/mcp/oauth/github/callback").set("Cookie", "mcp_txn=%zz").query({ code: "gh-code", state: "s" });
    expect(res.status).toBeLessThan(500);
  });
});

describe("refresh tokens", () => {
  it("rotate, and a reused one revokes the whole grant", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const refresh = (token: string) =>
      request(app).post("/mcp/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: token, client_id: t.client.client_id });

    const r1 = await refresh(t.refresh_token);
    expect(r1.status).toBe(200);
    expect(r1.body.refresh_token).not.toBe(t.refresh_token);
    expect((await rpc(app, "/mcp", "tools/list", {}, r1.body.access_token)).status).toBe(200);

    // The old refresh token again: somebody else has it.
    const reuse = await refresh(t.refresh_token);
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe("invalid_grant");
    expect(byType("mcpgrant")[0]).toMatchObject({ revokedReason: "refresh token reused" });
    expect((await rpc(app, "/mcp", "tools/list", {}, r1.body.access_token)).status).toBe(401);
    expect((await refresh(r1.body.refresh_token)).status).toBe(400);
  });

  it("cannot widen the scope", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const res = await request(app).post("/mcp/oauth/token").type("form").send({
      grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: t.client.client_id, scope: "mcp:read mcp:write",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_scope");
  });
});

describe("scopes on /mcp", () => {
  it("mcp:read: public tools and admin reads, no writes", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    expect(await toolNames(app, "/mcp", t.access_token)).toEqual([...PUBLIC, ...ADMIN_READ].sort());
    const draft = await rpc(app, "/mcp", "tools/call", { name: "admin_get_post", arguments: { slug: "hello" } }, t.access_token);
    expect(draft.body.result.isError).toBeFalsy();
    expect(draft.body.result.content[0].text).toContain('"status": "draft"');
    const write = await rpc(app, "/mcp", "tools/call", { name: "publish_post", arguments: { slug: "hello", dryRun: false } }, t.access_token);
    expect(JSON.stringify(write.body)).toMatch(/not found|Tool publish_post/i);
    expect(store.get("post:hello")!.status).toBe("draft");
  });

  it("mcp:write: dry run by default, then a real write audited as mcp-oauth with the client's name", async () => {
    const app = createApp();
    const t = await tokensFor(app, { write: true });
    expect(t.scope).toBe("mcp:read mcp:write");
    const names = await toolNames(app, "/mcp", t.access_token);
    expect(names).toContain("publish_post");
    expect(names).toContain("delete_post");

    const dry = await rpc(app, "/mcp", "tools/call", { name: "publish_post", arguments: { slug: "hello" } }, t.access_token);
    expect(JSON.parse(dry.body.result.content[0].text)).toMatchObject({ dryRun: true });
    expect(store.get("post:hello")!.status).toBe("draft");

    const del = await rpc(app, "/mcp", "tools/call", { name: "delete_post", arguments: { slug: "hello", dryRun: false } }, t.access_token);
    expect(del.body.result.isError).toBe(true);
    expect(del.body.result.content[0].text).toContain("confirm: true");

    const real = await rpc(app, "/mcp", "tools/call", { name: "publish_post", arguments: { slug: "hello", dryRun: false } }, t.access_token);
    expect(real.body.result.isError).toBeFalsy();
    expect(store.get("post:hello")!.status).toBe("published");
    await vi.waitFor(() => expect(byType("audit")).toHaveLength(1));
    expect(byType("audit")[0]).toMatchObject({
      method: "PUT",
      path: "/api/admin/posts/hello",
      status: 200,
      actor: { via: "mcp-oauth", client: "Claude Code (test)", login: OWNER.login },
    });
  });

  it("refuses a token bound to another resource (RFC 8707 audience)", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const grant = byType("mcpgrant")[0];
    store.set(grant._id as string, { ...grant, resource: "https://elsewhere.example/mcp" });
    const res = await rpc(app, "/mcp", "tools/list", {}, t.access_token);
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("invalid_token");
  });

  it("refuses an expired access token", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const grant = byType("mcpgrant")[0] as { _id: string; access: { hash: string; expiresAt: string }[] };
    store.set(grant._id, { ...grant, access: grant.access.map((a) => ({ ...a, expiresAt: new Date(Date.now() - 1000).toISOString() })) });
    expect((await rpc(app, "/mcp", "tools/list", {}, t.access_token)).status).toBe(401);
  });

  it("an mcp ticket that is unknown is a 401 on the admin API, never a fall-through", async () => {
    const res = await request(createApp()).get("/api/admin/me").set("X-Mcp-Ticket", "forged");
    expect(res.status).toBe(401);
  });
});

describe("revocation", () => {
  const asAdmin = (r: request.Test) =>
    r.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

  it("Connected apps lists the grant without secrets, and revoke cuts it off", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const list = await asAdmin(request(app).get("/api/admin/mcp/grants"));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ client: "Claude Code (test)", scopes: ["mcp:read"], status: "active" });
    expect(JSON.stringify(list.body)).not.toMatch(/hash|mat_|mrt_/);

    const id = list.body.items[0].id;
    const del = await asAdmin(request(app).delete(`/api/admin/mcp/grants/${id}`));
    expect(del.body.item.status).toBe("revoked");
    expect((await rpc(app, "/mcp", "tools/list", {}, t.access_token)).status).toBe(401);
  });

  it("an OAuth token cannot reach Connected apps", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const res = await request(app).get("/api/admin/mcp/grants").set("Authorization", `Bearer ${t.access_token}`);
    expect(res.status).toBe(401);
  });

  it("the client can revoke its own token (RFC 7009)", async () => {
    const app = createApp();
    const t = await tokensFor(app);
    const res = await request(app).post("/mcp/oauth/revoke").type("form").send({ token: t.refresh_token, client_id: t.client.client_id });
    expect(res.status).toBe(200);
    expect((await rpc(app, "/mcp", "tools/list", {}, t.access_token)).status).toBe(401);
  });
});
