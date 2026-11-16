import request from "supertest";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { env } from "../env.js";
import { PUBLIC_TOOLS } from "../mcp/shared/tools.js";
import { mediaStore, type MediaDoc } from "../services/media.js";
import { migrateVisibility, publicContentBlobs, resetPublicContentCache } from "../services/media-visibility.js";

/*
 * Media have a draft state (#876). A new upload is private; an item is
 * public when the owner says so, when the field is absent (an old item), or
 * when a PUBLISHED page names it, resolved at read time. A visitor asking for
 * a draft gets the exact 404 of a file that does not exist.
 */

const H = "a".repeat(16);
const T = "2026-11-01T00:00:00.000Z";
const BASE: MediaDoc = {
  _id: "media:pic-abc123",
  _rev: "1-x",
  type: "media",
  id: "pic-abc123",
  name: "pic.jpg",
  alt: "A hill",
  caption: "",
  credit: "",
  kind: "image",
  format: "jpeg",
  width: 800,
  height: 600,
  bytes: 1000,
  hash: "0".repeat(16),
  original: "original.jpg",
  variants: [{ width: 400, format: "webp", bytes: 10, hash: H, name: "w400.webp" }],
  createdAt: T,
  updatedAt: T,
  createdBy: "owner",
};
const FILE = `/api/images/m/pic-abc123/w400-${H}.webp`;
const STABLE = "/api/images/media/pic-abc123";
const META = "/api/images/media/pic-abc123/meta";
const SURFACES = [STABLE, META, FILE];
const USES = `${env.SITE_URL}/api/images/media/pic-abc123`;

const asAdmin = (req: request.Test) =>
  req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

const post = (extra: Record<string, unknown>) => ({
  _id: "post:p", type: "post", slug: "p", status: "published", collection: "site", coverImage: USES, ...extra,
});
const area = (slug: string, status: string, extra: Record<string, unknown> = {}) => ({
  _id: `collection:${slug}`, type: "collection", slug, status, ...extra,
});

let stored: MediaDoc | null;
let content: Record<string, unknown>[];

beforeEach(() => {
  resetPublicContentCache();
  stored = { ...BASE, visibility: "draft" };
  content = [];
  vi.spyOn(mediaStore, "get").mockImplementation(async (id) => (stored && id === stored.id ? stored : null));
  vi.spyOn(mediaStore, "file").mockResolvedValue({ data: Buffer.from("RIFFxxxxWEBP"), contentType: "image/webp" });
  vi.spyOn(mediaStore, "list").mockImplementation(async () => (stored ? [stored] : []));
  vi.spyOn(mediaStore, "referrers").mockResolvedValue([]);
  vi.spyOn(couch, "find").mockImplementation((async () => ({ docs: content })) as never);
  vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
});
afterEach(() => vi.restoreAllMocks());

const statuses = async (headers: Record<string, string> = {}) => {
  const app = createApp();
  const out: number[] = [];
  for (const url of SURFACES) {
    let r = request(app).get(url);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    out.push((await r).status);
  }
  return out;
};

describe("the visibility matrix, per public surface", () => {
  it("a draft nobody uses is a 404 on the redirect, the meta and the file", async () => {
    expect(await statuses()).toEqual([404, 404, 404]);
  });

  it("explicit public and an absent field both serve", async () => {
    stored = { ...BASE, visibility: "public" };
    expect(await statuses()).toEqual([302, 200, 200]);
    stored = { ...BASE }; // an old item: no field
    expect(await statuses()).toEqual([302, 200, 200]);
  });

  it("the signed-in admin sees a draft, and it is never cached", async () => {
    const h = { "X-Admin-Proxy-Secret": env.ADMIN_PROXY_SECRET, "X-Auth-Request-User": env.ADMIN_GITHUB_LOGIN };
    expect(await statuses(h)).toEqual([302, 200, 200]);
    const file = await asAdmin(request(createApp()).get(FILE));
    expect(file.headers["cache-control"]).toBe("private, no-store");
  });

  it("a wrong secret, a wrong user, or a bearer token is not a session", async () => {
    expect(await statuses({ "X-Admin-Proxy-Secret": "nope", "X-Auth-Request-User": env.ADMIN_GITHUB_LOGIN })).toEqual([404, 404, 404]);
    expect(await statuses({ "X-Admin-Proxy-Secret": env.ADMIN_PROXY_SECRET, "X-Auth-Request-User": "someone-else" })).toEqual([404, 404, 404]);
    expect(await statuses({ Authorization: "Bearer ptk_whatever" })).toEqual([404, 404, 404]);
  });

  it("a published post, area, project or site copy that names it makes it servable", async () => {
    for (const doc of [
      post({}),
      area("a", "published", { coverImage: USES }),
      { _id: "content:projects", type: "content", key: "projects", published: { items: [{ image: USES }] }, draft: null },
      { _id: "content:site-copy", type: "content", key: "site-copy", published: { x: `![](/api/images/m/pic-abc123/w400-${H}.webp)` }, draft: null },
    ]) {
      resetPublicContentCache();
      content = [doc];
      expect(await statuses(), String(doc._id)).toEqual([302, 200, 200]);
    }
  });

  it("an unpublished note, a note's unpublished edit, a hidden area's note and a content draft do not", async () => {
    for (const docs of [
      [post({ status: "draft" })],
      [post({ coverImage: null, draft: { coverImage: USES } })],
      [area("secret", "hidden"), post({ collection: "secret" })],
      [area("a", "hidden", { coverImage: USES })],
      [{ _id: "content:projects", type: "content", key: "projects", published: { items: [] }, draft: { items: [{ image: USES }] } }],
      [post({ coverImage: `${env.SITE_URL}/api/images/media/pic-abc123-other` })],
    ]) {
      resetPublicContentCache();
      content = docs;
      expect(await statuses(), JSON.stringify(docs)).toEqual([404, 404, 404]);
    }
  });

  it("unpublishing takes it back with nothing written", async () => {
    content = [post({})];
    expect(await statuses()).toEqual([302, 200, 200]);
    resetPublicContentCache();
    content = [post({ status: "draft" })];
    expect(await statuses()).toEqual([404, 404, 404]);
    expect(stored?.visibility).toBe("draft");
  });

  it("publicContentBlobs keeps only what the public reads", () => {
    const blobs = publicContentBlobs([
      post({}),
      post({ _id: "post:d", status: "draft", coverImage: "/draft-only" }),
      { _id: "content:story", type: "content", published: { a: 1 }, draft: { b: "/draft-only" } },
    ]);
    expect(blobs).toHaveLength(2);
    expect(blobs.join("")).not.toContain("draft-only");
  });
});

