import { contentView } from "@/content/store";
import type { Lang } from "@/components/dashboard/i18n";
import { usePageNames } from "@/i18n/chrome";
import { currentLang } from "@/i18n/routing";

/*
 * What a page is called, derived from nothing but its URL.
 *
 * Why this exists at all
 * ----------------------
 * `document.title` was byte-identical on `/`, `/projects`, `/blog` and the
 * 404 — all four read the home page's title, because `index.html` sets it once
 * and a single-page app never changes it again. SC 2.4.2 asks a page to be
 * titled for what it contains, and a reader navigating by the tab list, by
 * their history, or by a screen reader's "read the title" command was told the
 * same sentence wherever they landed, including when they landed nowhere.
 *
 * Why a resolver, and not a `useTitle` call in every page
 * ------------------------------------------------------
 * A per-page hook is the obvious shape and it gets the 404 wrong, which is the
 * one route the issue singles out. `NotFound` renders for every address that
 * matches nothing, and the redirect routes in App.tsx (`/notes`, `/blog/c/:x`,
 * `/admin/collections/:x`) render a `<Navigate>` and no page at all — so there
 * is no component on those paths to hang a hook on. A function from pathname
 * to name answers for every address the router can reach, including the ones
 * with no page behind them, and it is testable without rendering anything.
 *
 * Pages that know better still say so: see `hooks/useDocumentTitle.ts`. A blog
 * post's real title is not in the URL and cannot be derived from it, so the
 * name below is a stand-in that the page replaces once its fetch lands.
 *
 * The format is not invented here
 * -------------------------------
 * `backend/src/routes/seo.route.ts` already rewrites the head per URL for
 * crawlers, and it writes `Work · Yehuda Briskman`, `Blogs · Yehuda
 * Briskman`, `Not found · Yehuda Briskman` and `${post.title} · Yehuda
 * Briskman`. Those strings are the contract; this file reproduces them rather
 * than choosing a second format, because a crawler and a reader seeing two
 * different titles for one URL is the bug a per-route title was meant to fix.
 * The separator is the same interpunct the whole site uses.
 */

/** The one name every title ends with. Matches `SITE_TITLE` in seo.route.ts. */
export const SITE_NAME = "Yehuda Briskman";

/**
 * The shell's own title, as `index.html` ships it.
 *
 * Load-bearing twice over: it is the title of `/`, and it is how
 * `RouteAnnouncer` tells "the server rewrote this head for me" from "the
 * static shell was served". See the note there before changing it — this
 * string has to stay character-identical to the `<title>` in `index.html`.
 */
export const HOME_TITLE = "Yehuda Briskman · Full-stack engineer & team lead";

export type PageIdentity = {
  /**
   * What the page is called, in as few words as name it.
   *
   * This is what the live region announces, so it is a name and not a
   * sentence: a reader who has just activated a link needs the destination,
   * not a description of it.
   */
  name: string;
  /**
   * The whole of `document.title`.
   *
   * Separate from `name` because the two have different jobs. The title is
   * read out of context — in a tab strip, in a history list, in a bookmark —
   * so it carries the site name; the announcement is heard immediately after
   * a click on this site, where repeating the site name every time is noise.
   */
  title: string;
};

/** `Name · Yehuda Briskman`. Exported for the pages that resolve their own. */
export function documentTitleFor(name: string): string {
  return `${name} · ${SITE_NAME}`;
}

/*
 * The admin's titles say so.
 *
 * Not decoration: the admin and the public site have pages called the same
 * things — `Posts` is the authoring list and `Notes` is the public index of
 * the same rows — and someone with both open has two tabs to tell apart. The
 * announcement stays the bare name, because inside the admin every page is an
 * admin page and the word would be on all of them.
 */
function adminIdentity(name: string, admin = "Admin"): PageIdentity {
  return { name, title: `${name} · ${admin} · ${SITE_NAME}` };
}

function identity(name: string): PageIdentity {
  return { name, title: documentTitleFor(name) };
}

/**
 * A slug, read as a sentence.
 *
 * Used where the URL is the only thing known about the page: a note's title
 * lives behind a fetch, and an announcement that waits for the network is an
 * announcement the reader has already stopped listening for.
 *
 * Sentence case and not title case, deliberately. `why-ci-must-fail` becomes
 * "Why ci must fail", which is visibly a derivation; title case would produce
 * "Why Ci Must Fail", which is visibly *wrong* and reads as a typo rather
 * than as a placeholder. Either way the page replaces it a moment later —
 * `useDocumentTitle` in BlogPost — so the only question is which of the two is
 * the better thing to be caught showing.
 */
