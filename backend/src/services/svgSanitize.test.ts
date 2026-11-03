import { DOMParser } from "@xmldom/xmldom";
import { SVG_MAX_BYTES, isMonochrome, sanitizeSvg } from "./svgSanitize.js";

/*
 * The SVG allowlist is a parse, not a pattern. Each case below is a known way
 * past a regular-expression filter; every one must be refused, and what passes
 * must re-parse to a tree with nothing off the list in it.
 */

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';
const svg = (inner: string, attrs = "") => `<svg ${NS} ${XLINK}${attrs}>${inner}</svg>`;

/** Every element and attribute name in a serialised tree, lower-cased. */
function names(text: string): { elements: string[]; attributes: string[]; values: string[] } {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const out = { elements: [] as string[], attributes: [] as string[], values: [] as string[] };
  const all = doc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    const el = all.item(i)!;
    out.elements.push(el.nodeName.toLowerCase());
    for (let j = 0; j < el.attributes.length; j += 1) {
      const a = el.attributes.item(j)!;
      out.attributes.push(a.name.toLowerCase());
      out.values.push(a.value.toLowerCase());
    }
  }
  return out;
}

describe("sanitizeSvg", () => {
  it.each([
    ["script", svg("<script>alert(1)</script>")],
    ["SCRIPT in capitals", svg("<SCRIPT>alert(1)</SCRIPT>")],
    ["ScRiPt in mixed case", svg("<ScRiPt>alert(1)</ScRiPt>")],
    ["script in another namespace", svg('<h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script>')],
    ["an onload handler", svg('<path d="M0 0"/>', ' onload="alert(1)"')],
    ["an ONLOAD handler in capitals", svg('<path d="M0 0"/>', ' ONLOAD="alert(1)"')],
    ["an onclick on a shape", svg('<rect width="1" height="1" onclick="alert(1)"/>')],
    ["foreignObject", svg("<foreignObject><div/></foreignObject>")],
    ["FOREIGNOBJECT in capitals", svg("<FOREIGNOBJECT><div/></FOREIGNOBJECT>")],
    ["a CDATA section", svg("<text><![CDATA[<script>alert(1)</script>]]></text>")],
    ["a doctype with an external entity", `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>${svg("<text>&x;</text>")}`],
    ["a billion-laughs doctype", `<!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>${svg("<text>&b;</text>")}`],
    ["a lower-case doctype", `<!doctype svg>${svg("")}`],
    ["an undeclared entity", svg("<text>&x;</text>")],
    ['xlink:href="javascript:"', svg('<use xlink:href="javascript:alert(1)"/>')],
    ["an href with a tab inside javascript:", svg('<use href="java&#9;script:alert(1)"/>')],
    ["an href in capitals", svg('<use HREF="javascript:alert(1)"/>')],
    ["<use href=//evil>", svg('<use href="//evil.example/x.svg#a"/>')],
    ["<use> of an https file", svg('<use href="https://evil.example/x.svg#a"/>')],
    ["a data: href", svg('<use href="data:image/svg+xml,&lt;svg/&gt;"/>')],
    ["a style attribute with url()", svg('<rect style="fill:url(https://evil.example/p)"/>')],
    ["a style element", svg("<style>@import url(//evil.example/a.css)</style>")],
    ["an external url() paint", svg('<rect fill="url(https://evil.example/p)"/>')],
    ["an external url() in quotes", svg(`<rect fill="url('//evil.example/p')"/>`)],
    ["a URL() paint in capitals", svg('<rect fill="URL(https://evil.example/p)"/>')],
    ["animate setting href to javascript:", svg('<a><animate attributeName="href" to="javascript:alert(1)"/><text>x</text></a>')],
    ["set setting href", svg('<use href="#a"><set attributeName="href" to="javascript:alert(1)"/></use>')],
    ["an <a> link", svg('<a href="#a"><rect/></a>')],
    ["image", svg('<image href="https://evil.example/p.png"/>')],
    ["a processing instruction", `<?xml-stylesheet href="//evil.example/a.css"?>${svg("")}`],
    ["an unknown namespace declaration", svg("", ' xmlns:e="https://evil.example/ns"')],
    ["a root that is not svg", `<html ${NS}/>`],
    ["svg in no namespace", "<svg><rect/></svg>"],
    ["markup that does not parse", `<svg ${NS}><rect></svg>`],
    ["two roots", `${svg("")}${svg("")}`],
  ])("refuses %s", (_what, input) => {
    expect(sanitizeSvg(input)).toMatchObject({ ok: false });
  });

  it("refuses an oversize file before it parses it", () => {
    const big = svg(`<desc>${"x".repeat(SVG_MAX_BYTES)}</desc>`);
    expect(sanitizeSvg(big)).toEqual({ ok: false, error: expect.stringContaining("larger") });
  });

  it("refuses deep nesting rather than recursing without end", () => {
    expect(sanitizeSvg(svg("<g>".repeat(200) + "</g>".repeat(200)))).toMatchObject({ ok: false });
  });

  it("passes plain drawing, and what it returns is the checked tree, without comments", () => {
    const input = `<?xml version="1.0"?>
<!-- made by hand -->
<svg ${NS} ${XLINK} viewBox="0 0 10 10" width="10" height="10">
  <title>A square</title><!-- a note -->
  <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs>
  <rect id="r" x="1" y="1" width="8" height="8" fill="url(#g)"/>
  <use xlink:href="#r"/><use href="#r"/>
</svg>`;
    const r = sanitizeSvg(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svg).not.toContain("<!--");
    const seen = names(r.svg);
    expect(seen.elements).toEqual(["svg", "title", "defs", "lineargradient", "stop", "rect", "use", "use"]);
    for (const a of seen.attributes) expect(a.startsWith("on")).toBe(false);
    for (const v of seen.values) {
      expect(v).not.toContain("javascript:");
      expect(v).not.toContain("data:");
    }
    // And it is stable: the output passes again, unchanged.
    expect(sanitizeSvg(r.svg)).toEqual(r);
  });

  it("knows a one-ink icon from a coloured one", () => {
    expect(isMonochrome(svg('<path d="M0 0"/><path d="M1 1" fill="#000"/>'))).toBe(true);
    expect(isMonochrome(svg('<path d="M0 0" fill="#111"/><circle r="1" fill="#e33"/>'))).toBe(false);
    expect(isMonochrome(svg('<linearGradient id="g"/><path d="M0 0" fill="url(#g)"/>'))).toBe(false);
    expect(isMonochrome(svg('<path d="M0 0"/>', ' fill="currentColor"'))).toBe(true);
    expect(isMonochrome("<svg><script/></svg>")).toBe(false);
  });
});
