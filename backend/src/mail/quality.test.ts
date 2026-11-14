import { describe, expect, it } from "vitest";
import { PALETTE, renderMail, type MailBlock } from "./render.js";
import { autoPreheader } from "./preheader.js";

/* WCAG 2.x relative luminance and contrast ratio. */
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("colour contrast stays at WCAG AA (4.5:1) in both palettes", () => {
  for (const mode of ["light", "dark"] as const) {
    const P = PALETTE[mode];
    const pairs: [string, string, string][] = [
      ["body text", P.ink, P.card],
      ["secondary text", P.soft, P.card],
      ["link", P.link, P.card],
      ["button label", P.btnInk, P.btn],
      ["text in a box", P.ink, P.box],
      ["secondary text in a box", P.soft, P.box],
    ];
    for (const [name, fg, bg] of pairs) {
      it(`${mode}: ${name}`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
    }
  }
});

const blocks: MailBlock[] = [
  { type: "heading", text: "שלום" },
  { type: "paragraph", text: "טקסט" },
  { type: "list", items: ["אחד", "שניים"] },
  { type: "button", label: "קראו", href: "https://example.test/a" },
  { type: "footer", lines: ["x"] },
];

describe("right-to-left survives clients that drop <html dir>", () => {
  const he = renderMail(blocks, { lang: "he", origin: "https://example.test" }).html;
  const en = renderMail(blocks, { lang: "en", origin: "https://example.test" }).html;
  it("puts dir on the body, the wrapper tables and every cell", () => {
    expect(he).toMatch(/<body[^>]* dir="rtl"/);
    const tables = he.match(/<table\b[^>]*>/g) ?? [];
    expect(tables.length).toBeGreaterThan(1);
    for (const t of tables) expect(t).toContain('dir="rtl"');
    const cells = he.match(/<td class="card"[^>]*>/g) ?? [];
    expect(cells.length).toBeGreaterThan(3);
    for (const c of cells) expect(c).toContain('dir="rtl"');
  });
  it("English stays ltr everywhere", () => {
    expect(en).not.toContain('dir="rtl"');
    expect(en).toMatch(/<body[^>]* dir="ltr"/);
  });
  it("a list is padded on both sides, so a bullet of a mixed-direction item (an English item in a Hebrew list) stays inside the text column", () => {
    expect(he).toMatch(/<ul[^>]*padding:0 22px/);
    expect(en).toMatch(/<ul[^>]*padding:0 22px/);
  });
});

describe("autoPreheader", () => {
  it("takes the first paragraph, one line, at most 100 characters", () => {
    const long = "Word ".repeat(60);
    const out = autoPreheader([{ type: "heading", text: "Title" }, { type: "paragraph", text: `  Hello\n  there ${long}` }]);
    expect(out.startsWith("Hello there Word")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out).not.toMatch(/\s{2}|\n/);
  });
  it("skips the advertisement label and empty paragraphs, and returns empty when there is no text", () => {
    expect(autoPreheader([{ type: "paragraph", tone: "strong", text: "פרסומת" }, { type: "paragraph", text: "  " }, { type: "paragraph", text: "גוף" }])).toBe("גוף");
    expect(autoPreheader([{ type: "image", src: "x", alt: "a", width: 10 }])).toBe("");
  });
  it("reads link text, not the address", () => {
    expect(autoPreheader([{ type: "paragraph", text: ["See ", { href: "https://a.test/x", text: "the post" }] }])).toBe("See the post");
  });
});
