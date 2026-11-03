import request from "supertest";
import sharp from "sharp";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { env } from "../env.js";
import { newTokenDoc } from "../services/apiTokenFormat.js";
import { checkSvg, processUpload, sniff, widthsFor, MEDIA_MAX_BYTES } from "../services/mediaImage.js";
import { mediaStore, usageIndex, type MediaDoc } from "../services/media.js";

/*
 * The media library (#253): what an upload must pass, that location data
 * does not survive, that SVG is refused unless it is plain drawing, that a
 * picture in use cannot be deleted, and who may do any of it.
 */

function asAdmin(req: request.Test) {
  return req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
}

/* A photo as a phone writes one: camera, and where it was taken. */
async function phoneJpeg(width = 900, height = 600) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "PhoneCo", Model: "Pocket 9", Copyright: "someone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "31/1 46/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "35/1 13/1 0/1" },
    })
    .toBuffer();
}

const png = (w = 500, h = 300) =>
  sharp({ create: { width: w, height: h, channels: 4, background: "#08f" } }).png().toBuffer();

const CLEAN_SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10">
  <title>A square</title>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs>
  <rect x="1" y="1" width="8" height="8" fill="url(#g)"/>
</svg>`;

let saved: Array<{ doc: MediaDoc; files: Array<{ name: string; data: Buffer }> }>;

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

describe("what an upload must be", () => {
  it("reads the type from the bytes, not the name", async () => {
    expect(sniff(await phoneJpeg())).toBe("jpeg");
    expect(sniff(await png())).toBe("png");
    expect(sniff(await sharp(await png()).webp().toBuffer())).toBe("webp");
    expect(sniff(await sharp(await png(64, 64)).avif().toBuffer())).toBe("avif");
    expect(sniff(Buffer.from(CLEAN_SVG))).toBe("svg");
    expect(sniff(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniff(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniff(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });

  it("refuses a type off the list, whatever it claims to be", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/media?alt=x&filename=fine.jpg"))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from("GIF89a\x01\x00\x01\x00not really"));
    expect(res.status).toBe(415);
    expect(saved).toHaveLength(0);
  });

  it("requires alt text", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/media?filename=a.jpg"))
      .set("Content-Type", "image/jpeg")
      .send(await phoneJpeg());
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("alt");
    const blank = await asAdmin(request(createApp()).post("/api/admin/media?alt=%20%20"))
      .set("Content-Type", "image/jpeg")
      .send(await phoneJpeg());
    expect(blank.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  it("refuses an empty body and one over the size cap", async () => {
    const empty = await asAdmin(request(createApp()).post("/api/admin/media?alt=x"))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.alloc(0));
    expect(empty.status).toBe(400);
    const big = await asAdmin(request(createApp()).post("/api/admin/media?alt=x"))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.alloc(MEDIA_MAX_BYTES + 1, 0xff));
    expect(big.status).toBe(413);
    expect(big.body.error).toMatch(/10 MB/);
    expect(saved).toHaveLength(0);
  });

  it("refuses a file that is not a readable image behind a valid header", async () => {
    await expect(processUpload(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).rejects.toMatchObject({ status: 422 });
  });

  it("refuses a decompression bomb by its pixel count", async () => {
    const huge = await sharp({ create: { width: 9000, height: 5000, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(huge.length).toBeLessThan(MEDIA_MAX_BYTES);
    await expect(processUpload(huge)).rejects.toMatchObject({ status: 413 });
  }, 30_000);
});

describe("EXIF and location", () => {
  it("the fixture really carries GPS and camera data", async () => {
    const meta = await sharp(await phoneJpeg()).metadata();
    expect(meta.exif?.length ?? 0).toBeGreaterThan(0);
  });

  it("are gone from the stored original and from every variant", async () => {
    const res = await asAdmin(request(createApp()).post("/api/admin/media?alt=A%20field&filename=IMG_0001.JPG"))
      .set("Content-Type", "image/jpeg")
      .send(await phoneJpeg(1700, 1000));
    expect(res.status).toBe(201);
    const { files, doc } = saved[0];
    expect(files.map((f) => f.name).sort()).toEqual(
      ["original.jpg", ...[400, 800, 1200, 1600].flatMap((w) => [`w${w}.avif`, `w${w}.webp`])].sort(),
    );
    for (const f of files) {
      const meta = await sharp(f.data).metadata();
      expect(meta.exif, f.name).toBeUndefined();
      expect(meta.xmp, f.name).toBeUndefined();
      expect(f.data.includes(Buffer.from("PhoneCo")), f.name).toBe(false);
      expect(f.data.includes(Buffer.from("Exif\0\0")), f.name).toBe(false);
    }
    expect(doc).toMatchObject({ type: "media", alt: "A field", width: 1700, height: 1000, kind: "image", format: "jpeg", createdBy: env.ADMIN_GITHUB_LOGIN });
    expect(doc.id).toMatch(/^img-0001-[0-9a-f]{6}$/);
    // Each variant is named by its own bytes.
    expect(new Set(doc.variants.map((v) => v.hash)).size).toBe(doc.variants.length);
    expect(res.body.item.srcset.avif).toMatch(/^\/api\/images\/m\/img-0001-[0-9a-f]{6}\/w400-[0-9a-f]{16}\.avif 400w, /);
    expect(res.body.item.url).toBe(`${env.SITE_URL}/api/images/media/${doc.id}`);
  });

  it("orientation is applied before the tag is dropped", async () => {
    const sideways = await sharp({ create: { width: 600, height: 300, channels: 3, background: "#fff" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const p = await processUpload(sideways);
    expect([p.width, p.height]).toEqual([300, 600]);
  });

  it("widths: each rung below the original, and the original when narrower than the widest", () => {
    expect(widthsFor(3000)).toEqual([400, 800, 1200, 1600]);
    expect(widthsFor(1600)).toEqual([400, 800, 1200, 1600]);
    expect(widthsFor(1000)).toEqual([400, 800, 1000]);
    expect(widthsFor(120)).toEqual([120]);
  });
});

describe("SVG", () => {
  it("plain drawing is accepted, and only ever served rasterised", async () => {
    const p = await processUpload(Buffer.from(CLEAN_SVG));
    expect(p).toMatchObject({ kind: "image", format: "svg" });
    expect(p.variants.every((v) => v.format === "avif" || v.format === "webp")).toBe(true);
    expect(p.width).toBe(1600);
  });

  it.each([
    ["script", `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`],
    ["an event handler", `<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" width="1" height="1"/></svg>`],
    ["an external href", `<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/></svg>`],
    ["a javascript: href", `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>`],
    ["foreignObject", `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>`],
    ["an entity", `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>`],
    ["a style element", `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(//evil.example/a.css)</style></svg>`],
    ["an external url() paint", `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.example/p)"/></svg>`],
    ["a style attribute", `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>`],
  ])("with %s is refused", async (_label, svg) => {
    expect(checkSvg(svg)).not.toBeNull();
    const res = await asAdmin(request(createApp()).post("/api/admin/media?alt=x&filename=a.svg"))
      .set("Content-Type", "image/svg+xml")
      .send(Buffer.from(svg));
    expect([415, 400]).toContain(res.status);
    expect(saved).toHaveLength(0);
  });

  it("a clean one passes the check", () => {
    expect(checkSvg(CLEAN_SVG)).toBeNull();
  });
});

