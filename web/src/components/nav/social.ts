import { links, type LinkIcon } from "@/data/links";
import { contact } from "@/data/site";
import { GithubMark, LinkedinMark, MailMark, type Mark } from "./marks";

/*
 * The mark for each profile, as a total map rather than a lookup that can
 * miss. `Record<LinkIcon, Mark>` makes the compiler check that every icon name
 * the data file is allowed to hold has something to draw — the alternative, an
 * index into a plain object, hands back `undefined` for a new profile and
 * renders nothing at all inside a pill that still takes up its 44px.
 *
 * These used to be lucide glyphs. Why they are drawn paths now is in
 * `marks.tsx`: a logotype is not an icon of an idea, and at 19px its
 * silhouette is the only thing carrying it.
 */
const MARKS: Record<LinkIcon, Mark> = {
  Github: GithubMark,
  Linkedin: LinkedinMark,
};

export type Elsewhere = {
  key: string;
  href: string;
  /** The accessible name. These controls are mark-only; this is their only text. */
  label: string;
  Icon: Mark;
  /** Mail is not a navigation away from the site, so it is not given `target`. */
  external: boolean;
};

/*
 * The profiles, assembled from the data the site already holds rather than
 * restated here.
 *
 * `src/data/links.ts`, which the footer also renders — one list, so a profile
 * can never exist in the chrome and not in the footer.
 */
export const PROFILES: Elsewhere[] = links.map((l) => ({
  key: l.name,
  href: l.url,
  label: l.label,
  Icon: MARKS[l.icon],
  external: true,
}));

/*
 * The address, which the bar does not carry and the sheet does.
 *
 * It is here because the footer and the contact plate already read it from
 * `src/data/site.ts`, and deliberately not pushed into `links.ts`, because
 * that list is defined as outbound profiles and the footer prints it with an
 * "opens elsewhere" arrow that a mailto: should not get.
 *
 * Why the bar leaves it out, now that the bar has an index: the inquiry plate
 * is an object in that index, two items from the end, and it is a form. A
 * mailto beside it is a second answer to "how do I reach him" sitting a
 * hundred pixels from the first, and it is the worse one — it hands the
 * reader's own mail client a blank message. The sheet still lists it, because
 * on a phone a mailto is the one of the two that opens an app the reader
 * already has.
 */
export const EMAIL: Elsewhere = {
  key: "email",
  href: `mailto:${contact.email}`,
  label: "Email",
  Icon: MailMark,
  external: false,
};

/** Everything off-site, for the sheet. The bar carries `PROFILES` only. */
export const ELSEWHERE: Elsewhere[] = [...PROFILES, EMAIL];
