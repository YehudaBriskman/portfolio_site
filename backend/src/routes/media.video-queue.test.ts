import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { env } from "../env.js";
import { mediaStore } from "../services/media.js";

/* A video is held in memory several times over while it is read and stored, so one is handled at a time. */

const asAdmin = (req: request.Test) =>
  req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

afterEach(() => vi.restoreAllMocks());

describe("video uploads", () => {
  it("are read and stored one at a time, without holding up pictures", async () => {
    vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
    let release!: () => void;
    const held = new Promise<void>((ok) => (release = ok));
    const kinds: string[] = [];
    vi.spyOn(mediaStore, "save").mockImplementation(async (doc) => {
      kinds.push(doc.kind);
      if (doc.kind === "video") await held;
      return { ...doc, _rev: "1-new" };
    });
    const poster = await sharp({ create: { width: 64, height: 36, channels: 3, background: "#345" } }).jpeg().toBuffer();
    const app = createApp();
    const video = () =>
      asAdmin(request(app).post("/api/admin/media?alt=Clip&filename=clip.mp4&kind=video"))
        .attach("file", readFileSync(resolve(__dirname, "fixtures", "tiny.mp4")), "clip.mp4")
        .attach("poster", poster, "poster.jpg")
        .then((r) => r.status);

    const first = video();
    await vi.waitFor(() => expect(kinds).toEqual(["video"]), { timeout: 10_000 });
    const second = video();
    const picture = await asAdmin(request(app).post("/api/admin/media?alt=Still&filename=still.jpg"))
      .set("Content-Type", "image/jpeg")
      .send(poster);
    expect(picture.status).toBe(201);
    await new Promise((ok) => setTimeout(ok, 500));
    expect(kinds).toEqual(["video", "image"]);

    release();
    expect(await Promise.all([first, second])).toEqual([201, 201]);
    expect(kinds).toEqual(["video", "image", "video"]);
  }, 30_000);
});