const STORED: MediaDoc = {
  _id: "media:hero-abc123",
  _rev: "4-x",
  type: "media",
  id: "hero-abc123",
  name: "hero.jpg",
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
  variants: [
    { width: 400, format: "webp", bytes: 10, hash: "a".repeat(16), name: "w400.webp" },
    { width: 800, format: "webp", bytes: 20, hash: "b".repeat(16), name: "w800.webp" },
    { width: 800, format: "avif", bytes: 15, hash: "c".repeat(16), name: "w800.avif" },
  ],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  createdBy: "owner",
};

describe("delete only when unused", () => {
  const POST_USING = {
    _id: "post:hello",
    type: "post",
    title: "Hello",
    slug: "hello",
    json: JSON.stringify({ coverImage: `${env.SITE_URL}/api/images/media/hero-abc123` }),
  };

  it("the usage index finds stable and hashed URLs, and not an id that merely starts the same", () => {
    const refs = [
      POST_USING,
      { _id: "collection:x", type: "collection", title: "X", slug: "x", json: JSON.stringify({ body: "![a](/api/images/m/hero-abc123/w400-aaaaaaaaaaaaaaaa.webp)" }) },
      { _id: "post:other", type: "post", title: "O", slug: "other", json: JSON.stringify({ coverImage: "/api/images/media/hero-abc1234" }) },
    ];
    const u = usageIndex(["hero-abc123"], refs).get("hero-abc123")!;
    expect(u.map((x) => x.id)).toEqual(["post:hello", "collection:x"]);
    expect(u[0]).toMatchObject({ type: "post", title: "Hello", field: "coverImage" });
  });

  it("refuses to delete a picture something uses, and says what", async () => {
    vi.spyOn(mediaStore, "get").mockResolvedValue(STORED);
    vi.spyOn(mediaStore, "referrers").mockResolvedValue([POST_USING]);
    const remove = vi.spyOn(mediaStore, "remove").mockResolvedValue();
    const res = await asAdmin(request(createApp()).delete("/api/admin/media/hero-abc123?rev=4-x"));
    expect(res.status).toBe(409);
    expect(res.body.usedBy).toEqual([expect.objectContaining({ id: "post:hello", field: "coverImage" })]);
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes an unused one, and only at the revision the editor saw", async () => {
    vi.spyOn(mediaStore, "get").mockResolvedValue(STORED);
    const remove = vi.spyOn(mediaStore, "remove").mockResolvedValue();
    const stale = await asAdmin(request(createApp()).delete("/api/admin/media/hero-abc123?rev=3-old"));
    expect(stale.status).toBe(409);
    const ok = await asAdmin(request(createApp()).delete("/api/admin/media/hero-abc123?rev=4-x"));
    expect(ok.status).toBe(200);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe("who may", () => {
  it("nobody without the admin gate: list, upload, delete", async () => {
    const app = createApp();
    expect((await request(app).get("/api/admin/media")).status).toBe(401);
    expect((await request(app).post("/api/admin/media?alt=x").set("Content-Type", "image/png").send(await png())).status).toBe(401);
    expect((await request(app).delete("/api/admin/media/hero-abc123?rev=1")).status).toBe(401);
    // A forged identity header alone is not the gate.
    expect((await request(app).get("/api/admin/media").set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN)).status).toBe(401);
    expect(saved).toHaveLength(0);
  });

  it("a read token may list but not upload", async () => {
    const before = env.ADMIN_API_TOKENS;
    env.ADMIN_API_TOKENS = "on";
    try {
      const { token, doc } = newTokenDoc({ name: "mcp", scope: "read", createdBy: "t" });
      vi.spyOn(couch, "get").mockResolvedValue({ ...doc, _rev: "1", lastUsedAt: new Date().toISOString() } as never);
      vi.spyOn(mediaStore, "list").mockResolvedValue([STORED]);
      const app = createApp();
      const list = await request(app).get("/api/admin/media").set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.items[0]).toMatchObject({ id: "hero-abc123", usedBy: [] });
      const up = await request(app)
        .post("/api/admin/media?alt=x")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "image/png")
        .send(await png());
      expect(up.status).toBe(403);
      expect(saved).toHaveLength(0);
    } finally {
      env.ADMIN_API_TOKENS = before;
    }
  });

  it("every write is audited, without the query string", async () => {
    const append = vi.mocked(couch.append);
    const res = await asAdmin(request(createApp()).post("/api/admin/media?alt=secret%20words&filename=a.png"))
      .set("Content-Type", "image/png")
      .send(await png());
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 0));
    const entry = append.mock.calls.map(([, d]) => d as Record<string, unknown>).find((d) => d.type === "audit");
    expect(entry).toMatchObject({ method: "POST", path: "/api/admin/media", status: 201, target: saved[0].doc._id });
  });
});

