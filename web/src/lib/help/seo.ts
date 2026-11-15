import { useHelpWords } from "@/i18n/help";
import { helpPageIds, type HelpPage } from "./pages";
import { HELP_TOPICS } from "./topics";
import { helpTitleOf } from "./title";

/*
 * What the server's head for each help page says (#803).
 *
 * The backend renders every page's head for crawlers and cannot import from
 * web/, so it holds a copy of these words in
 * `backend/src/services/help-pages.json`, written from here. A test
 * (`__tests__/seoMirror.test.ts`) fails when the copy drifts and says how to
 * rewrite it (`UPDATE_HELP_SEO=1`), the way the signature strokes are kept.
 *
 * Nothing is written for this file: a page's title is its existing heading,
 * and its description is an existing sentence of the page, chosen by the one
 * rule in `descriptionOf` (the topic title and its "what you see" line for an outcome, the
 * page's own first paragraph or list for a guide).
 */

type Lang = "en" | "he";
export type HelpSeoPage = {
  id: HelpPage;
  /** The outcome group, or null for a guide. */
  group: string | null;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  /** Whether the page has Hebrew of its own (#318): without it the Hebrew page is noindex. */
  hebrew: boolean;
};

const HEBREW = /[֐-׿]/;

function descriptionOf(id: HelpPage, lang: Lang): string {
  const w = useHelpWords.of(lang);
  switch (id) {
    case "language": return w.languageBody[0];
    case "look": return w.lookItems.map(([n, t]) => `${n} ${t}`).join(" ");
    case "keyboard": return w.keyboardItems.map(([n, t]) => `${n} ${t}`).join(" ");
    case "sharing": return w.sharingBody;
    case "rss": return w.rssBody;
    case "contact-form": return `${w.contactBefore}${w.contactLink}${w.contactAfter}`;
    default: return `${w.topics[id].title}: ${w.topics[id].see}`;
  }
}

/** Every page, contact form included: the server decides what the settings show. */
export function helpSeoPages(): HelpSeoPage[] {
  return helpPageIds(true).map((id) => {
    const title = { en: helpTitleOf(useHelpWords.of("en"), id), he: helpTitleOf(useHelpWords.of("he"), id) };
    const description = { en: descriptionOf(id, "en"), he: descriptionOf(id, "he") };
    return {
      id,
      group: id in HELP_TOPICS ? HELP_TOPICS[id as keyof typeof HELP_TOPICS].group : null,
      title,
      description,
      hebrew: HEBREW.test(title.he) && HEBREW.test(description.he),
    };
  });
}
