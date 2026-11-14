import sharp from "sharp";
import { renderRaster, renderVector } from "./render.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><path d="M5 40Q60 0 100 40T195 40" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>';

const transparentPng = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: Math.round(w / 2), height: 6, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } }, left: Math.round(w / 4), top: Math.round(h / 2) }])
    .png()
    .toBuffer();

describe("renderVector", () => {
  it("makes a 2x transparent PNG for email, in the ink, and a light variant", async () => {
    const r = await renderVector(SVG, { ink: "#102030", light: true });
    const m = await sharp(r.emailPng).metadata();
    expect(m.format).toBe("png");
    expect(m.hasAlpha).toBe(true);
    expect(m.width).toBeLessThanOrEqual(480);
    expect(m.width).toBeGreaterThan(300);
    expect(r.width).toBe(Math.round(m.width! / 2));
    expect(r.height).toBe(Math.round(m.height! / 2));
    const ink = await sharp(r.emailPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(ink.data[3]).toBe(0); // the corner is transparent
    expect(r.emailLightPng).toBeInstanceOf(Buffer);
    const lightPx = await sharp(r.emailLightPng!).raw().toBuffer({ resolveWithObject: true });
    const opaque = [...Array(lightPx.info.width * lightPx.info.height).keys()].find((i) => lightPx.data[i * 4 + 3] > 200)!;
    expect(lightPx.data[opaque * 4]).toBeGreaterThan(200); // a light ink, not the dark one
  });

  it("has no light variant unless asked", async () => {
    expect((await renderVector(SVG, { ink: "#000000", light: false })).emailLightPng).toBeNull();
  });

  it("gives the same hash for the same drawing and a new one for a new ink", async () => {
    const a = await renderVector(SVG, { ink: "#111111", light: true });
    const b = await renderVector(SVG, { ink: "#111111", light: true });
    const c = await renderVector(SVG, { ink: "#222222", light: true });
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("renderRaster", () => {
  it("trims transparent margins, caps the width at 960 and strips metadata", async () => {
    const r = await renderRaster(await transparentPng(2000, 600), { light: true });
    const web = await sharp(r.webPng!).metadata();
    expect(web.width).toBeLessThanOrEqual(960);
    expect(web.hasAlpha).toBe(true);
    expect(web.exif).toBeUndefined();
    expect((await sharp(r.emailPng).metadata()).width).toBeLessThanOrEqual(480);
    expect(r.emailLightPng).toBeInstanceOf(Buffer);
  });

  it("refuses something that is not a PNG, and an image with nothing in it", async () => {
    await expect(renderRaster(Buffer.from("GIF89a not an image"), { light: false })).rejects.toThrow(/PNG/);
    await expect(
      renderRaster(await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer(), { light: false }),
    ).rejects.toThrow(/empty/i);
  });

  it("refuses a decompression bomb by its declared size", async () => {
    const bomb = await sharp({ create: { width: 6000, height: 6000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(renderRaster(bomb, { light: false })).rejects.toThrow(/large/i);
  });
});