describe("serving", () => {
  beforeEach(() => {
    vi.spyOn(mediaStore, "get").mockResolvedValue(STORED);
  });

  it("the stable URL redirects briefly to a variant, avif when the browser takes it", async () => {
    const app = createApp();
    const webp = await request(app).get("/api/images/media/hero-abc123?w=500");
    expect(webp.status).toBe(302);
    expect(webp.headers.location).toBe(`/api/images/m/hero-abc123/w800-${"b".repeat(16)}.webp`);
    expect(webp.headers["cache-control"]).toBe("public, max-age=300");
    const avif = await request(app).get("/api/images/media/hero-abc123").set("Accept", "image/avif,image/webp,*/*");
    expect(avif.headers.location).toBe(`/api/images/m/hero-abc123/w800-${"c".repeat(16)}.avif`);
  });

  it("the hashed URL is immutable; an old hash finds the current picture", async () => {
    const file = vi.spyOn(mediaStore, "file").mockResolvedValue({ data: Buffer.from("RIFFxxxxWEBP"), contentType: "image/webp" });
    const app = createApp();
    const ok = await request(app).get(`/api/images/m/hero-abc123/w400-${"a".repeat(16)}.webp`);
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(ok.headers["content-type"]).toBe("image/webp");
    expect(file).toHaveBeenCalledWith("hero-abc123", "w400.webp");
    const old = await request(app).get(`/api/images/m/hero-abc123/w400-${"f".repeat(16)}.webp`);
    expect(old.status).toBe(302);
    expect(old.headers.location).toBe(`/api/images/m/hero-abc123/w400-${"a".repeat(16)}.webp`);
  });

  it("never serves the original, and refuses a path that is not a variant", async () => {
    const app = createApp();
    expect((await request(app).get("/api/images/m/hero-abc123/original.jpg")).status).toBe(404);
    expect((await request(app).get("/api/images/m/hero-abc123/..%2F..%2Fetc")).status).toBe(404);
    expect((await request(app).get("/api/images/media/Not_An_Id")).status).toBe(404);
  });
});
