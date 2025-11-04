// src/app.test.ts
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";
import { createApp } from "./app";

describe("backend API", () => {
  it("GET /health → 200 { ok:true }", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("CORS headers exist", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("unknown route → 404 JSON", async () => {
    const app = createApp();
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
  });

  it("GET /api/images/:name returns 404 with router-specific message when missing", async () => {
    const app = createApp();
    const res = await request(app).get("/api/images/missing.png");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Image not found" });
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
