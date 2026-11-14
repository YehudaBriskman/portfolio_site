import pages from "./help-pages.json";
import type { Lang } from "./seo.js";

/*
 * The help area's pages (#803), as the server needs them for each page's head
 * and for the sitemap: an id, a title and a description in each language.
 *
 * The JSON is a copy of words that live in web/src/i18n/help.ts, written by
 * `UPDATE_HELP_SEO=1 npx vitest run src/lib/help/__tests__/seoMirror.test.ts`
 * in web/, and held there by that test: the backend cannot import from web/.
 * Each id is a public address (`/help/<id>`) and never changes.
 */

export type HelpPageSeo = {
  id: string;
  group: string | null;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  /** Whether the page has Hebrew of its own (#318); without it the Hebrew page is noindex. */
  hebrew: boolean;
};

export const HELP_PAGES: readonly HelpPageSeo[] = pages as HelpPageSeo[];

/** The contact form's guide is hidden with the form (#254). */
export const HELP_CONTACT_PAGE = "contact-form";

export function helpPageSeo(id: string, contactShown: boolean): HelpPageSeo | undefined {
  return HELP_PAGES.find((p) => p.id === id && (contactShown || p.id !== HELP_CONTACT_PAGE));
}
