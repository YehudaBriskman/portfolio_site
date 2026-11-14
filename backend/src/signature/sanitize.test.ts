import { DOMParser } from "@xmldom/xmldom";
import { SIG_SVG_MAX_BYTES, sanitizeSignatureSvg } from "./sanitize.js";

/*
 * What is stored is rebuilt from an allow-list, never the uploaded markup. Each
 * hostile input below is a known way past a pattern filter; none may come out.
 */

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const svg = (inner: string, attrs = "") => `<svg ${NS} viewBox="0 0 100 50"${attrs}>${inner}</svg>`;
const ALLOWED_EL = new Set(["svg", "g", "path", "polyline", "circle", "rect", "ellipse", "line"]);

function elements(text: string): string[] {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const all = doc.getElementsByTagName("*");
  const out: string[] = [];
  for (let i = 0; i < all.length; i += 1) out.push(all.item(i)!.nodeName);
  return out;
}

describe("sanitizeSignatureSvg: refuses", () => {
  it.each([
    ["script", svg("<script>alert(1)</script>")],
    ["script in mixed case", svg("<ScRiPt>alert(1)</ScRiPt>")],
    ["an onload handler", svg('<path d="M0 0L5 5"/>', ' onload="alert(1)"')],
    ["an onclick on a shape", svg('<rect width="1" height="1" onclick="alert(1)"/>')],
    ["foreignObject", svg("<foreignObject><div/></foreignObject>")],
    ["use", svg('<use href="#a"/>')],
    ["image", svg('<image href="https://evil.example/p.png"/>')],
    ["a style element", svg("<style>@import url(//evil.example/a.css)</style>")],
    ["an anchor", svg('<a href="javascript:alert(1)"><path d="M0 0"/></a>')],
    ["animate", svg('<path d="M0 0"><animate attributeName="d" to="M1 1"/></path>')],
    ["set", svg('<path d="M0 0"><set attributeName="onclick" to="x"/></path>')],
    ["a doctype with an entity", `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>${svg("")}`],
    ["a CDATA section", svg("<g><![CDATA[x]]></g>")],
    ["an external fill url()", svg('<path d="M0 0" fill="url(https://evil.example/p)"/>')],
    ["a url() even to a fragment (no defs are kept)", svg('<path d="M0 0" fill="url(#a)"/>')],
    ["a style attribute", svg('<path d="M0 0" style="fill:red"/>')],
    ["javascript: in a fill", svg('<path d="M0 0" fill="javascript:alert(1)"/>')],
    ["a path with letters it should not have", svg('<path d="M0 0 alert(1)"/>')],
    ["a transform that is not numbers", svg('<path d="M0 0" transform="translate(alert(1))"/>')],
    ["not svg at all", "<html><body/></html>"],
    ["no viewBox and no size", `<svg ${NS}><path d="M0 0L1 1"/></svg>`],
    ["a viewBox of nonsense", `<svg ${NS} viewBox="0 0 -1 50"><path d="M0 0L1 1"/></svg>`],
    ["markup that does not parse", `<svg ${NS} viewBox="0 0 1 1"><path></svg>`],
    ["nothing drawn", svg("")],
  ])("%s", (_what, input) => {
    expect(sanitizeSignatureSvg(input)).toMatchObject({ ok: false });
  });

  it("an oversize file, before parsing it", () => {
    const big = svg(`<path d="M0 0${" L1 1".repeat(SIG_SVG_MAX_BYTES / 4)}"/>`);
    expect(sanitizeSignatureSvg(big)).toMatchObject({ ok: false, error: expect.stringContaining("larger") });
  });

  it("deep nesting", () => {
    expect(sanitizeSignatureSvg(svg("<g>".repeat(100) + '<path d="M0 0L1 1"/>' + "</g>".repeat(100)))).toMatchObject({ ok: false });
  });
});

describe("sanitizeSignatureSvg: accepts and rebuilds", () => {
  const good = svg(
    '<title>x</title><metadata>m</metadata><defs/><!-- c --><g transform="translate(1 2) scale(1.5)" fill="none" stroke="#123456" stroke-width="3" stroke-linecap="round">' +
      '<path d="M10 10 C 20 20, 40 20, 50 10 S 80 0 90 10" /><polyline points="1,1 2,2 3,3"/><circle cx="5" cy="5" r="2" fill="#000"/><rect x="1" y="1" width="3" height="3" rx="1"/><ellipse cx="1" cy="1" rx="2" ry="3"/><line x1="0" y1="0" x2="9" y2="9"/></g>',
  );

  it("keeps the drawing and nothing off the list", () => {
    const r = sanitizeSignatureSvg(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const els = elements(r.svg);
    expect(els.every((e) => ALLOWED_EL.has(e))).toBe(true);
    expect(els).toEqual(expect.arrayContaining(["path", "polyline", "circle", "rect", "ellipse", "line"]));
    expect(r.svg).not.toMatch(/title|metadata|defs|<!--/);
    expect(r.width / r.height).toBeCloseTo(2);
  });

  it("drops editor namespaces and unknown attributes instead of carrying them", () => {
    const r = sanitizeSignatureSvg(`<svg ${NS} xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" sodipodi:docname="me.svg" viewBox="0 0 10 10" data-x="1"><path d="M0 0L9 9" inkscape-x="1"/></svg>`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.svg).not.toMatch(/sodipodi|data-x|inkscape/);
  });

  it("takes a size from width and height when there is no viewBox", () => {
    const r = sanitizeSignatureSvg(`<svg ${NS} width="200px" height="100"><path d="M0 0L9 9"/></svg>`);
    expect(r).toMatchObject({ ok: true, width: 200, height: 100 });
  });

  it("recolours every ink to currentColor when asked, and keeps colours otherwise", () => {
    const on = sanitizeSignatureSvg(good, { recolor: true });
    const off = sanitizeSignatureSvg(good);
    expect(on.ok && on.svg).toContain("currentColor");
    expect(on.ok && on.svg).not.toContain("#123456");
    expect(off.ok && off.svg).toContain("#123456");
  });

  it("is stable: sanitising the output again changes nothing", () => {
    const a = sanitizeSignatureSvg(good);
    if (!a.ok) throw new Error("expected ok");
    const b = sanitizeSignatureSvg(a.svg);
    expect(b.ok && b.svg).toBe(a.svg);
  });
});
