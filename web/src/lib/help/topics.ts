import { pathIn } from "@/i18n/routing";
import type { Lang } from "@/components/dashboard/i18n";

/*
 * The help page's outcome entries: one anchor per thing a visitor can be told
 * after an action. This list is the contract between the help page and
 * whatever links to it (a toast, an error's details): a link is built with
 * `helpHref`, and a test fails when a link names a topic that is not here, or
 * when a topic here has no entry on the page in both languages.
 *
 * The ids are addresses (`/help#contact-send-failed`), so they never change
 * once published; add a topic, do not rename one. The words are in
 * i18n/help.ts, typed by this list so a topic cannot be added without them.
 *
 * `kind` is "ok" for an outcome that needs nothing from the visitor and
 * "problem" for one that does; only a problem is followed by where to write.
 */

export type HelpGroup = "contact" | "newsletter" | "share";
export type HelpKind = "ok" | "problem";

export const HELP_GROUPS = ["contact", "newsletter", "share"] as const satisfies readonly HelpGroup[];

export const HELP_TOPICS = {
  /* The contact form. */
  "contact-sent": { group: "contact", kind: "ok" },
  "contact-fields-invalid": { group: "contact", kind: "problem" },
  "contact-send-failed": { group: "contact", kind: "problem" },
  "contact-too-many": { group: "contact", kind: "problem" },
  "contact-too-long": { group: "contact", kind: "problem" },
  "contact-offline": { group: "contact", kind: "problem" },
  /* Subscribing, and the pages an email links to. */
  "newsletter-check-email": { group: "newsletter", kind: "ok" },
  "newsletter-already-subscribed": { group: "newsletter", kind: "ok" },
  "newsletter-fields-invalid": { group: "newsletter", kind: "problem" },
  "newsletter-too-many": { group: "newsletter", kind: "problem" },
  "newsletter-try-again": { group: "newsletter", kind: "problem" },
  "confirm-done": { group: "newsletter", kind: "ok" },
  "confirm-expired": { group: "newsletter", kind: "problem" },
  "confirm-already-used": { group: "newsletter", kind: "ok" },
  "unsubscribe-done": { group: "newsletter", kind: "ok" },
  "unsubscribe-link-problem": { group: "newsletter", kind: "problem" },
  "manage-saved": { group: "newsletter", kind: "ok" },
  "manage-link-problem": { group: "newsletter", kind: "problem" },
  "manage-choose-topic": { group: "newsletter", kind: "problem" },
  "manage-save-failed": { group: "newsletter", kind: "problem" },
  /* Sharing and copying. */
  "share-link-copied": { group: "share", kind: "ok" },
  "share-copy-failed": { group: "share", kind: "problem" },
  "share-save-failed": { group: "share", kind: "problem" },
} as const satisfies Record<string, { group: HelpGroup; kind: HelpKind }>;

export type HelpTopic = keyof typeof HELP_TOPICS;

export const helpTopics = Object.keys(HELP_TOPICS) as HelpTopic[];

export const isHelpTopic = (s: string): s is HelpTopic => Object.hasOwn(HELP_TOPICS, s);

/** The address of a topic in a language: (`contact-sent`, `he`) is `/he/help#contact-sent`. */
export const helpHref = (topic: HelpTopic, lang: Lang): string => `${pathIn("/help", lang)}#${topic}`;
