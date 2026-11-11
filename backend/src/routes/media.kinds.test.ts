import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { env } from "../env.js";
import { ICON_MAX_BYTES, isMonochrome, processIcon, sanitizeSvg } from "../services/mediaImage.js";
import { mediaStore, type MediaDoc } from "../services/media.js";
import { checkCaptions, inspectVideo, sniffVideo, VIDEO_MAX_BYTES } from "../services/mediaVideo.js";
import { parseRange } from "../controllers/media.controller.js";

/*
 * The library's three kinds (#253): icons are sanitised SVG or small PNG and
 * served as they are, under a CSP of their own; videos are MP4 (H.264/AAC)
 * or WebM (VP9|AV1/Opus), checked by their bytes, measured, cleaned of
 * location and device metadata, given an owner-made poster, and served with
 * Range.
 *
 * The two fixtures are real encoder output (ffmpeg 8, 160x90, 2 s), made
 * with a GPS `location` tag and a title so the cleaning has something to do:
 *   tiny.mp4   libx264 + aac, -movflags +faststart+use_metadata_tags
 *   tiny.webm  libvpx-vp9 + libopus
 */

const fixture = (name: string) => readFileSync(resolve(__dirname, "fixtures", name));
const asAdmin = (req: request.Test) =>
  req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const poster = () => sharp({ create: { width: 640, height: 360, channels: 3, background: "#345" } }).jpeg().toBuffer();
const GPS = "31.7767";

/** A copy with every occurrence of `from` replaced by `to` (same length). */
function patched(buf: Buffer, from: string, to: string) {
  const out = Buffer.from(buf);
  let at = out.indexOf(from, 0, "latin1");
  if (at === -1) throw new Error(`fixture has no ${from}`);
  while (at !== -1) {
    out.write(to, at, "latin1");
    at = out.indexOf(from, at + 1, "latin1");
  }
  return out;
}

let saved: Array<{ doc: MediaDoc; files: Array<{ name: string; contentType: string; data: Buffer }> }>;
beforeEach(() => {
  saved = [];
  vi.spyOn(couch, "append").mockResolvedValue({ ok: true });
  vi.spyOn(mediaStore, "referrers").mockResolvedValue([]);
  vi.spyOn(mediaStore, "save").mockImplementation(async (doc, files) => {
    saved.push({ doc, files });
    return { ...doc, _rev: "1-new" };
  });
});
afterEach(() => vi.restoreAllMocks());

/* ---------------------------------------------------------------- video -- */

