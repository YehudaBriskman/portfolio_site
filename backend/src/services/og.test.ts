import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { OG_FORMATS, cardSvg, isOgFormat, renderCardPng } from "./og.js";

/** Width and height from a PNG's IHDR chunk. */
function size(png: Buffer): { w: number; h: number } {
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
}

const sha = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");

const SHORT = { title: "A short title" };
const LONG = {
  eyebrow: "Note",
  title: "A much longer title that wraps across several lines of the card to test fitting",
  meta: "yehudabriskman.com · 4 min read",
};

describe("card formats", () => {
  it.each([
    ["og", 1200, 630],
    ["square", 1080, 1080],
    ["story", 1080, 1920],
  ] as const)("%s renders at %dx%d", (format, w, h) => {
    expect(size(renderCardPng(LONG, format))).toEqual({ w, h });
    expect(cardSvg(LONG, format)).toContain(`width="${w}" height="${h}"`);
  });

  it("knows exactly three formats", () => {
    expect([...OG_FORMATS]).toEqual(["og", "square", "story"]);
    expect(isOgFormat("square")).toBe(true);
    expect(isOgFormat("wide")).toBe(false);
    expect(isOgFormat(undefined)).toBe(false);
  });

  it("keeps long titles inside the safe zone of every format", () => {
    const svg = cardSvg({ title: "word ".repeat(60) }, "story");
    expect(svg).toContain("…");
  });

  it("gives the formats different layouts", () => {
    expect(sha(cardSvg(LONG, "square"))).not.toBe(sha(cardSvg(LONG, "og")));
    expect(sha(cardSvg(LONG, "story"))).not.toBe(sha(cardSvg(LONG, "square")));
  });
});

describe("the default card is unchanged", () => {
  // Hashes taken from the renderer before formats existed: existing og:image
  // URLs and anything cached downstream must keep getting the same bytes.
  it("SVG is identical with and without an explicit og format", () => {
    expect(cardSvg(SHORT)).toBe(cardSvg(SHORT, "og"));
    expect(sha(cardSvg(SHORT))).toBe("ce1ff92fb17d7943e15a6992ca363e54d43c05fe2be9b235b1d251f7e8f6ff1e");
    expect(sha(cardSvg(LONG))).toBe("ef0b7267d184d0e9f0fc83f1f7114fb16ef9ddcffd75676cf943ae002618cd1c");
  });

  it("PNG bytes are identical to the pre-format renderer", () => {
    expect(sha(renderCardPng(SHORT))).toBe("db99bbb02f3d12b7909e910173a0889c2ce7bc9e8e5bc85e8ae52926edd3bbae");
    expect(sha(renderCardPng(LONG, "og"))).toBe("80d499f81a6414f6174437b51e8c66d69f1ab83d6bc53260ece533db7261eb38");
    expect(size(renderCardPng(SHORT))).toEqual({ w: 1200, h: 630 });
  });
});
