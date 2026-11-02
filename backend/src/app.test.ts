// src/app.test.ts
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";
import { createApp } from "./app";
import { couch } from "./db/couch";

describe("backend API", () => {
  it("GET /health → 200 { ok:true, version } and nothing else", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    // No BUILD_SHA in the test environment, so the build reads as `dev`. The
    // exact shape is asserted so a field added later is a decision, not a leak.
    expect(res.body).toEqual({ ok: true, version: "dev" });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  describe("GET /health/ready", () => {
    afterEach(() => vi.restoreAllMocks());

    it("→ 200 when the store answers, with the build it is running", async () => {
      vi.spyOn(couch, "reachable").mockResolvedValue(true);
      const res = await request(createApp()).get("/health/ready");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, db: "up", version: "dev" });
    });

    it("→ 503 when the store does not, so a rollout onto a dead store fails", async () => {
      vi.spyOn(couch, "reachable").mockResolvedValue(false);
      const res = await request(createApp()).get("/health/ready");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ ok: false, db: "down", version: "dev" });
    });

    it("leaves liveness alone when the store is down", async () => {
      const spy = vi.spyOn(couch, "reachable").mockResolvedValue(false);
      const res = await request(createApp()).get("/health");
      expect(res.status).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("is not reachable under /api, which is all nginx forwards", async () => {
    const res = await request(createApp()).get("/api/health/ready");
    expect(res.status).toBe(404);
  });

  it("allows the site's own origins and refuses everyone else", async () => {
    const app = createApp();

    const ours = await request(app).get("/health").set("Origin", "https://yehudabriskman.com");
    expect(ours.headers["access-control-allow-origin"]).toBe("https://yehudabriskman.com");

    // /api/email relays real SMTP; a wildcard let any page drive it from a
    // visitor's browser.
    const theirs = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(theirs.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not advertise the server framework", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("unknown route → 404 JSON", async () => {
    const app = createApp();
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "Not Found" });
  });

  it("GET /api/images/:name returns 404 with router-specific message when missing", async () => {
    const app = createApp();
    const res = await request(app).get("/api/images/missing.png");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "Image not found" });
  });

  it("GET /api/images/:name returns file content when exists (tmp dir, valid image ext)", async () => {
    const png1x1 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOF2+dcAAAAASUVORK5CYII=";

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
    const fileName = "hello.png";
    const filePath = path.join(tmp, fileName);
    fs.writeFileSync(filePath, Buffer.from(png1x1, "base64"));

    const prev = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmp;
    const app = createApp();

    const res = await request(app).get(`/api/images/${fileName}`);
    expect(res.status).toBe(200);
    // לפחות בודקים שהוא באמת מחזיר בינארי
    expect(res.headers["content-type"]).toMatch(/image\/png/);
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(0);

    process.env.UPLOADS_DIR = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