describe("a video", () => {
  it("is recognised by its bytes, not its name", () => {
    expect(sniffVideo(fixture("tiny.mp4"))).toBe("mp4");
    expect(sniffVideo(fixture("tiny.webm"))).toBe("webm");
    expect(sniffVideo(Buffer.from("not a video at all"))).toBeNull();
    // A QuickTime .mov and an AVIF picture share the ftyp box; neither is a video here.
    expect(sniffVideo(patched(fixture("tiny.mp4"), "isom", "qt  "))).toBeNull();
  });

  it.each(["tiny.mp4", "tiny.webm"])("%s: measured, and its location and title are gone", (name) => {
    const buf = fixture(name);
    const before = buf.length;
    expect(buf.toString("latin1")).toContain(GPS);
    const info = inspectVideo(buf);
    expect(info).toMatchObject({ width: 160, height: 90, hasAudio: true });
    expect(info.durationMs).toBeGreaterThan(1900);
    expect(info.durationMs).toBeLessThan(2100);
    expect(info.codecs).toEqual(name.endsWith("mp4") ? ["avc1", "mp4a"] : ["V_VP9", "A_OPUS"]);
    const text = buf.toString("latin1");
    expect(text).not.toContain(GPS);
    expect(text).not.toContain("Holiday at home");
    // Cleaned in place: not one byte moved, so every sample offset still holds.
    expect(buf.length).toBe(before);
  });

  it("a truncated mvhd is a 422, not a RangeError", () => {
    const buf = fixture("tiny.mp4");
    const at = buf.indexOf("mvhd", 0, "latin1") - 4;
    // Cut the file inside the mvhd box and shrink the box (and its moov) to match.
    const cut = Buffer.from(buf.subarray(0, at + 8 + 6));
    cut.writeUInt32BE(14, at);
    const moov = cut.indexOf("moov", 0, "latin1") - 4;
    cut.writeUInt32BE(cut.length - moov, moov);
    expect(() => inspectVideo(cut)).toThrow(expect.objectContaining({ status: 422 }));
  });

  it("refuses a codec off the list", () => {
    expect(() => inspectVideo(patched(fixture("tiny.mp4"), "avc1", "hvc1"))).toThrow(/must be H\.264/);
    expect(() => inspectVideo(patched(fixture("tiny.webm"), "V_VP9", "V_VP8"))).toThrow(/VP9 or AV1/);
  });

  it("refuses a track that is neither picture nor sound (where a phone keeps its GPS trace)", () => {
    expect(() => inspectVideo(patched(fixture("tiny.mp4"), "soun", "meta"))).toThrow(/"meta" track/);
  });

  it("refuses one over a minute, or over the size cap", () => {
    const long = fixture("tiny.mp4");
    // mvhd version 0: duration is the u32 after the timescale. Make it 61 s.
    const mvhd = long.indexOf("mvhd", 0, "latin1") + 4;
    const timescale = long.readUInt32BE(mvhd + 12);
    long.writeUInt32BE(timescale * 61, mvhd + 16);
    expect(() => inspectVideo(long)).toThrow(/limited to 60 seconds/);
    expect(() => inspectVideo(Buffer.concat([fixture("tiny.mp4"), Buffer.alloc(VIDEO_MAX_BYTES)]))).toThrow(/limited to 25 MB/);
  });

  it("refuses a box that runs past the end (truncated or crafted)", () => {
    const cut = fixture("tiny.mp4").subarray(0, 900);
    expect(() => inspectVideo(Buffer.from(cut))).toThrow(/could not be read/);
  });

  it("captions must be WebVTT text", () => {
    expect(checkCaptions(Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n")).toString()).toMatch(/^WEBVTT/);
    expect(() => checkCaptions(Buffer.from("1\n00:00:00,000 --> 00:00:01,000\nSRT\n"))).toThrow(/WebVTT/);
  });
});

describe("uploading a video", () => {
  const app = createApp();
  const send = (parts: { file?: Buffer; poster?: Buffer; captions?: Buffer }, kind = "video") => {
    let r = asAdmin(request(app).post(`/api/admin/media?kind=${kind}&alt=${encodeURIComponent("A test card")}&filename=clip.mp4`));
    if (parts.file) r = r.attach("file", parts.file, "clip.mp4");
    if (parts.poster) r = r.attach("poster", parts.poster, "poster.jpg");
    if (parts.captions) r = r.attach("captions", parts.captions, "clip.vtt");
    return r;
  };

  it("stores the cleaned video, the poster's sizes and the captions", async () => {
    const res = await send({
      file: fixture("tiny.mp4"),
      poster: await poster(),
      captions: Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nA tone\n"),
    });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ kind: "video", format: "mp4", mime: "video/mp4", width: 160, height: 90 });
    expect(res.body.item.file).toMatch(/^\/api\/images\/m\/clip-[0-9a-f]{6}\/video-[0-9a-f]{16}\.mp4$/);
    expect(res.body.item.captions).toMatchObject({ lang: "en", label: "Captions" });
    const { files } = saved[0];
    const video = files.find((f) => f.name === "video.mp4")!;
    expect(video.data.toString("latin1")).not.toContain(GPS);
    expect(files.filter((f) => /^w\d+\.(avif|webp)$/.test(f.name)).length).toBeGreaterThan(0);
    expect(files.find((f) => f.name === "captions.vtt")?.contentType).toMatch(/^text\/vtt/);
  });

  it("needs a poster: there is no ffmpeg in the image to make one", async () => {
    const res = await send({ file: fixture("tiny.webm") });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/needs a poster/);
  });

  it("an SVG is not a poster", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>');
    expect((await send({ file: fixture("tiny.webm"), poster: svg })).status).toBe(415);
  });

  it("video bytes sent as an image are refused, whatever they are called", async () => {
    const res = await asAdmin(request(app).post("/api/admin/media?alt=x&filename=photo.jpg"))
      .set("Content-Type", "image/jpeg")
      .send(fixture("tiny.mp4"));
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/This is a video/);
  });

  it("a video sent raw rather than as a form is refused with what to do", async () => {
    const res = await asAdmin(request(app).post("/api/admin/media?kind=video&alt=x"))
      .set("Content-Type", "video/mp4")
      .send(fixture("tiny.mp4"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/multipart\/form-data/);
  });
});