describe("no existence oracle", () => {
  it("a draft answers exactly as a file that is not there", async () => {
    const app = createApp();
    const draftFile = `/api/images/m/pic-abc123/w400-${H}.webp`;
    const missingFile = `/api/images/m/gone-abc123/w400-${H}.webp`;
    for (const [a, b] of [
      [draftFile, missingFile],
      [STABLE, "/api/images/media/gone-abc123"],
      [META, "/api/images/media/gone-abc123/meta"],
    ]) {
      const x = await request(app).get(a);
      const y = await request(app).get(b);
      expect(x.status, a).toBe(404);
      expect(x.status).toBe(y.status);
      expect(x.text).toBe(y.text);
      const strip = (h: Record<string, unknown>) => ({ ...h, date: undefined, "x-request-id": undefined, etag: undefined, ratelimit: undefined });
      expect(strip(x.headers)).toEqual(strip(y.headers));
    }
  });
});

describe("public lists never carry media", () => {
  it("the public MCP tools have no media tool, and the media list is admin-only", async () => {
    expect(PUBLIC_TOOLS as readonly string[]).not.toContain("list_media");
    expect((await request(createApp()).get("/api/admin/media")).status).toBe(401);
  });
});

describe("the admin API sees all, with the state", () => {
  it("lists drafts with visibility and whether they are live", async () => {
    const res = await asAdmin(request(createApp()).get("/api/admin/media"));
    expect(res.body.items[0]).toMatchObject({ id: "pic-abc123", visibility: "draft", live: false });
    content = [post({})];
    resetPublicContentCache();
    const live = await asAdmin(request(createApp()).get("/api/admin/media/pic-abc123"));
    expect(live.body.item).toMatchObject({ visibility: "draft", live: true });
  });

  it("an old item with no field reads as public", async () => {
    stored = { ...BASE };
    const res = await asAdmin(request(createApp()).get("/api/admin/media"));
    expect(res.body.items[0]).toMatchObject({ visibility: "public", live: true });
  });

  it("a new upload starts as a draft; a replaced file keeps its state", async () => {
    const save = vi.spyOn(mediaStore, "save").mockImplementation(async (doc) => ({ ...doc, _rev: "1-new" }));
    const png = await sharp({ create: { width: 500, height: 300, channels: 4, background: "#08f" } }).png().toBuffer();
    const up = await asAdmin(request(createApp()).post("/api/admin/media?alt=A&filename=a.png")).set("Content-Type", "image/png").send(png);
    expect(up.status).toBe(201);
    expect(up.body.item).toMatchObject({ visibility: "draft", live: false });
    expect(save.mock.calls[0][0].visibility).toBe("draft");
    stored = { ...BASE, visibility: "public" };
    await asAdmin(request(createApp()).put("/api/admin/media/pic-abc123/file?rev=1-x")).set("Content-Type", "image/png").send(png);
    expect(save.mock.calls[1][0].visibility).toBe("public");
    stored = { ...BASE }; // old item, replaced: still public
    await asAdmin(request(createApp()).put("/api/admin/media/pic-abc123/file?rev=1-x")).set("Content-Type", "image/png").send(png);
    expect(save.mock.calls[2][0].visibility).toBe("public");
  });

  it("the owner toggles it, and an edit that says nothing about it keeps it", async () => {
    const meta = vi.spyOn(mediaStore, "saveMeta").mockImplementation(async (doc) => ({ ...doc, _rev: "2-y" }));
    const body = { alt: "A hill", caption: "", credit: "", _rev: "1-x" };
    const on = await asAdmin(request(createApp()).put("/api/admin/media/pic-abc123")).send({ ...body, visibility: "public" });
    expect(on.body.item).toMatchObject({ visibility: "public", live: true });
    expect(meta.mock.calls[0][0].visibility).toBe("public");
    const keep = await asAdmin(request(createApp()).put("/api/admin/media/pic-abc123")).send(body);
    expect(keep.body.item.visibility).toBe("draft");
    const bad = await asAdmin(request(createApp()).put("/api/admin/media/pic-abc123")).send({ ...body, visibility: "secret" });
    expect(bad.status).toBe(400);
  });
});

describe("the migration", () => {
  it("stamps public where the field is absent, and only there", () => {
    expect(migrateVisibility({ ...BASE })).toMatchObject({ visibility: "public", id: "pic-abc123" });
    expect(migrateVisibility({ ...BASE, visibility: "draft" })).toBeNull();
    expect(migrateVisibility({ ...BASE, visibility: "public" })).toBeNull();
    expect(migrateVisibility({ _id: "post:x", type: "post" })).toBeNull();
  });

  it("is idempotent: a second pass changes nothing", () => {
    const once = migrateVisibility({ ...BASE })!;
    expect(migrateVisibility(once)).toBeNull();
  });
});
