import fs from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_SETTINGS, HOME_SECTIONS, SiteSettingsSchema, type SiteSettings } from "../schemas/site-settings.js";
import { resetShellCache } from "../services/seo.js";
import type { SettingsDoc } from "../services/site-settings.js";

/*
 * The site's settings (#254): safe defaults, the public read, the editing
 * API with its ledger rule, history and revert, and the crawler renders
 * honouring visibility and the visual metas.
 *
 * CouchDB is an in-memory map, as in content.route.test.ts: a PUT without
 * the current revision of an existing document is 409, a missing one 404.
 */

let store: Map<string, unknown>;
let revs = 0;

beforeEach(() => {
  store = new Map();
  vi.spyOn(couch, "get").mockImplementation(async <T>(id: string) => {
    const doc = store.get(id);
    if (!doc) throw new CouchError(404, "couch 404");
    return structuredClone(doc) as T;
  });
  vi.spyOn(couch, "put").mockImplementation(async <T>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const existing = store.get(id) as { _rev?: string } | undefined;
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

const defaults = (): SiteSettings => structuredClone(DEFAULT_SETTINGS);

function withOrder(ids: string[], hidden: string[] = []): SiteSettings {
  const s = defaults();
  s.home.sections = ids.map((id) => ({ id, visible: !hidden.includes(id) })) as SiteSettings["home"]["sections"];
  return s;
}

describe("the defaults", () => {
  it("are the site as built: every section in the old order, System, motion on, the one accent", () => {
    expect(DEFAULT_SETTINGS.home.sections.map((s) => s.id)).toEqual(["work", "approach", "city", "notes", "stack", "contact"]);
    expect(DEFAULT_SETTINGS.home.sections.every((s) => s.visible)).toBe(true);
    expect(DEFAULT_SETTINGS.visuals).toEqual({ theme: "system", motion: "on", accent: "ink" });
    expect(SiteSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});

describe("GET /api/settings", () => {
  it("serves the defaults when the store has nothing, cached for a minute", async () => {
    const res = await request(createApp()).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.body).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
  });

  it("serves the defaults over a document that no longer parses", async () => {
    store.set("settings:site", { _id: "settings:site", _rev: "1-a", type: "settings", version: 3, settings: { home: "broken" }, updatedAt: "x", history: [] });
    const res = await request(createApp()).get("/api/settings");
    expect(res.body.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("answers an error, not the defaults, when the store is down, so nothing caches a guess", async () => {
    vi.mocked(couch.get).mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await request(createApp()).get("/api/settings");
    expect(res.status).toBe(500);
  });
});

describe("/api/admin/settings", () => {
  it("is behind the admin gate", async () => {
    expect((await request(createApp()).get("/api/admin/settings")).status).toBe(401);
    expect((await request(createApp()).put("/api/admin/settings").send({ settings: defaults() })).status).toBe(401);
  });

  it("saves, keeps the history, and reverts as a new version", async () => {
    const app = createApp();
    const first = await asAdmin(request(app).get("/api/admin/settings"));
    expect(first.body).toMatchObject({ exists: false, version: 0, _rev: null, settings: DEFAULT_SETTINGS, history: [] });

    const hidden = withOrder(["approach", "work", "notes", "city", "stack", "contact"], ["stack"]);
    hidden.visuals = { theme: "dark", motion: "paused", accent: "pine" };
    const saved = await asAdmin(request(app).put("/api/admin/settings")).send({ settings: hidden });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(1);
    expect(saved.body.history.map((h: { version: number }) => h.version)).toEqual([0]);
    expect(saved.body.history[0].settings).toEqual(DEFAULT_SETTINGS);
    expect((await request(app).get("/api/settings")).body.settings).toEqual(hidden);

    const reverted = await asAdmin(request(app).post("/api/admin/settings/revert")).send({ version: 0, _rev: saved.body._rev });
    expect(reverted.status).toBe(200);
    expect(reverted.body.version).toBe(2);
    expect(reverted.body.settings).toEqual(DEFAULT_SETTINGS);
    expect(reverted.body.history.map((h: { version: number }) => h.version)).toEqual([1, 0]);
    expect((store.get("settings:site") as SettingsDoc).history[0].settings).toEqual(hidden);
  });

  it("refuses a stale revision with 409", async () => {
    const app = createApp();
    const a = await asAdmin(request(app).put("/api/admin/settings")).send({ settings: defaults() });
    await asAdmin(request(app).put("/api/admin/settings")).send({ settings: defaults(), _rev: a.body._rev });
    const stale = await asAdmin(request(app).put("/api/admin/settings")).send({ settings: defaults(), _rev: a.body._rev });
    expect(stale.status).toBe(409);
  });

  it("refuses the two dark acts side by side, which the ledger forbids", async () => {
    const bad = withOrder(["approach", "work", "city", "notes", "stack", "contact"]);
    const res = await asAdmin(request(createApp()).put("/api/admin/settings")).send({ settings: bad });
    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual([{ path: "home.sections.2", message: "settings.ledger.darkAdjacent" }]);
    expect(store.size).toBe(0);
  });

  it("judges adjacency among the shown sections only", async () => {
    /* Hiding Approach between them makes them adjacent on the page. */
    const bad = withOrder(["work", "approach", "city", "notes", "stack", "contact"], ["approach"]);
    expect((await asAdmin(request(createApp()).put("/api/admin/settings")).send({ settings: bad })).status).toBe(400);
    /* Hiding one of the two makes the order legal. */
    const ok = withOrder(["work", "city", "approach", "notes", "stack", "contact"], ["city"]);
    expect((await asAdmin(request(createApp()).put("/api/admin/settings")).send({ settings: ok })).status).toBe(200);
  });

  it("refuses a missing or repeated section, a free colour, and unknown fields", async () => {
    const app = createApp();
    const put = (settings: unknown) => asAdmin(request(app).put("/api/admin/settings")).send({ settings });
    const dup = withOrder(["work", "approach", "work", "notes", "stack", "contact"]);
    expect((await put(dup)).body.issues.map((i: { message: string }) => i.message)).toContain("settings.sections.duplicate");
    const short = withOrder(["work", "approach"]);
    expect((await put(short)).body.issues.map((i: { message: string }) => i.message)).toContain("settings.sections.missing");
    expect((await put({ ...defaults(), visuals: { ...defaults().visuals, accent: "#ff00ff" } })).status).toBe(400);
    expect((await put({ ...defaults(), css: "body{}" })).status).toBe(400);
    expect((await put({ ...defaults(), home: { sections: [{ id: "hero", visible: false }] } })).status).toBe(400);
    expect(store.size).toBe(0);
  });

  it("answers 404 for a version the history does not hold", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/settings/revert")).send({ version: 7 });
    expect(res.status).toBe(404);
  });
});

describe("the crawler renders read the settings", () => {
  const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

  beforeEach(() => {
    resetShellCache();
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

  const save = async (s: SiteSettings) => {
    const rev = (store.get("settings:site") as SettingsDoc | undefined)?._rev;
    const res = await asAdmin(request(createApp()).put("/api/admin/settings")).send({ settings: s, _rev: rev });
    expect(res.status).toBe(200);
  };
  const bodyOf = (html: string) => html.slice(html.indexOf("</head>"));

  it("renders today's home page with nothing stored, and with the store down", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(bodyOf(res.text)).toContain("<h2>How I work</h2>");
    expect(res.text).toContain('<meta name="site-theme-default" content="system" />');
    expect(res.text).toContain('<meta name="site-accent" content="ink" />');
    vi.mocked(couch.get).mockRejectedValue(new Error("ECONNREFUSED"));
    const down = await request(createApp()).get("/api/seo/render/home");
    expect(down.status).toBe(200);
    expect(bodyOf(down.text)).toContain("<h2>How I work</h2>");
  });

  it("serves no copy from a hidden section, and the shown ones in the owner's order", async () => {
    await save(withOrder(["contact", "work", "stack", "approach", "city", "notes"], ["approach", "notes"]));
    const body = bodyOf((await request(createApp()).get("/api/seo/render/home")).text);
    expect(body).not.toContain("<h2>How I work</h2>");
    expect(body).not.toContain('href="/blog"');
    expect(body).toContain('href="/projects"');
    expect(body.indexOf("Based in")).toBeGreaterThan(-1);
    expect(body.indexOf("Based in")).toBeLessThan(body.indexOf("<h2>Elsewhere</h2>"));

    await save(withOrder([...HOME_SECTIONS], ["contact"]));
    const again = bodyOf((await request(createApp()).get("/api/seo/render/home")).text);
    expect(again).not.toContain("Based in");
    expect(again).toContain("<h2>How I work</h2>");
  });

  it("writes the visual settings into the head of every render", async () => {
    const s = defaults();
    s.visuals = { theme: "dark", motion: "paused", accent: "plum" };
    await save(s);
    for (const url of ["/api/seo/render/home", "/api/seo/render/story", "/api/seo/render/blog"]) {
      const res = await request(createApp()).get(url);
      expect(res.text).toContain('<meta name="site-theme-default" content="dark" />');
      expect(res.text).toContain('<meta name="site-motion-default" content="paused" />');
      expect(res.text).toContain('<meta name="site-accent" content="plum" />');
      expect(res.text.match(/name="site-accent"/g)).toHaveLength(1);
    }
  });
});