/* ---------------------------------------------------------------- icons -- */

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M2 2h20v20H2z" fill="#111"/><circle cx="12" cy="12" r="4" fill="#111"/></svg>`;

describe("an icon", () => {
  it("a plain SVG is stored as its checked tree, and one ink makes it monochrome", async () => {
    const p = await processIcon(Buffer.from(ICON));
    expect(p).toMatchObject({ kind: "icon", format: "svg", width: 24, height: 24, monochrome: true, variants: [] });
    const checked = sanitizeSvg(ICON);
    expect(checked.ok && p.original.data.toString()).toBe(checked.ok && checked.svg);
    expect(isMonochrome(ICON.replace('fill="#111"/><circle', 'fill="#e33"/><circle'))).toBe(false);
    const NS = 'xmlns="http://www.w3.org/2000/svg"';
    expect(isMonochrome(`<svg ${NS}><linearGradient id="g"/><path d="M0 0" fill="url(#g)"/></svg>`)).toBe(false);
    // No fill at all paints black: still one ink.
    expect(isMonochrome(`<svg ${NS}><path d="M0 0"/><path d="M1 1" fill="#000"/></svg>`)).toBe(true);
  });

  it.each([
    ["a script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "script"],
    ["a SCRIPT in capitals", '<svg xmlns="http://www.w3.org/2000/svg"><SCRIPT>alert(1)</SCRIPT></svg>', "script"],
    ["an event attribute", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0"/></svg>', "onload"],
    ["foreignObject", '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>', "foreignobject"],
    ["an external reference", '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/></svg>', "#fragment"],
    ["a style attribute", '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://x)" d="M0 0"/></svg>', "style"],
  ])("refuses %s", async (_what, svg, why) => {
    // The refusal names what the parser found, whatever its case in the file.
    const err = await processIcon(Buffer.from(svg)).then(() => null, (e: { status: number; message: string }) => e);
    expect(err?.status).toBe(415);
    expect(err?.message.toLowerCase()).toContain(why);
  });

  it("is small: 64 KB, and a PNG no more than 1024 px on a side", async () => {
    const big = Buffer.from(ICON.replace("<path", `<desc>${"x".repeat(ICON_MAX_BYTES)}</desc><path`));
    await expect(processIcon(big)).rejects.toMatchObject({ status: 413 });
    const wide = await sharp({ create: { width: 1100, height: 10, channels: 4, background: "#000" } }).png().toBuffer();
    await expect(processIcon(wide)).rejects.toMatchObject({ status: 413 });
    const ok = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#000" } }).png().toBuffer();
    await expect(processIcon(ok)).resolves.toMatchObject({ kind: "icon", format: "png" });
  });

  it("a JPEG is not an icon", async () => {
    const jpg = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(processIcon(jpg)).rejects.toMatchObject({ status: 415 });
  });

  it("is uploaded with kind=icon", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/media?kind=icon&alt=A%20square&filename=square.svg"))
      .set("Content-Type", "image/svg+xml")
      .send(Buffer.from(ICON));
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ kind: "icon", format: "svg", monochrome: true });
    expect(res.body.item.preview).toBe(res.body.item.file);
  });
});

