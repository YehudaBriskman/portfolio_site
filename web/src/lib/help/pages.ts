import { HELP_GROUPS, HELP_TOPICS, helpTopics, isHelpTopic, type HelpTopic } from "./topics";

/*
 * The help area's pages (#803): `/help` is the index, and every id below has
 * its own page at `/help/<id>`.
 *
 * Two kinds of page share the address space. The six guides are short
 * explanations (language, theme, keyboard, sharing, the feed, the contact
 * form); the outcome topics are the registry in `topics.ts`. Every id is an
 * address that was `/help#<id>` before the split, so none ever changes.
 * `problems` and `problems-<group>` were headings, not topics: they stay
 * headings on the index.
 *
 * The contact form's guide is left out, with its address, while the form is
 * hidden in the site settings (#254).
 */

export const HELP_GUIDES = ["language", "look", "keyboard", "sharing", "rss", "contact-form"] as const;
export type HelpGuide = (typeof HELP_GUIDES)[number];
export type HelpPage = HelpGuide | HelpTopic;

const isGuide = (s: string): s is HelpGuide => (HELP_GUIDES as readonly string[]).includes(s);

/** The pages in reading order: the guides, then each group's topics. */
export function helpPageIds(contactShown: boolean): HelpPage[] {
  return [
    ...HELP_GUIDES.filter((g) => contactShown || g !== "contact-form"),
    ...HELP_GROUPS.flatMap((g) => helpTopics.filter((t) => HELP_TOPICS[t].group === g)),
  ];
}

export function isHelpPage(id: string, contactShown: boolean): id is HelpPage {
  return (isGuide(id) && (contactShown || id !== "contact-form")) || isHelpTopic(id);
}

/** The address of a page, without the language (the router adds it). */
export const helpPagePath = (id: HelpPage): string => `/help/${id}`;

/**
 * Where an old `/help#<id>` anchor now lives, or null when the hash is not a
 * page (`#problems` and its groups are headings on the index, so it stays).
 */
export function legacyHelpTarget(hash: string, contactShown: boolean): string | null {
  let id = hash.replace(/^#/, "");
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  return id && isHelpPage(id, contactShown) ? helpPagePath(id) : null;
}

export function neighbours(id: HelpPage, contactShown: boolean): { prev: HelpPage | null; next: HelpPage | null } {
  const ids = helpPageIds(contactShown);
  const at = ids.indexOf(id);
  return { prev: at > 0 ? ids[at - 1] : null, next: at >= 0 && at < ids.length - 1 ? ids[at + 1] : null };
}
