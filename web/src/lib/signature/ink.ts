/*
 * Cleans a photo or scan of a signature in the browser: find the paper, turn
 * everything paper-like transparent, crop to the ink, and shrink to at most
 * 960 px wide. Pure functions over RGBA bytes (no canvas), so each step is
 * tested on its own; the editor only moves pixels in and out of a canvas.
 */

export type Raster = { data: Uint8ClampedArray; width: number; height: number };
export const MAX_WIDTH = 960;

const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/** The paper's brightness: the 85th percentile of the visible pixels, so ink and shadow do not pull it down. */
export function paperLuminance(img: Raster): number {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    hist[Math.min(255, Math.round(lum(img.data, i)))] += 1;
    n += 1;
  }
  if (n === 0) return 255;
  let seen = 0;
  for (let v = 0; v < 256; v += 1) {
    seen += hist[v];
    if (seen >= n * 0.85) return Math.max(v, 1);
  }
  return 255;
}

export type CleanOptions = {
  /** 0..100: how dark a pixel must be, against the paper, to count as ink. Higher drops more (grey shadows, paper grain). */
  threshold: number;
  /** 0..100: how wide the soft edge between paper and ink is. */
  soften: number;
  /** Paint all ink this colour (r, g, b); null keeps each pixel's own colour. */
  ink: [number, number, number] | null;
};

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A copy of the picture with the paper made transparent. */
export function removeBackground(img: Raster, o: CleanOptions): Raster {
  const paper = paperLuminance(img);
  const cut = (Math.max(0, Math.min(100, o.threshold)) / 100) * 0.6;
  const edge = 0.03 + (Math.max(0, Math.min(100, o.soften)) / 100) * 0.3;
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    const darkness = Math.max(0, (paper - lum(img.data, i)) / paper);
    const a = Math.round(smooth((darkness - cut) / edge) * (img.data[i + 3] / 255) * 255);
    out[i] = o.ink ? o.ink[0] : img.data[i];
    out[i + 1] = o.ink ? o.ink[1] : img.data[i + 1];
    out[i + 2] = o.ink ? o.ink[2] : img.data[i + 2];
    out[i + 3] = a;
  }
  return { data: out, width: img.width, height: img.height };
}

/** The picture cut to the ink, with a small margin; null when nothing is left. */
export function cropToInk(img: Raster, margin = 2, minAlpha = 8): Raster | null {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3] > minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  const w = Math.min(img.width, x1 + margin + 1) - left;
  const h = Math.min(img.height, y1 + margin + 1) - top;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const from = ((top + y) * img.width + left) * 4;
    data.set(img.data.subarray(from, from + w * 4), y * w * 4);
  }
  return { data, width: w, height: h };
}

/** Area-averaged shrink (in premultiplied alpha, so a soft edge does not grow a halo) to at most `maxWidth` wide. Never enlarges. */
export function downscale(img: Raster, maxWidth = MAX_WIDTH): Raster {
  if (img.width <= maxWidth) return img;
  const w = maxWidth;
  const h = Math.max(1, Math.round((img.height * w) / img.width));
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(img.height, Math.max(y0 + 1, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(img.width, Math.max(x0 + 1, Math.ceil((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * img.width + xx) * 4;
          const al = img.data[i + 3];
          r += img.data[i] * al;
          g += img.data[i + 1] * al;
          b += img.data[i + 2] * al;
          a += al;
          n += 1;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / n;
    }
  }
  return { data: out, width: w, height: h };
}

/** Remove the paper, crop to the ink, shrink. Null when nothing is left (the slider is too high, or the picture is blank). */
export function cleanSignature(img: Raster, o: CleanOptions): Raster | null {
  const cropped = cropToInk(removeBackground(img, o));
  return cropped && downscale(cropped);
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x14130f;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
