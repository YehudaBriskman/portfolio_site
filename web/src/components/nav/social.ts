import { Github, Linkedin, Mail, type LucideIcon } from "lucide-react";
import { links, type LinkIcon } from "@/data/links";
import { contact } from "@/data/site";

/*
 * The glyph for each profile, as a total map rather than a lookup that can
 * miss. `Record<LinkIcon, LucideIcon>` makes the compiler check that every
 * icon name the data file is allowed to hold has something to draw — the
 * alternative, an index into a plain object, hands back `undefined` for a new
 * profile and renders nothing at all in a button that still takes up 44px.
 */
const GLYPHS: Record<LinkIcon, LucideIcon> = {
  Github,
  Linkedin,
};

export type Elsewhere = {
  key: string;
  href: string;
  /** The accessible name. These buttons are icon-only; this is their only text. */
  label: string;
  Icon: LucideIcon;
  /** Mail is not a navigation away from the site, so it is not given `target`. */
  external: boolean;
};

/*
 * Everything the left island points at, assembled from the data the site
 * already holds rather than restated here.
 *
 * The profiles come from `src/data/links.ts`, which the footer also renders —
 * one list, so a profile can never exist in the chrome and not in the footer.
 * The address comes from `src/data/site.ts`, which is where the contact
 * section and the footer already read it from; it is deliberately not pushed
 * into `links.ts`, because that list is defined as outbound profiles and the
 * footer prints it with an "opens elsewhere" arrow that a mailto: should not
 * get.
 */
export const ELSEWHERE: Elsewhere[] = [
  ...links.map((l) => ({
    key: l.name,
    href: l.url,
    label: l.label,
    Icon: GLYPHS[l.icon],
    external: true,
  })),
  { key: "email", href: `mailto:${contact.email}`, label: "Email", Icon: Mail, external: false },
];