/* -------------------------------------------------------------- serving -- */

const BASE: Omit<MediaDoc, "kind" | "format" | "hash" | "original" | "bytes"> = {
  _id: "media:x-abc123",
  _rev: "1-a",
  type: "media",
  id: "x-abc123",
  name: "x",
  alt: "x",
  caption: "",
  credit: "",
  width: 160,
  height: 90,
  variants: [{ width: 640, format: "webp", bytes: 10, hash: "c".repeat(16), name: "w640.webp" }],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  createdBy: "owner",
};
const H = "a".repeat(16);

describe("serving", () => {
  const app = createApp();

  it("an icon: image/svg+xml, nosniff, and a CSP that lets it load and run nothing", async () => {
    vi.spyOn(mediaStore, "get").mockResolvedValue({ ...BASE, kind: "icon", format: "svg", hash: H, original: "icon.svg", bytes: ICON.length, variants: [] });
    vi.spyOn(mediaStore, "file").mockResolvedValue({ data: Buffer.from(ICON), contentType: "image/svg+xml" });
    const res = await request(app).get(`/api/images/m/x-abc123/icon-${H}.svg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(res.headers["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toMatch(/immutable/);
    // The stable URL leads to it; a video URL for an icon is nothing.
    expect((await request(app).get("/api/images/media/x-abc123")).headers.location).toBe(`/api/images/m/x-abc123/icon-${H}.svg`);
    expect((await request(app).get(`/api/images/m/x-abc123/video-${H}.mp4`)).status).toBe(404);
  });

  it("a missing file or a store fault never carries the one-year cache headers", async () => {
    vi.spyOn(mediaStore, "get").mockResolvedValue({ ...BASE, kind: "icon", format: "svg", hash: H, original: "icon.svg", bytes: ICON.length, variants: [] });
    vi.spyOn(mediaStore, "file").mockResolvedValue(null);
    const miss = await request(app).get(`/api/images/m/x-abc123/icon-${H}.svg`);
    expect(miss.status).toBe(404);
    expect(miss.headers["cache-control"]).toBe("no-store");
    expect(miss.headers["content-type"]).toMatch(/json/);
    vi.spyOn(mediaStore, "file").mockRejectedValue(new Error("boom"));
    const fault = await request(app).get(`/api/images/m/x-abc123/icon-${H}.svg`);
    expect(fault.status).toBeGreaterThanOrEqual(500);
    expect(fault.headers["cache-control"] ?? "").not.toMatch(/immutable/);
  });

  describe("a video", () => {
    const bytes = fixture("tiny.mp4");
    beforeEach(() => {
      vi.spyOn(mediaStore, "get").mockResolvedValue({ ...BASE, kind: "video", format: "mp4", hash: H, original: "video.mp4", bytes: bytes.length });
      vi.spyOn(mediaStore, "range").mockImplementation(async (_id, _name, start, end) => Readable.from([bytes.subarray(start, end + 1)]));
    });
    const url = `/api/images/m/x-abc123/video-${H}.mp4`;

    it("answers a Range with 206 and exactly those bytes", async () => {
      const res = await request(app).get(url).set("Range", "bytes=100-199").buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toBe(`bytes 100-199/${bytes.length}`);
      expect(res.headers["content-length"]).toBe("100");
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.headers["content-type"]).toBe("video/mp4");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBe("default-src 'none'; media-src 'self'; style-src 'unsafe-inline'");
      expect(res.headers["cache-control"]).toMatch(/max-age=31536000, immutable/);
      expect(Buffer.compare(res.body as Buffer, bytes.subarray(100, 200))).toBe(0);
    });

    it("no Range: the whole file, 200; a Range past the end: 416", async () => {
      const all = await request(app).get(url);
      expect(all.status).toBe(200);
      expect(all.headers["content-length"]).toBe(String(bytes.length));
      const past = await request(app).get(url).set("Range", `bytes=${bytes.length}-`);
      expect(past.status).toBe(416);
      expect(past.headers["content-range"]).toBe(`bytes */${bytes.length}`);
      expect(past.headers["cache-control"]).not.toMatch(/immutable/);
    });

    it("the stable URL leads to the video, or with ?poster to its poster", async () => {
      expect((await request(app).get("/api/images/media/x-abc123")).headers.location).toBe(url);
      expect((await request(app).get("/api/images/media/x-abc123?poster")).headers.location).toBe(
        `/api/images/m/x-abc123/w640-${"c".repeat(16)}.webp`,
      );
    });
  });

  it("parses the Range forms a player sends", () => {
    expect(parseRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=0-1", 1000)).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-1,5-9", 1000)).toBeNull(); // several ranges: the whole file
    expect(parseRange(undefined, 1000)).toBeNull();
  });
});

describe("listing", () => {
  it("filters by kind", async () => {
    const docs: MediaDoc[] = [
      { ...BASE, id: "a-111111", kind: "image", format: "jpeg", hash: H, original: "original.jpg", bytes: 1 },
      { ...BASE, id: "b-222222", kind: "icon", format: "svg", hash: H, original: "icon.svg", bytes: 1, variants: [] },
    ];
    vi.spyOn(mediaStore, "list").mockResolvedValue(docs);
    const res = await asAdmin(request(createApp()).get("/api/admin/media?kind=icon"));
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual(["b-222222"]);
  });

  it.each([
    ["a repeated kind", "get", "/api/admin/media?kind=icon&kind=image"],
    ["a repeated q", "get", "/api/admin/media?q=a&q=b"],
    ["an unknown kind", "get", "/api/admin/media?kind=pdf"],
    ["a repeated upload kind", "post", "/api/admin/media?kind=icon&kind=video&alt=x"],
    ["a repeated alt", "post", "/api/admin/media?alt=x&alt=y"],
    ["a repeated rev", "put", "/api/admin/media/a-111111/file?rev=1&rev=2"],
  ] as const)("answers %s (an array, not a string) with 400", async (_what, method, url) => {
    vi.spyOn(mediaStore, "list").mockResolvedValue([]);
    vi.spyOn(mediaStore, "get").mockResolvedValue({ ...BASE, id: "a-111111", _rev: "1", kind: "image", format: "jpeg", hash: H, original: "original.jpg", bytes: 1 } as MediaDoc);
    const res = await asAdmin(request(createApp())[method](url)).set("Content-Type", "image/png").send(Buffer.from("x"));
    expect(res.status).toBe(400);
  });
});

describe("putTrack", () => {
  it("writes the file and the metadata in one request, on the revision read", async () => {
    const put = vi.spyOn(couch, "put").mockResolvedValue({ rev: "3-b" });
    const put1 = vi.spyOn(couch, "get");
    const doc = { ...BASE, _id: "media:x-abc123", _rev: "2-a", _attachments: { "video.mp4": { stub: true, length: 5 } } } as unknown as MediaDoc;
    const out = await mediaStore.putTrack(doc, { name: "captions.vtt", contentType: "text/vtt", data: Buffer.from("WEBVTT") }, (d) => ({ ...d, updatedAt: "now" }));
    expect(put).toHaveBeenCalledTimes(1);
    const sent = put.mock.calls[0][1] as { _rev: string; _attachments: Record<string, { data?: string; stub?: boolean }> };
    expect(sent._rev).toBe("2-a");
    expect(sent._attachments["video.mp4"].stub).toBe(true);
    expect(Buffer.from(sent._attachments["captions.vtt"].data!, "base64").toString()).toBe("WEBVTT");
    expect(put1).not.toHaveBeenCalled();
    expect(out._rev).toBe("3-b");
  });
});
