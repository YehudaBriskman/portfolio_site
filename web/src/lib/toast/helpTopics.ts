/*
 * The help topics a toast may point at ("Learn more"), in one place.
 *
 * Each id is the `id` of a section on /help (public) or of a heading in the
 * admin design guide (admin). `helpTopics.test.ts` fails when an id has no
 * section, so a toast can never link to nothing. Add the section first, then
 * the id here, then use it: `toast.error(title, { help: { topic } })`.
 */
export const HELP_TOPICS = {
  sharing: "public",
  "contact-form": "public",
  "contact-send-failed": "public",
  "contact-too-many": "public",
  "contact-too-long": "public",
  "contact-offline": "public",
} as const satisfies Record<string, "public" | "admin">;

export type HelpTopic = keyof typeof HELP_TOPICS;

/** Where a topic lives: the public Help page, or the admin guide in the repo. */
export function helpScope(topic: HelpTopic): "public" | "admin" {
  return HELP_TOPICS[topic];
}

const ADMIN_GUIDE = "https://github.com/YehudaBriskman/portfolio_site/blob/main/docs/admin-design-guide.md";

/** The address of a topic: `/help#id` (the router adds the language), or the admin guide anchor. */
export function helpHref(topic: HelpTopic): string {
  return helpScope(topic) === "admin" ? `${ADMIN_GUIDE}#${topic}` : `/help#${topic}`;
}
