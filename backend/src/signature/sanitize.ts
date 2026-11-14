import { DOMParser, type Element, type Node } from "@xmldom/xmldom";

/*
 * A signature SVG is never stored as it arrived. It is PARSED (a real XML
 * parser, no patterns), walked, and a NEW document is written from an
 * allow-list: a few drawing primitives, a few geometry and paint attributes,
 * and each value must match a strict grammar. Whatever is not on the list
 * (editor namespaces, ids, classes, titles, metadata) is left out; whatever
 * can run or load something (script, style, foreignObject, use, image, links,
 * animation, handlers, href, url(), style attributes, DOCTYPE) is REFUSED, so
 * the owner learns why instead of getting a quietly different file.
 * Because the output is written from checked values, a quirk one parser reads
 * differently from another cannot ride along.
 */

export const SIG_SVG_MAX_BYTES = 200 * 1024;
const MAX_ELEMENTS = 5000;
const MAX_DEPTH = 24;
const MAX_D = 150_000;

const SVG_NS = "http://www.w3.org/2000/svg";

const PAINT_ATTRS = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "transform"];
const GEOMETRY: Record<string, string[]> = {
  svg: [],
  g: [],
  path: ["d"],
  polyline: ["points"],
  circle: ["cx", "cy", "r"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
};
const SHAPES = new Set(["path", "polyline", "circle", "rect", "ellipse", "line"]);
/* Harmless and not drawn: left out without comment. */
const INERT = new Set(["title", "desc", "metadata", "defs"]);

const NUM = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;
const POINTS = /^[0-9eE.,\s+-]*$/;
const TRANSFORM = /^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\(\s*[-+0-9.eE,\s]*\)\s*)+$/;
const PAINT = /^(?:none|currentColor|#[0-9a-f]{3,8}|rgba?\(\s*[\d.%\s,/]+\)|[a-z]{3,20})$/i;
const ENUMS: Record<string, string[]> = {
  "stroke-linecap": ["butt", "round", "square"],
  "stroke-linejoin": ["miter", "round", "bevel", "arcs", "miter-clip"],
  "fill-rule": ["nonzero", "evenodd"],
};

export type SigSvgResult = { ok: true; svg: string; width: number; height: number } | { ok: false; error: string };
const refuse = (error: string): SigSvgResult => ({ ok: false, error });

class Refused extends Error {}
const no = (why: string): never => {
  throw new Refused(why);
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function lengthOf(raw: string): string | null {
  const v = raw.trim().replace(/px$/i, "");
  return NUM.test(v) ? String(Number(v)) : null;
}

function value(name: string, raw: string, recolor: boolean): string | null {
  const v = raw.trim();
  if (name === "d") return v.length <= MAX_D && PATH_D.test(v) ? v : no("a path has characters a path cannot have");
  if (name === "points") return v.length <= MAX_D && POINTS.test(v) ? v : no("a polyline has characters it cannot have");
  if (name === "transform") return TRANSFORM.test(v) ? v : no("a transform is not plain numbers");
  if (name === "fill" || name === "stroke") {
    if (!PAINT.test(v)) return no("a colour is not a plain colour (no url(), no script)");
    return recolor && v.toLowerCase() !== "none" ? "currentColor" : v;
  }
  if (name in ENUMS) return ENUMS[name].includes(v) ? v : no(`${name} has an unknown value`);
  const n = lengthOf(v);
  return n === null ? no(`${name} is not a number`) : n;
}

function write(node: Node, depth: number, recolor: boolean, count: { shapes: number; all: number }): string {
  if (node.nodeType === 3 || node.nodeType === 8) return "";
  if (node.nodeType === 4) return no("CDATA sections are not allowed");
  if (node.nodeType === 7) return no("processing instructions are not allowed");
  if (node.nodeType !== 1) return no("markup that could not be checked");
  const el = node as Element;
  const local = (el.localName ?? el.nodeName).toLowerCase();
  if (el.namespaceURI !== SVG_NS) return ""; // an editor's own namespace: not drawn, not kept
  if (INERT.has(local)) return "";
  if (!(local in GEOMETRY)) return no(`<${local}> is not allowed (use paths; convert text to outlines)`);
  if ((count.all += 1) > MAX_ELEMENTS) return no("too many elements");
  if (depth > MAX_DEPTH) return no("nested too deeply");

  const allowed = new Set([...GEOMETRY[local], ...(local === "svg" ? [] : PAINT_ATTRS)]);
  const out: string[] = [];
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes.item(i)!;
    const name = a.name.toLowerCase();
    const inNs = a.namespaceURI !== null && a.namespaceURI !== "" && a.namespaceURI !== "http://www.w3.org/2000/xmlns/";
    if (name.startsWith("on") && !inNs) no("event handlers are not allowed");
    if (name === "style") no("style attributes are not allowed (use fill and stroke)");
    if (name === "href" || name.endsWith(":href")) no("links are not allowed");
    if (inNs || !allowed.has(name)) continue;
    const v = value(name, a.value, recolor);
    if (v !== null) out.push(`${name}="${esc(v)}"`);
  }
  if (SHAPES.has(local)) count.shapes += 1;
  let inner = "";
  for (let c = el.firstChild; c; c = c.nextSibling) inner += write(c, depth + 1, recolor, count);
  return `<${local}${out.length ? ` ${out.join(" ")}` : ""}>${inner}</${local}>`.replace(/><\/(path|polyline|circle|rect|ellipse|line)>$/, "/>");
}

export function sanitizeSignatureSvg(input: Buffer | string, opts: { recolor?: boolean } = {}): SigSvgResult {
  const size = typeof input === "string" ? Buffer.byteLength(input) : input.length;
  if (size > SIG_SVG_MAX_BYTES) return refuse(`it is larger than ${SIG_SVG_MAX_BYTES / 1024} KB`);
  const text = typeof input === "string" ? input : input.toString("utf8");
  if (/<!doctype|<!entity/i.test(text)) return refuse("doctype and entities are not allowed");

  let root: Element | null = null;
  try {
    const doc = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") throw new Error(message);
      },
    }).parseFromString(text, "text/xml");
    for (let c = doc.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) {
        if (root) return refuse("more than one root element");
        root = c as Element;
      } else if (c.nodeType === 10) return refuse("doctype and entities are not allowed");
    }
  } catch {
    return refuse("it is not well-formed XML");
  }
  if (!root || root.namespaceURI !== SVG_NS || root.localName !== "svg") return refuse("no svg element");

  const recolor = Boolean(opts.recolor);
  try {
    const box = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number) ?? [];
    let vb: [number, number, number, number] | null = null;
    if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) vb = [box[0], box[1], box[2], box[3]];
    else if (root.hasAttribute("viewBox")) return refuse("its viewBox is not valid");
    if (!vb) {
      const w = Number(lengthOf(root.getAttribute("width") ?? "") ?? NaN);
      const h = Number(lengthOf(root.getAttribute("height") ?? "") ?? NaN);
      if (!(w > 0 && h > 0)) return refuse("it has no viewBox and no width and height");
      vb = [0, 0, w, h];
    }
    if (vb[2] > 100_000 || vb[3] > 100_000) return refuse("its size is not valid");

    const count = { shapes: 0, all: 0 };
    let inner = "";
    for (let c = root.firstChild; c; c = c.nextSibling) inner += write(c, 1, recolor, count);
    // The root's own paint attributes are not carried; a recolour paints from the root.
    for (let i = 0; i < root.attributes.length; i += 1) {
      const n = root.attributes.item(i)!.name.toLowerCase();
      if (n.startsWith("on") || n === "style" || n.endsWith("href")) return refuse("handlers, styles and links are not allowed");
    }
    if (count.shapes === 0) return refuse("it draws nothing (paths, lines and shapes only; convert text to outlines)");
    const svg = `<svg xmlns="${SVG_NS}" viewBox="${vb.join(" ")}"${recolor ? ' fill="currentColor"' : ""}>${inner}</svg>`;
    return { ok: true, svg, width: vb[2], height: vb[3] };
  } catch (e) {
    if (e instanceof Refused) return refuse(e.message);
    throw e;
  }
}
