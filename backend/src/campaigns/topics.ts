import { listRecipients } from "../audience/store.js";
import type { Contact, Lang, Topics } from "../audience/schemas.js";
import type { Block, Campaign, Topic } from "./schemas.js";

/*
 * Which of a campaign each person may get, by the topics they chose (issue #594).
 * The one rule for the sender, the audience counts and the schedule checks:
 *
 *  - a campaign with a `topic` goes only to people who have it on
 *  - an issue mixes topics, so each person gets only the blocks of theirs; with
 *    none of those left in their language they are not a recipient at all: no
 *    mail, no send doc, nothing off the budget or the monthly limit
 *  - an issue with no topic on any block (compiled before blocks carried one, or
 *    rewritten by hand) cannot be split, so it needs both topics on
 *
 * Blocks without a topic (intro, outro, anything the owner adds) go to everyone
 * who is a recipient.
 */
const SEPARATORS: ReadonlyArray<Block["type"]> = ["dot", "rule"];

/* The separators are made by the issue engine only, so they also mark a copy of an issue, which loses `kind`. */
const isIssue = (c: Pick<Campaign, "kind" | "blocks">) => c.kind === "issue" || Boolean(c.blocks?.some((b) => b.topic || SEPARATORS.includes(b.type)));

type Reader = { topics?: Topics; lang?: Lang };

/** The campaign as this person gets it, or null when they must not get it. */
export function viewFor<C extends Pick<Campaign, "kind" | "topic" | "subject" | "preheader" | "blocks" | "topicLines">>(c: C, reader: Reader): C | null {
  const on = (t: Topic) => reader.topics?.[t] === true;
  if (c.topic && !on(c.topic)) return null;
  if (!isIssue(c)) return c;
  if (!c.blocks?.some((b) => b.topic)) return on("blog") && on("releases") ? c : null;

  const lang = reader.lang ?? "en";
  const blocks: Block[] = [];
  let content = false;
  for (const b of c.blocks) {
    if (b.topic && !on(b.topic)) continue;
    const separator = SEPARATORS.includes(b.type);
    /* A section's rule only belongs between two sections that are both there. */
    if (b.type === "rule" && b.topic && !content) continue;
    if (b.topic && !separator && (!b.lang || b.lang === lang)) content = true;
    blocks.push(b);
  }
  if (blocks.length === c.blocks.length) return c;
  if (!content) return null;

  /* The compiled subject and preview line speak of the whole issue. A line the owner rewrote is theirs and stays. */
  const auto = c.topicLines;
  const only = on("blog") ? auto?.blog : auto?.releases;
  const subject = auto && only && c.subject === auto.subject ? only.subject : c.subject;
  /* With nothing to compare against (a copy), the preview line is left to the renderer, which reads it from the blocks that stayed. */
  const preheader = !auto ? undefined : c.preheader === auto.preheader ? only?.preheader : c.preheader;
  return { ...c, blocks, subject, preheader };
}

type Selection = Pick<Campaign, "groups" | "lang" | "topic" | "kind" | "blocks" | "subject" | "preheader" | "topicLines">;

/** Everyone this campaign would mail. */
export async function* recipientsOf(c: Selection): AsyncGenerator<Contact> {
  for await (const r of listRecipients({ groups: c.groups, ...(c.lang && c.lang !== "all" ? { lang: c.lang } : {}), ...(c.topic ? { topic: c.topic } : {}) })) {
    if (viewFor(c, r)) yield r;
  }
}
