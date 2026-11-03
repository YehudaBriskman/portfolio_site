/*
 * Inline SVG diagrams in a note (#249), made safe twice over.
 *
 * A note is markdown with no raw HTML (there is no rehype-raw, and there will
 * not be one), so an author puts a diagram in a fenced block:
 *
 *   ```svg
 *   <svg viewBox="0 0 200 80">…</svg>
 *   ```
 *
 * and the reader draws it instead of printing it. Two layers keep that from
 * being an injection point:
 *
 *  1. AN ALLOWLIST. The source is parsed as XML (never as HTML, never into the
 *     live document) and rebuilt from scratch, keeping only drawing elements
 *     and presentation attributes. Scripts, `foreignObject`, `<a>`, animation
 *     elements, `style` elements, every `on*` attribute and any `href` that is
 *     not a same-document `#fragment` are dropped. A `style` attribute is kept
 *     only when it holds no `url(`, `expression` or `@import`.
 *  2. AN <img>. What comes out is drawn through `<img src="data:image/svg+xml,…">`,
 *     never inserted into the DOM. An SVG loaded as an image runs no script
 *     and fetches nothing, whatever survived step 1, and `img-src data:` is
 *     already in the site's CSP. It also stays crisp at any zoom, which is the
 *     point of a diagram being vector.
 *
 * Anything that does not parse, or is not an `<svg>` at the root, returns null
 * and the block renders as the code it was written as.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SOURCE = 200_000;

const ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "symbol", "use",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath",
  "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask", "marker",
  "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feMerge", "feMergeNode", "feFlood", "feComposite",
]);

const ATTRIBUTES = new Set([
  "id", "class", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "transform", "fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width",
  "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
  "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
  "letter-spacing", "dx", "dy", "rotate", "textLength", "lengthAdjust", "offset", "stop-color", "stop-opacity",
  "gradientUnits", "gradientTransform", "spreadMethod", "fx", "fy", "patternUnits", "patternContentUnits",
  "patternTransform", "clipPathUnits", "maskUnits", "maskContentUnits", "markerWidth", "markerHeight", "refX",
  "refY", "orient", "markerUnits", "marker-start", "marker-mid", "marker-end", "clip-path", "mask", "filter",
  "preserveAspectRatio", "stdDeviation", "in", "in2", "result", "mode", "values", "type", "operator", "k1", "k2",
  "k3", "k4", "flood-color", "flood-opacity", "vector-effect", "paint-order", "role", "aria-label", "style",
  "href", "xlink:href", "xmlns", "xmlns:xlink", "version",
]);

/* `url(#id)` is how a fill names a gradient; any other url() fetches. */
const LOCAL_URL = /^\s*url\(\s*#[\w.-]+\s*\)\s*$/;
const BAD_STYLE = /url\s*\(|expression|@import|javascript:|behaviou?r/i;

function cleanAttr(name: string, value: string): string | null {
  if (!ATTRIBUTES.has(name)) return null;
  if (/^on/i.test(name)) return null;
  if (name === "href" || name === "xlink:href") return /^#[\w.-]+$/.test(value) ? value : null;
  if (name === "style") return BAD_STYLE.test(value) ? null : value;
  if (/url\s*\(/i.test(value)) return LOCAL_URL.test(value) ? value : null;
  if (/javascript:|data:/i.test(value)) return null;
  return value;
}

function rebuild(source: Element, doc: XMLDocument): Element | null {
  if (source.namespaceURI !== SVG_NS || !ELEMENTS.has(source.localName)) return null;
  const out = doc.createElementNS(SVG_NS, source.localName);
  for (const attr of Array.from(source.attributes)) {
    const v = cleanAttr(attr.name, attr.value);
    if (v === null) continue;
    if (attr.name === "xmlns" || attr.name === "xmlns:xlink") continue;
    if (attr.name === "xlink:href") out.setAttribute("href", v);
    else out.setAttribute(attr.name, v);
  }
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === 3) out.appendChild(doc.createTextNode(child.textContent ?? ""));
    else if (child.nodeType === 1) {
      const kept = rebuild(child as Element, doc);
      if (kept) out.appendChild(kept);
    }
  }
  return out;
}

/** The sanitised markup, or null when the source is not a usable SVG. */
export function sanitizeSvg(source: string): string | null {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return null;
  const text = source.trim();
  if (!text || text.length > MAX_SOURCE) return null;
  /* An external entity or a DOCTYPE is never a diagram's business. */
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return null;
  const withNs = /<svg\b[^>]*\bxmlns=/.test(text) ? text : text.replace(/<svg\b/, `<svg xmlns="${SVG_NS}"`);
  const parsed = new DOMParser().parseFromString(withNs, "image/svg+xml");
  const root = parsed.documentElement;
  if (!root || root.getElementsByTagName("parsererror").length > 0 || root.localName !== "svg") return null;
  const doc = document.implementation.createDocument(SVG_NS, "svg", null) as XMLDocument;
  const clean = rebuild(root, doc);
  if (!clean) return null;
  clean.setAttribute("xmlns", SVG_NS);
  return new XMLSerializer().serializeToString(clean);
}

/** A data: URL for an `<img>`, or null. */
export function svgDataUrl(source: string): string | null {
  const clean = sanitizeSvg(source);
  return clean ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}` : null;
}

/** Whether an image address is an SVG file, so the reader can treat it as a diagram. */
export function isSvgSrc(src: string | undefined): boolean {
  if (!src) return false;
  return /\.svg(?:[?#]|$)/i.test(src) || /^data:image\/svg\+xml/i.test(src);
}
