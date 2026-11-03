import { DOMParser, XMLSerializer, type Element, type Node } from "@xmldom/xmldom";

/*
 * SVG is a document, not a picture: it can carry script, event handlers,
 * external references and entity expansion. So an uploaded SVG is PARSED by a
 * real XML parser (never matched with regular expressions), walked, and
 * accepted only when every element and attribute is on a short allowlist of
 * drawing primitives. Anything else is refused, not stripped, so the owner
 * learns why. What is stored is the parser's re-serialisation of the checked
 * tree, so the bytes on disk are exactly the tree that was checked: a quirk
 * that one parser reads differently from another cannot survive the round
 * trip.
 *
 * Before parsing: a size cap, and no DOCTYPE at all, so no entity can be
 * declared (XXE, billion laughs). The serving route still adds a
 * `default-src 'none'` CSP and nosniff, as defence in depth.
 */

export const SVG_MAX_BYTES = 2 * 1024 * 1024;
const MAX_NODES = 20_000;
const MAX_DEPTH = 64;

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

/* Lower-cased local names. Nothing that scripts, animates, embeds or styles. */
const ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "path", "rect", "circle", "ellipse", "line",
  "polyline", "polygon", "text", "tspan", "lineargradient", "radialgradient", "stop", "clippath", "mask",
  "pattern",
]);
/* Lower-cased names of attributes in no namespace. No `on*`, no `style`. */
const ATTRIBUTES = new Set([
  "version", "id", "class", "viewbox", "width", "height", "x", "y", "x1", "x2", "y1",
  "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "fill-opacity", "fill-rule", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
  "stroke-dashoffset", "stroke-opacity", "opacity", "transform", "preserveaspectratio", "offset",
  "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "spreadmethod", "fx", "fy",
  "clip-path", "clip-rule", "mask", "clippathunits", "maskunits", "maskcontentunits", "patternunits",
  "patterncontentunits", "patterntransform", "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "dx", "dy", "href", "role",
  "aria-label", "aria-hidden", "focusable", "visibility", "display",
]);

export type SvgResult = { ok: true; svg: string; monochrome: boolean } | { ok: false; error: string };

const refuse = (error: string): SvgResult => ({ ok: false, error });

/** Lower-cased, with whitespace and control characters removed: how a URL scheme is really read. */
function squash(value: string): string {
  let out = "";
  for (const ch of value.toLowerCase()) if (ch.charCodeAt(0) > 0x20) out += ch;
  return out;
}

/** Every `url(` in a value must point inside the document: `url(#id)`. */
function urlsAreLocal(squashed: string): boolean {
  let at = squashed.indexOf("url(");
  while (at !== -1) {
    let i = at + 4;
    if (squashed[i] === '"' || squashed[i] === "'") i += 1;
    if (squashed[i] !== "#") return false;
    at = squashed.indexOf("url(", i);
  }
  return true;
}

function isFragment(value: string): boolean {
  if (value.length < 2 || value[0] !== "#") return false;
  for (const ch of value.slice(1)) if (!/[\w.-]/.test(ch)) return false;
  return true;
}

function checkAttribute(name: string, local: string, ns: string | null, value: string): string | null {
  const lname = name.toLowerCase();
  if (ns === XMLNS_NS) {
    // Namespace declarations: only SVG's own and XLink.
    return value === SVG_NS || value === XLINK_NS ? null : `the ${lname} namespace is not allowed`;
  }
  if (ns === XML_NS) return lname === "xml:space" ? null : `the ${lname} attribute is not allowed`;
  if (ns === XLINK_NS) {
    if (local !== "href") return `the ${lname} attribute is not allowed`;
  } else if (ns !== null && ns !== "") {
    return `the ${lname} attribute is not allowed`;
  } else if (!ATTRIBUTES.has(lname)) {
    return `the ${lname} attribute is not allowed`;
  }
  const squashed = squash(value);
  if (lname === "href" || lname.endsWith(":href")) {
    // References stay inside the document: `#id` and nothing else.
    if (!isFragment(value.trim())) return "only #fragment references are allowed";
  }
  if (squashed.includes("javascript:") || squashed.includes("data:") || squashed.includes("vbscript:")) {
    return "script and data URLs are not allowed";
  }
  if (!urlsAreLocal(squashed)) return "only url(#fragment) references are allowed";
  return null;
}

