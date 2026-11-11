import type { CardFormat, ShareKind, ShareLocale } from "./types";

/** The one place third-party address formats live; `urls.test.ts` pins each. */

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function xShareUrl(url: string, text: string): string {
  return `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function gmailComposeUrl(subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** RFC 6068: line breaks in a mailto body are CRLF. */
export function mailtoUrl(subject: string, body: string): string {
  const crlf = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, "\r\n"));
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${crlf(body)}`;
}

/**
 * The site origin, from the caller's own configuration. Anything that is not
 * a plain http(s) origin (credentials, a path, another scheme) is refused, so
 * a bad value fails loudly instead of building a link to somewhere else.
 */
export function safeOrigin(origin: string): string {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    throw new RangeError("share: origin is not a URL");
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) {
    throw new RangeError("share: origin must be a plain http(s) origin");
  }
  return u.origin;
}

/** A slug is one path segment: never empty, never a dot segment the URL parser would resolve. */
function segment(slug: string | undefined): string {
  if (!slug || slug === "." || slug === "..") throw new RangeError("share: this kind needs a valid slug");
  return encodeURIComponent(slug);
}

/** The entity's own path, English form. Built from the kind and slug only. */
export function entityPath(kind: ShareKind, slug?: string): string {
  switch (kind) {
    case "post":
    case "note":
      return `/blog/${segment(slug)}`;
    case "area":
      return `/blog/area/${segment(slug)}`;
    case "project":
    case "release":
      return `/projects/${segment(slug)}`;
    case "story":
      return "/story";
    case "home":
      return "/";
  }
}

/** Hebrew lives under `/he`; the same address in either language. */
export function localePath(path: string, locale: ShareLocale): string {
  if (locale === "en") return path;
  return path === "/" ? "/he" : `/he${path}`;
}

const UTM_CLEAN = /[^a-z0-9_.-]+/g;

/** Origin + path, with `utm_source` and `utm_medium` when asked. */
export function entityUrl(origin: string, path: string, utm?: { source: string; medium: string }): string {
  const base = safeOrigin(origin);
  const url = new URL(path, base);
  if (url.origin !== base) throw new RangeError("share: address left the site origin");
  let out = url.href;
  if (utm) {
    const source = utm.source.toLowerCase().replace(UTM_CLEAN, "-").slice(0, 40) || "share";
    out += `${out.includes("?") ? "&" : "?"}utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(utm.medium)}`;
  }
  return out;
}

/** The card for kinds that have one; the others have none yet. */
export function cardUrl(origin: string, kind: ShareKind, slug: string | undefined, format: CardFormat): string | undefined {
  const dir = kind === "post" || kind === "note" ? "blog" : kind === "project" ? "projects" : undefined;
  if (!dir || !slug) return undefined;
  const base = `${safeOrigin(origin)}/api/seo/og/${dir}/${segment(slug)}.png`;
  return format === "og" ? base : `${base}?format=${format}`;
}
