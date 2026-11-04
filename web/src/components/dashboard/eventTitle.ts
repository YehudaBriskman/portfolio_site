import type { Lang, Words } from "@/components/dashboard/i18n";
import type { ActivityEvent } from "@/services/activity";

/*
 * An event's line, from its structure rather than a stored sentence (#306,
 * design §6.3): a push is worded here in the page's language from the
 * repository's name; a note's title is its published Hebrew on a Hebrew page.
 * Anything else (a release tag, an area's name) is a name and stays as sent.
 */
export function eventTitle(e: ActivityEvent, t: Words, lang: Lang): string {
  const meta = e.meta as { repo?: unknown; he?: { title?: unknown } | null };
  if (e.kind === "push" && typeof meta.repo === "string" && meta.repo) return t.pushedTo(meta.repo);
  if (e.kind === "post" && lang === "he" && typeof meta.he?.title === "string" && meta.he.title) return meta.he.title;
  return e.title;
}