export function humaniseSlug(slug: string): string {
  let text: string;
  try {
    /* A slug arrives from the address bar, so it can be percent-encoded and it
       can be malformed — `decodeURIComponent("%E0")` throws. A name is not
       worth a crash. */
    text = decodeURIComponent(slug);
  } catch {
    text = slug;
  }
  const words = text.replace(/[-_]+/g, " ").trim();
  if (words.length === 0) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A project's real name, when the content store's table (#163) knows the slug. */
function projectName(slug: string): string {
  return contentView().projects.find((p) => p.slug === slug)?.title ?? humaniseSlug(slug);
}

/*
 * The redirect routes, resolved to what they redirect to.
 *
 * `/notes`, `/blog/c/:project`, `/admin` and `/admin/collections/:slug` render
 * a `<Navigate replace>` and nothing else, so the reader is on them for one
 * commit on the way somewhere. Giving them their destination's identity means
 * that commit writes the same title and the same announcement the destination
 * is about to write — and writing an identical string into a live region is
 * not a second announcement, because React leaves the text node alone and the
 * screen reader has nothing to notice. Resolving them to "Not found" instead,
 * which is what the catch-all below would do, would announce a 404 in the
 * middle of a redirect that worked.
 */
function canonicalSegments(segments: readonly string[]): readonly string[] {
  if (segments[0] === "notes") return ["blog", ...segments.slice(1)];
  if (segments[0] === "blog" && segments[1] === "c" && segments[2]) {
    return ["projects", segments[2]];
  }
  if (segments[0] === "admin") {
    if (segments.length === 1) return ["admin", "posts"];
    if (segments[1] === "collections") return ["admin", "areas", ...segments.slice(2)];
  }
  return segments;
}

/**
 * The name and title for a pathname.
 *
 * @param pathname a router pathname, with no query and no hash. Every address
 *   resolves to something: an address matching no route is the 404, which is a
 *   page like any other and the one the audit found titled as the home page.
 */
export function pageIdentityFor(pathname: string, lang: Lang = currentLang()): PageIdentity {
  const n = usePageNames.of(lang);
  const admin = (name: string) => adminIdentity(name, n.admin);
  const segments = canonicalSegments(pathname.split("/").filter(Boolean));
  const [first, second, third] = segments;

  /*
   * The home page is the one page whose name *is* the site's.
   *
   * So it keeps the shell's title verbatim rather than becoming "Home · Yehuda
   * Briskman", which would state the name twice and drop the one line that
   * says what the person does. The announcement is still "Home", because
   * "Yehuda Briskman · Full-stack engineer & team lead" read out after every
   * click on the word Home is a paragraph where a word was asked for.
   */
  if (segments.length === 0) return { name: n.home, title: lang === "en" ? HOME_TITLE : n.homeTitle };

  if (first === "projects") {
    if (!second) return identity(n.work);
    if (segments.length === 2) return identity(projectName(second));
  }

  if (first === "story" && segments.length === 1) return identity(n.journey);

  /* The remote MCP server's page (#263), named as seo.route.ts names it. */
  if (first === "developers" && second === "mcp" && segments.length === 2) return identity(n.mcp);

  if (first === "blog") {
    /* "Blogs", the room's name since #222. The route stays `/blog` for the
       sake of the links already shared at that address; the bar, the page's
       own eyebrow and the footer all say Blogs, and the title is not the
       place to contradict them. */
    if (!second) return identity(n.blogs);
    /* The channel log (#226), named as seo.route.ts names it. */
    if (second === "log" && segments.length === 2) return identity(n.log);
    if (second === "area" && third && segments.length === 3) return identity(humaniseSlug(third));
    if (segments.length === 2) return identity(humaniseSlug(second));
  }

  if (first === "admin") {
    if (second === "posts") {
      if (!third) return admin(n.posts);
      if (segments.length === 3) {
        return admin(third === "new" ? n.newPost : n.editing(humaniseSlug(third)));
      }
    }
    if (second === "connections" && !third) return admin(n.connections);
    if (second === "areas") {
      if (!third) return admin(n.areas);
      if (segments.length === 3) {
        return admin(third === "new" ? n.newArea : n.editing(humaniseSlug(third)));
      }
    }
  }

  /* Everything else is the catch-all route, and it says so. "Not found" is
     the string seo.route.ts puts in the head for the same addresses. */
  return identity(n.notFound);
}