/* Paint values that do not count as an ink of their own. */
const NOT_INK = new Set(["none", "transparent", "currentcolor", "inherit", ""]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "text"]);

function walk(root: Element): { error: string | null; monochrome: boolean } {
  const inks = new Set<string>();
  let paintServer = false;
  let nodes = 0;

  const visit = (node: Node, depth: number, inheritedFill: boolean): string | null => {
    if ((nodes += 1) > MAX_NODES) return "too many elements";
    if (depth > MAX_DEPTH) return "nested too deeply";
    switch (node.nodeType) {
      case 3: // text
        return null;
      case 8: // comment: dropped from what is stored
        node.parentNode?.removeChild(node);
        return null;
      case 4:
        return "CDATA sections are not allowed";
      case 7:
        return "processing instructions are not allowed";
      case 1:
        break;
      default:
        return "markup that could not be checked";
    }
    const el = node as Element;
    const local = (el.localName ?? el.nodeName).toLowerCase();
    if (el.namespaceURI !== SVG_NS) return `<${local}> is not an SVG element`;
    if (!ELEMENTS.has(local)) return `<${local}> is not allowed`;
    if (local === "lineargradient" || local === "radialgradient" || local === "pattern") paintServer = true;

    let fill = inheritedFill;
    for (let i = 0; i < el.attributes.length; i += 1) {
      const a = el.attributes.item(i);
      if (!a) continue;
      const problem = checkAttribute(a.name, a.localName ?? a.name, a.namespaceURI, a.value);
      if (problem) return problem;
      const an = a.name.toLowerCase();
      if (an === "fill" || an === "stroke" || an === "stop-color") {
        if (an === "fill") fill = true;
        const v = squash(a.value);
        if (!NOT_INK.has(v)) inks.add(v === "black" || v === "#000" ? "#000000" : v === "white" || v === "#fff" ? "#ffffff" : v);
      }
    }
    // A shape with no fill of its own, or inherited, paints black.
    if (SHAPES.has(local) && !fill) inks.add("#000000");
    const inheritFill = (local === "svg" || local === "g") && fill;
    // Copy first: a comment child removes itself while we iterate.
    const kids: Node[] = [];
    for (let c = el.firstChild; c; c = c.nextSibling) kids.push(c);
    for (const c of kids) {
      const problem = visit(c, depth + 1, inheritFill);
      if (problem) return problem;
    }
    return null;
  };

  const error = visit(root, 0, false);
  return { error, monochrome: !paintServer && inks.size <= 1 };
}

/**
 * Parses, checks and re-serialises an SVG. Refuses (never strips) anything off
 * the allowlist. The size cap and the DOCTYPE ban come before any parsing.
 */
export function sanitizeSvg(input: Buffer | string): SvgResult {
  const size = typeof input === "string" ? Buffer.byteLength(input) : input.length;
  if (size > SVG_MAX_BYTES) return refuse(`it is larger than ${SVG_MAX_BYTES / 1024 / 1024} MB`);
  const text = typeof input === "string" ? input : input.toString("utf8");
  const lower = text.toLowerCase();
  if (lower.includes("<!doctype") || lower.includes("<!entity")) return refuse("doctype and entities are not allowed");

  let doc;
  try {
    doc = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") throw new Error(message);
      },
    }).parseFromString(text, "text/xml"); // plain XML: no namespace is assumed for an element
  } catch {
    return refuse("it is not well-formed XML");
  }

  let root: Element | null = null;
  for (let c = doc.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1) {
      if (root) return refuse("more than one root element");
      root = c as Element;
    } else if (c.nodeType === 7 && c.nodeName.toLowerCase() === "xml") {
      continue; // the XML declaration
    } else if (c.nodeType === 8 || c.nodeType === 3) {
      continue;
    } else if (c.nodeType === 10) {
      return refuse("doctype and entities are not allowed");
    } else {
      return refuse("markup that could not be checked");
    }
  }
  if (!root || root.namespaceURI !== SVG_NS || root.localName !== "svg") return refuse("no svg element");

  const { error, monochrome } = walk(root);
  if (error) return refuse(error);
  const svg = new XMLSerializer().serializeToString(root);
  return { ok: true, svg, monochrome };
}

/** One ink and no gradient or pattern. False for anything that does not pass the check. */
export function isMonochrome(svg: string): boolean {
  const r = sanitizeSvg(svg);
  return r.ok && r.monochrome;
}
