import type { Lang } from "@/components/dashboard/i18n";

/*
 * Where the language lives: in the address (#248).
 *
 * The scheme is a path prefix. English is the bare address and Hebrew is the
 * same address under `/he`:
 *
 *   /                 /he
 *   /blog             /he/blog
 *   /projects/windom  /he/projects/windom
 *
 * A prefix rather than a stored preference alone, because a crawler has no
 * storage: `hreflang` alternates need two addresses to point at, and the
 * server render (`/api/seo/render/he/*`) needs to know from the request which
 * language to answer in. A shared link also has to open in the language it
 * was shared in, whatever the reader chose last time.
 *
 * The preference is still kept (`yb-lang`), for one job only: a reader who
 * chose Hebrew and comes back to a bare English address on the home page is
 * taken to `/he`. Anywhere else the address wins, so a link someone sends in
 * English opens in English.
 *
 * The router is given `/he` as its basename, so every `<Link to="/blog">`
 * in the tree resolves to `/he/blog` without a component knowing the prefix
 * exists. Switching language changes the basename, and `App.tsx` keys the
 * router on the language so it rebuilds against the new address.
 */

export const HE_PREFIX = "/he";
export const PREF_KEY = "yb-lang";

/** The language an address is in. */
export function langOfPath(pathname: string): Lang {
  return pathname === HE_PREFIX || pathname.startsWith(`${HE_PREFIX}/`) ? "he" : "en";
}

/** The address without its language prefix: `/he/blog` → `/blog`, `/he` → `/`. */
export function stripLang(pathname: string): string {
  if (langOfPath(pathname) === "en") return pathname || "/";
  const rest = pathname.slice(HE_PREFIX.length);
  return rest === "" ? "/" : rest;
}

/** An unprefixed address in a language: (`/blog`, `he`) → `/he/blog`. */
export function pathIn(pathname: string, lang: Lang): string {
  const bare = stripLang(pathname);
  if (lang === "en") return bare;
  return bare === "/" ? HE_PREFIX : `${HE_PREFIX}${bare}`;
}

/** What the router is mounted under. */
export function basenameFor(lang: Lang): string | undefined {
  return lang === "he" ? HE_PREFIX : undefined;
}

export const DIR: Record<Lang, "ltr" | "rtl"> = { en: "ltr", he: "rtl" };

/** The document's language, for code that is not a component. */
export function currentLang(): Lang {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang.toLowerCase().startsWith("he") ? "he" : "en";
}

/**
 * The one place the document is told what language it is in.
 *
 * `lang` selects the type system (index.css re-points the three faces under
 * `:root:lang(he)`) and is what every `useLang()` in the tree subscribes to;
 * `dir` switches the reading direction, which the layout expresses in
 * logical properties.
 */
export function applyLang(lang: Lang): void {
  const root = document.documentElement;
  if (root.lang !== lang) root.lang = lang;
  if (root.dir !== DIR[lang]) root.dir = DIR[lang];
}

function readPref(): Lang | null {
  try {
    const v = window.localStorage.getItem(PREF_KEY);
    return v === "he" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

function writePref(lang: Lang): void {
  try {
    window.localStorage.setItem(PREF_KEY, lang);
  } catch {
    /* Private mode or blocked storage: the address still carries the choice. */
  }
}

/**
 * Before the first render: the document's language from the address, and the
 * one redirect the stored preference is allowed to make (see the head of this
 * file). Returns the language the app mounts in.
 */
export function bootLang(): Lang {
  const { pathname, search, hash } = window.location;
  let lang = langOfPath(pathname);
  if (lang === "en" && pathname === "/" && readPref() === "he") {
    window.history.replaceState(window.history.state, "", `${HE_PREFIX}${search}${hash}`);
    lang = "he";
  }
  applyLang(lang);
  /* Back and Forward across the prefix: the router under one basename cannot
     render the other's address, so the language follows the address and
     `App.tsx` remounts the router under the right basename. */
  window.addEventListener("popstate", () => applyLang(langOfPath(window.location.pathname)));
  return lang;
}

/**
 * The language menu's action: the same page, in the other language.
 *
 * Pushed, not replaced, so Back returns to the language the reader came from.
 * The search and hash are kept, so a filter or an anchor survives the switch.
 */
/*
 * Where the reader was when they switched language. The switch remounts the
 * router under the other basename, so `ScrollManager` sees a brand-new
 * mount whose history entry is named `default:<path>`, and it would treat
 * that as an arrival: restore whatever position an EARLIER visit to that same
 * path left in sessionStorage (often far down the page), or jump to the top.
 * A language switch is neither; the reader stays where they are. So the
 * position is handed over here, once, and consumed by `takeLangScroll`.
 */
let langScroll: number | null = null;

/** The scroll position a language switch left behind, once; then null. */
export function takeLangScroll(): number | null {
  const y = langScroll;
  langScroll = null;
  return y;
}

export function switchLang(next: Lang): void {
  writePref(next);
  const { pathname, search, hash } = window.location;
  if (langOfPath(pathname) === next) return;
  langScroll = Math.round(window.scrollY);
  window.history.pushState(null, "", `${pathIn(pathname, next)}${search}${hash}`);
  applyLang(next);
}
