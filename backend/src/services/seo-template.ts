import { absoluteUrl, pathIn, type Lang } from "./seo.js";
import { PERSON_ID, WEBSITE_ID, personNode, siteNameIn, websiteNode } from "./seo-entity.js";
import { SEO_WORDS } from "./seo-words.js";
import type { ContentBundle } from "../schemas/site-content.js";

/*
 * The one template every rendered page's metadata comes from (#308).
 *
 * A route says what it is (a collection, an article, a project, a plain
 * page), where it sits (its breadcrumb trail) and what it lists; this file
 * turns that into the title, the JSON-LD graph and the breadcrumbs, the same
 * way for every route and both languages. The pieces:
 *
 *   fitTitle      `Name · Yehuda Briskman`, or the bare name when the suffix
 *                 would push the title past what a result shows. The app's
 *                 `documentTitleFor` (web/src/lib/pageTitle.ts) keeps the
 *                 same rule, so a tab and a result read the same.
 *   breadcrumbs   Home › … › this page, as a BreadcrumbList.
 *   webPage       the page node: WebPage, CollectionPage or ProfilePage,
 *                 part of the one WebSite, about the one Person when it is.
 *   itemList      what a collection page lists, in its order.
 *   graph         the nodes as one JSON-LD document.
 */

/** Where a result title is cut, in characters; Google's limit is ~600px. */
export const TITLE_MAX = 60;

export function fitTitle(name: string, lang: Lang): string {
  const full = `${name} · ${siteNameIn(lang)}`;
  return full.length <= TITLE_MAX ? full : name;
}

export type Crumb = { name: string; path: string };

/** The page's trail, with Home first. `path` is unprefixed; the language adds `/he`. */
export function breadcrumbs(lang: Lang, trail: Crumb[]) {
  const all: Crumb[] = [{ name: SEO_WORDS[lang].home, path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(pathIn(trail.at(-1)?.path ?? "/", lang))}#breadcrumb`,
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(pathIn(c.path, lang)),
    })),
  };
}

export type PageKind = "WebPage" | "CollectionPage" | "ProfilePage";

export function webPage(
  kind: PageKind,
  lang: Lang,
  path: string,
  fields: { name: string; description?: string; about?: boolean; mainEntity?: unknown; breadcrumb?: boolean },
) {
  const url = absoluteUrl(pathIn(path, lang));
  return {
    "@type": kind,
    "@id": `${url}#page`,
    url,
    name: fields.name,
    ...(fields.description ? { description: fields.description } : {}),
    inLanguage: lang,
    isPartOf: { "@id": WEBSITE_ID },
    ...(fields.about ? { about: { "@id": PERSON_ID } } : {}),
    ...(fields.mainEntity ? { mainEntity: fields.mainEntity } : {}),
    ...(fields.breadcrumb === false ? {} : { breadcrumb: { "@id": `${url}#breadcrumb` } }),
  };
}

/** What a collection page lists, in the order it lists them. */
export function itemList(lang: Lang, items: { name: string; path: string }[]) {
  return {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(pathIn(it.path, lang)),
    })),
  };
}

/** The nodes as one JSON-LD document. */
export function graph(...nodes: (Record<string, unknown> | null | undefined | false)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}

/**
 * The home page's graph: the person, the site, and the page as a profile of
 * the one, part of the other. What a knowledge panel is assembled from.
 * `web/index.html` carries the English one as built; a test holds them equal.
 */
export function homeGraph(lang: Lang, bundle: Pick<ContentBundle, "projects" | "siteCopy">) {
  const w = SEO_WORDS[lang];
  return graph(
    personNode(lang, bundle),
    websiteNode(lang),
    webPage("ProfilePage", lang, "/", {
      name: w.siteTitle,
      description: w.siteDescription,
      about: true,
      mainEntity: { "@id": PERSON_ID },
      breadcrumb: false,
    }),
  );
}
