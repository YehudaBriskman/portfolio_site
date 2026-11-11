import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import seoRouter from "./seo.route.js";
import { CouchError, couch } from "../db/couch.js";

const RELEASES = {
  _id: "site-releases",
  _rev: "1-a",
  type: "site-releases",
  repo: { owner: "YehudaBriskman", name: "portfolio_site" },
  items: [{ tag: "v1.4.3", name: "v1.4.3", url: "https://github.com/x/y/releases/tag/v1.4.3", publishedAt: "2026-11-10T09:00:00.000Z" }],
  fetchedAt: "2026-11-11T00:00:00.000Z",
  error: null,
};
const POST = { type: "post", status: "published", slug: "a-note", title: "A note", collection: "site", readingMinutes: 3 };

function dims(png: Buffer) {
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
}
// The router alone, not createApp(): the cards need no auth, media or MCP wiring.
const createApp = () => express().use("/api/seo", seoRouter);
const get = (path: string) =>
  request(createApp()).get(path).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });

beforeEach(() => {
  vi.spyOn(couch, "find").mockImplementation((async (q: { selector: { slug?: string } }) => ({
    docs: q.selector.slug === "a-note" ? [POST] : [],
  })) as never);
  vi.spyOn(couch, "get").mockImplementation(async (id: string) => {
    if (id === "site-releases") return RELEASES as never;
    throw new CouchError(404, "missing");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/seo/og/:kind/:file", () => {
  it("serves the original 1200x630 card by default, with the same cache headers", async () => {
    const res = await get("/api/seo/og/blog/a-note.png");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, s-maxage=86400");
    expect(dims(res.body)).toEqual({ w: 1200, h: 630 });
    const explicit = await get("/api/seo/og/blog/a-note.png?format=og");
    expect(explicit.body.equals(res.body)).toBe(true);
  });

  it.each([
    ["square", 1080, 1080],
    ["story", 1080, 1920],
  ])("serves the %s format", async (format, w, h) => {
    const res = await get(`/api/seo/og/blog/a-note.png?format=${format}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, s-maxage=86400");
    expect(dims(res.body)).toEqual({ w, h });
  });

  it("answers an unknown format with 400, before any lookup", async () => {
    for (const q of ["format=wide", "format=", "format=SQUARE", "format[]=og"]) {
      const res = await request(createApp()).get(`/api/seo/og/blog/a-note.png?${q}`);
      expect(res.status).toBe(400);
    }
    expect(couch.find).not.toHaveBeenCalled();
  });

  it("answers an unknown lang with 400 and keeps English the default", async () => {
    expect((await request(createApp()).get("/api/seo/og/blog/a-note.png?lang=fr")).status).toBe(400);
    const en = await get("/api/seo/og/blog/a-note.png");
    const explicit = await get("/api/seo/og/blog/a-note.png?lang=en");
    expect(explicit.body.equals(en.body)).toBe(true);
  });

  it("draws ?lang=he as a Hebrew card in every format, from the Hebrew title", async () => {
    vi.mocked(couch.find).mockImplementation((async () => ({
      docs: [{ ...POST, he: { title: "הערה עם כותרת בעברית", subtitle: "", excerpt: "", body: "" } }],
    })) as never);
    const en = await get("/api/seo/og/blog/a-note.png");
    for (const [format, w, h] of [["og", 1200, 630], ["square", 1080, 1080], ["story", 1080, 1920]] as const) {
      const he = await get(`/api/seo/og/blog/a-note.png?lang=he&format=${format}`);
      expect(he.status).toBe(200);
      expect(he.headers["content-type"]).toBe("image/png");
      expect(dims(he.body)).toEqual({ w, h });
      expect(he.body.equals((await get(`/api/seo/og/blog/a-note.png?format=${format}`)).body)).toBe(false);
    }
    expect(en.body.equals((await get("/api/seo/og/blog/a-note.png?lang=he")).body)).toBe(false);
  });

  it("renders a Hebrew card for a note with no translation, and for a release", async () => {
    expect((await get("/api/seo/og/blog/a-note.png?lang=he")).status).toBe(200);
    expect((await get("/api/seo/og/release/v1.4.3.png?lang=he&format=story")).status).toBe(200);
  });

  it("404s an unknown kind, an unknown slug and a malformed file", async () => {
    for (const p of ["/api/seo/og/video/a-note.png", "/api/seo/og/blog/nope.png", "/api/seo/og/blog/..%2Fx.png", "/api/seo/og/blog/.hidden.png"]) {
      expect((await request(createApp()).get(p)).status).toBe(404);
    }
  });

  describe("release", () => {
    it("renders a stored release in every format", async () => {
      for (const [format, w, h] of [["og", 1200, 630], ["square", 1080, 1080], ["story", 1080, 1920]] as const) {
        const res = await get(`/api/seo/og/release/v1.4.3.png?format=${format}`);
        expect(res.status).toBe(200);
        expect(dims(res.body)).toEqual({ w, h });
      }
      expect((await get("/api/seo/og/release/v1.4.3")).status).toBe(200);
    });

    it("404s a tag that was never stored, and when nothing is stored", async () => {
      expect((await request(createApp()).get("/api/seo/og/release/v9.9.9.png")).status).toBe(404);
      vi.mocked(couch.get).mockRejectedValue(new CouchError(404, "missing"));
      expect((await request(createApp()).get("/api/seo/og/release/v1.4.3.png")).status).toBe(404);
    });
  });
});
