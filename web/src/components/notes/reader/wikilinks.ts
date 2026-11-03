/*
 * `[[slug]]` in a note's markdown, as a link (#249).
 *
 * Borrowed from Bothy's reader, where a wikilink names a document rather than
 * a path. Here there are three kinds of thing a note can name, and the prefix
 * says which:
 *
 *   [[some-note]]                 → /blog/some-note
 *   [[area:bothy]]                → /blog/area/bothy
 *   [[project:windom]]            → /projects/windom
 *   [[some-note#a-heading|Label]] → /blog/some-note#a-heading, reading "Label"
 *
 * A remark (mdast) plugin, so it runs before rehype and the link it makes is
 * an ordinary link node: the renderer's `a` override handles it exactly as it
 * handles `[Label](/blog/some-note)`, previews included, and nothing
 * downstream needs to know it was written as a wikilink. It never makes raw
 * HTML, and a target that is not a slug is left as the text it was, so
 * `[[<script>]]` is five characters of prose and nothing else.
 *
 * Text inside code, inline code and an existing link is left alone.
 */

export type WikiKind = "note" | "area" | "project";

export type WikiTarget = { kind: WikiKind; slug: string; hash: string; label: string | null; href: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/* A heading id is whatever `headingSlug` makes: letters, marks, digits, `-`, `_`. */
const HASH = /^[\p{L}\p{M}\p{N}_-]{1,120}$/u;
const WIKI = /\[\[([^[\]\n|]{1,160})(?:\|([^[\]\n]{1,160}))?\]\]/g;

const PREFIX: Record<string, WikiKind> = { area: "area", project: "project", note: "note" };

export function hrefOf(kind: WikiKind, slug: string): string {
  if (kind === "area") return `/blog/area/${slug}`;
  if (kind === "project") return `/projects/${slug}`;
  return `/blog/${slug}`;
}

/** Parses the inside of `[[…]]`; null when it is not something a note can name. */
export function parseWikiTarget(raw: string, label?: string | null): WikiTarget | null {
  let rest = raw.trim();
  let kind: WikiKind = "note";
  const colon = /^([a-z]+):(.*)$/.exec(rest);
  if (colon) {
    const k = PREFIX[colon[1]];
    if (!k) return null;
    kind = k;
    rest = colon[2].trim();
  }
  const [slug, hash = ""] = rest.split("#", 2);
  if (!SLUG.test(slug) || slug.length > 80) return null;
  if (hash && !HASH.test(hash)) return null;
  const text = label?.trim() || null;
  return { kind, slug, hash, label: text, href: `${hrefOf(kind, slug)}${hash ? `#${encodeURIComponent(hash)}` : ""}` };
}

/** "some-note" → "Some note", for a wikilink written without a label. */
export function humanize(slug: string): string {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type MdNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, string> };
};

const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "definition", "html"]);

function splitText(value: string): MdNode[] | null {
  WIKI.lastIndex = 0;
  if (!WIKI.test(value)) return null;
  WIKI.lastIndex = 0;
  const out: MdNode[] = [];
  let at = 0;
  for (const m of value.matchAll(WIKI)) {
    const target = parseWikiTarget(m[1], m[2]);
    if (!target) continue;
    const start = m.index ?? 0;
    if (start > at) out.push({ type: "text", value: value.slice(at, start) });
    out.push({
      type: "link",
      url: target.href,
      children: [{ type: "text", value: target.label ?? humanize(target.slug) }],
      data: { hProperties: { "data-wikilink": target.kind } },
    });
    at = start + m[0].length;
  }
  if (out.length === 0) return null;
  if (at < value.length) out.push({ type: "text", value: value.slice(at) });
  return out;
}

function walk(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const parts = splitText(child.value);
      if (parts) {
        next.push(...parts);
        continue;
      }
    }
    walk(child);
    next.push(child);
  }
  node.children = next;
}

export function remarkWikilinks() {
  return (tree: MdNode) => walk(tree);
}

/** Every `[[…]]` target in a body, for the editor's checks. */
export function wikiTargets(body: string): WikiTarget[] {
  const out: WikiTarget[] = [];
  for (const m of body.matchAll(WIKI)) {
    const t = parseWikiTarget(m[1], m[2]);
    if (t) out.push(t);
  }
  return out;
}

/** What a site-relative link points at, if it is a note, an area or a project. */
export function internalTarget(href: string | undefined): { kind: WikiKind; slug: string } | null {
  if (!href) return null;
  let path = href;
  if (/^https?:\/\//i.test(href)) {
    if (typeof window === "undefined") return null;
    try {
      const u = new URL(href);
      if (u.origin !== window.location.origin) return null;
      path = u.pathname;
    } catch {
      return null;
    }
  }
  path = path.split(/[?#]/, 1)[0];
  let m = /^\/blog\/area\/([a-z0-9-]+)\/?$/.exec(path);
  if (m && SLUG.test(m[1])) return { kind: "area", slug: m[1] };
  m = /^\/projects\/([a-z0-9-]+)\/?$/.exec(path);
  if (m && SLUG.test(m[1])) return { kind: "project", slug: m[1] };
  m = /^\/blog\/([a-z0-9-]+)\/?$/.exec(path);
  if (m && SLUG.test(m[1]) && m[1] !== "log") return { kind: "note", slug: m[1] };
  return null;
}
