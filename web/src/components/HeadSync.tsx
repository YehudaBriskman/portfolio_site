import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { currentLang } from "@/i18n/routing";
import { applyHead, headUrl, markServedFeeds } from "@/lib/headSync";

/*
 * The head after a client-side navigation (#308).
 *
 * A hard load of any public page gets its head from the server render
 * (backend/src/routes/seo.route.ts): its description, canonical, hreflang,
 * robots, Open Graph and JSON-LD. A client-side navigation changed only the
 * title, so after one click the head still described the first page: its
 * canonical, its card, its structured data. A crawler that renders starts
 * every URL fresh and never saw this, but a reader who shares the page from
 * the browser, an extension that reads the head, and the next render did.
 *
 * So after each navigation the app asks the API for the head the render
 * would have written, `/api/seo/head/<path>`, and swaps the managed tags in.
 * One function decides a page's head, whichever way the reader arrived. The
 * title stays the app's: `RouteAnnouncer` and `useDocumentTitle` own it, and
 * they already agree with the render (lib/pageTitle.ts).
 *
 * The first location is skipped (the served head is already right), the
 * admin is skipped (it is not a public page and has no render), and a reply
 * for a location the reader has already left is dropped.
 */

export default function HeadSync() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      markServedFeeds(document.head);
      return;
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    const ctrl = new AbortController();
    fetch(headUrl(pathname, currentLang()), { signal: ctrl.signal, headers: { accept: "application/json" } })
      .then((r) => (r.headers.get("content-type")?.includes("json") ? r.json() : null))
      .then((body: { head?: unknown } | null) => {
        if (body && Array.isArray(body.head)) applyHead(document.head, body.head as string[]);
      })
      .catch(() => {
        /* The head is a courtesy: a failed fetch leaves the last one standing. */
      });
    return () => ctrl.abort();
  }, [pathname]);

  return null;
}
