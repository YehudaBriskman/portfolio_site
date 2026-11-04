/* The head swap behind components/HeadSync.tsx (#308); the argument is there. */

/** The tags the render manages, less the title: seo.ts `MANAGED_TAG_PATTERNS`. */
const MANAGED = [
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[property^="og:"]',
  'meta[property^="article:"]',
  'meta[name^="twitter:"]',
  'meta[name="robots"]',
  'script[type="application/ld+json"]',
  'link[rel="alternate"][hreflang]',
].join(",");

/*
 * Feed links are managed apart: a page may render its own with React
 * (BlogLog.tsx), and React's element is React's to remove. So only the
 * render's own (marked by this file, or there when the app booted) go, and a
 * feed already linked is not linked twice.
 */
const FEED = 'link[rel="alternate"][type="application/rss+xml"]';
const OURS = "data-head-sync";
const served = new WeakSet<Element>();

/** Remember the feed links the server wrote, before React adds any. */
export function markServedFeeds(head: HTMLHeadElement): void {
  for (const el of head.querySelectorAll(FEED)) served.add(el);
}

/** Where the API answers for a router path in a language. */
export function headUrl(pathname: string, lang: "en" | "he"): string {
  const bare = pathname === "/" ? "" : pathname.replace(/\/+$/, "");
  if (lang === "he") return `/api/seo/head/he${bare}`;
  return `/api/seo/head${bare || "/home"}`;
}

/** Replace the managed tags in `head` with `tags` (HTML strings from the API). */
export function applyHead(head: HTMLHeadElement, tags: string[]): void {
  const incoming = document.createElement("template");
  incoming.innerHTML = tags.filter((t) => !t.startsWith("<title")).join("");
  for (const el of head.querySelectorAll(MANAGED)) el.remove();
  for (const el of head.querySelectorAll(FEED)) if (served.has(el) || el.hasAttribute(OURS)) el.remove();
  const linked = new Set([...head.querySelectorAll(FEED)].map((el) => el.getAttribute("href")));
  for (const el of [...incoming.content.children]) {
    if (el.matches(FEED)) {
      const href = el.getAttribute("href") ?? "";
      if (linked.has(href) || linked.has(new URL(href, location.origin).pathname)) continue;
      el.setAttribute(OURS, "");
    }
    head.append(el);
  }
}
