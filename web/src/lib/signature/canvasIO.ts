import type { Raster } from "./ink";

/* The only canvas code in the signature editor: pixels in from a picture file, pixels out as a PNG. Kept here so tests can replace it. */

const WORK_WIDTH = 1600;

/** Decodes a photo or scan to pixels, at most 1600 px wide so the sliders stay quick. Rejects when the file is not a picture. */
export async function loadRaster(file: Blob): Promise<Raster> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("unreadable"));
      i.src = url;
    });
    const k = Math.min(1, WORK_WIDTH / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("unreadable");
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h);
    return { data: d.data, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasOf(r: Raster): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = r.width;
  c.height = r.height;
  c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  return c;
}

export const rasterToDataUrl = (r: Raster): string => canvasOf(r).toDataURL("image/png");

/** The PNG as base64, for the save request. */
export const rasterToBase64 = (r: Raster): Promise<string> =>
  new Promise((ok, bad) => {
    canvasOf(r).toBlob(async (b) => {
      if (!b) return bad(new Error("encode"));
      const bytes = new Uint8Array(await b.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      ok(btoa(s));
    }, "image/png");
  });
