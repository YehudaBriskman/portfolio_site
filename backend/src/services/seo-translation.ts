import type { Collection, Post } from "../schemas/content.js";
import type { ContentBundle } from "../schemas/site-content.js";
import { collectionTranslation, hasPublishedHebrew, itemStatus, postTranslation, textUnits } from "../schemas/i18n.js";

/*
 * Whether an item's Hebrew page is a Hebrew page (#304, design §5.4).
 *
 * A note, a project or an area whose Hebrew is not published is served at
 * /he/... as the English under Hebrew chrome. That page is `noindex, follow`,
 * names no alternates, says og:locale en_US and is left out of the sitemap;
 * its English twin names no Hebrew alternate either. The moment Hebrew is
 * published (translated, stale or unverified, `hasPublishedHebrew`), both
 * flip to an indexed en↔he pair.
 *
 * The statuses are the translation report's own (schemas/i18n.ts, #301), so
 * the admin's "missing" and the search engine's "not indexed" are one fact.
 * Hub pages (home, the indexes, the story) are always both: their chrome
 * and copy are translated whatever the items in them are.
 */

type ProjectEntry = ContentBundle["projects"]["items"][number];

/** The fields the translation report counts as a project's own (translations.ts). */
const PROJECT_PRIMARY = new Set(["fact", "description"]);

export function postHasHebrew(post: Post): boolean {
  return hasPublishedHebrew(postTranslation(post).status);
}

export function areaHasHebrew(c: Collection): boolean {
  return hasPublishedHebrew(collectionTranslation(c).status);
}

/**
 * A project page: the content store's entry when there is one (its fact and
 * description are the page's text), else the published collection's own.
 */
export function projectHasHebrew(entry: ProjectEntry | null | undefined, collection: Collection | null | undefined): boolean {
  if (entry) return hasPublishedHebrew(itemStatus(textUnits(entry, null, (path) => PROJECT_PRIMARY.has(path))));
  return collection ? areaHasHebrew(collection) : false;
}
