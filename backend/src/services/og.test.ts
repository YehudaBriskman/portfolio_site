import crypto from "crypto";
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { HEBREW_CARDS, OG_FORMATS, bidiRuns, cardSvg, isOgFormat, renderCardPng } from "./og.js";

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

describe("Hebrew cards", () => {
  const HE = { lang: "he", eyebrow: "הערה", title: "בניית מערכת RAG עם PostgreSQL בגרסה 2.5: מה למדתי?", meta: "yehudabriskman.com · 4 דקות קריאה" } as const;

  it("are on, and leave the English card alone", () => {
    expect(HEBREW_CARDS).toBe(true);
    expect(cardSvg({ ...SHORT, lang: "en" })).toBe(cardSvg(SHORT));
    expect(cardSvg(SHORT)).not.toContain("Heebo");
  });

  it("set the text in Heebo, right-aligned, on a mirrored scene", () => {
    const svg = cardSvg(HE);
    expect(svg).toContain('font-family="Heebo"');
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain("scale(-1 1)");
    expect(svg).not.toContain("IBM Plex Mono");
  });

  it.each(OG_FORMATS)("render at the %s size and differ from English", (format) => {
    const he = renderCardPng(HE, format);
    expect(size(he)).toEqual(size(renderCardPng(LONG, format)));
    expect(sha(he)).not.toBe(sha(renderCardPng({ ...HE, lang: "en" }, format)));
  });

  it("truncate a very long title instead of overflowing", () => {
    const svg = cardSvg({ lang: "he", title: "מילה ".repeat(80) }, "story");
    expect(svg).toContain("…");
    expect((svg.match(/<text /g) ?? []).length).toBeLessThan(40);
  });

  it("bundles every Hebrew letter in the font's metrics", () => {
    const m = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "assets", "fonts", "metrics.json"), "utf8"),
    ) as Record<string, { widths: Record<string, number> }>;
    for (let cp = 0x5d0; cp <= 0x5ea; cp++) expect(m.Heebo.widths[String(cp)]).toBeGreaterThan(0);
  });

  describe("bidiRuns", () => {
    const runs = (s: string) => bidiRuns(s).map((r) => `${r.level}:${r.text}`);

    it("keeps Latin words and numbers as left-to-right runs inside Hebrew", () => {
      const r = bidiRuns("עם RAG בגרסה 2.5");
      expect(r.filter((x) => x.level === 2).map((x) => x.text)).toEqual(["RAG", "2.5"]);
      expect(r.filter((x) => x.level === 1 && /[א-ת]/.test(x.text)).map((x) => x.text)).toEqual(["עם", "בגרסה"]);
    });

    it("splits punctuation off the ends of a Hebrew run", () => {
      expect(runs("ל-TypeScript:")).toEqual(["1:ל", "1:-", "2:TypeScript", "1::"]);
    });

    it("keeps number separators and percent signs with their number", () => {
      expect(bidiRuns("הנחה 12.5% בלבד").some((r) => r.level === 2 && r.text === "12.5%")).toBe(true);
    });

    it("leaves a pure Hebrew line as one run", () => {
      expect(runs("כותרת קצרה")).toEqual(["1:כותרת קצרה"]);
    });
  });
});
