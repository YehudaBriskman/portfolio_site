/*
 * The campaign body is supplied by the client, so it is cleaned here rather
 * than trusted: an allow-list of tags and attributes, http(s)/mailto links,
 * https images, no scripts, remote stylesheets, forms or event handlers.
 * Applied when a campaign is saved and again when it is sent.
 */

const ALLOWED = new Set([
  "p", "br", "div", "span", "a", "b", "strong", "i", "em", "u", "s", "h1", "h2", "h3", "h4", "ul", "ol", "li",
  "blockquote", "hr", "img", "table", "thead", "tbody", "tr", "td", "th", "pre", "code", "small", "sup", "sub",
]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|form|textarea|title|head|noscript|template|select|button)\b[\s\S]*?<\/\1\s*>/gi;
const ATTRS = new Set(["href", "src", "alt", "title", "width", "height", "dir", "lang", "style", "align", "colspan", "rowspan"]);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR = /([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
/* Entities in an attribute value are kept, so "&amp;" in a URL survives; a lone "&" is escaped. */
const attrEsc = (s: string) => s.replace(/&(?!(?:[a-zA-Z]{2,8}|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const textEsc = (s: string) => s.replace(/</g, "&lt;");

function safeStyle(v: string): boolean {
  const d = v.replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
  return !/(url\s*\(|@import|expression|behavior|javascript:|-moz-binding|&#|\\|<)/.test(d);
}

function safeAttr(tag: string, name: string, value: string): boolean {
  const v = value.trim();
  if (name === "href") return /^(https?:\/\/|mailto:)/i.test(v) && tag === "a";
  if (name === "src") return /^https:\/\//i.test(v) && tag === "img";
  if (name === "style") return safeStyle(v);
  if (name === "dir") return /^(ltr|rtl|auto)$/i.test(v);
  return true;
}

export function sanitizeHtml(html: string): string {
  /* Repeated until nothing changes: removing one block can join the text around it into another. */
  let src = html;
  for (let prev = ""; prev !== src; ) {
    prev = src;
    src = src.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");
  }
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TAG)) {
    out += textEsc(src.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!ALLOWED.has(tag)) continue;
    if (closing) {
      out += `</${tag}>`;
      continue;
    }
    let attrs = "";
    for (const a of m[3].matchAll(ATTR)) {
      const name = a[1].toLowerCase();
      const value = a[2] ?? a[3] ?? "";
      if (!ATTRS.has(name) || !safeAttr(tag, name, value)) continue;
      attrs += ` ${name}="${attrEsc(value)}"`;
    }
    if (tag === "a") attrs += ' rel="noopener noreferrer"';
    out += `<${tag}${attrs}>`;
  }
  return out + textEsc(src.slice(last));
}

export const escapeHtml = esc;
