import type { AnnounceEvent } from "./schemas.js";
import type { Kit, KitItem } from "./kit.js";
import { renderMail, type MailBlock } from "../mail/render.js";

/*
 * The owner's announce mail, built as blocks for the mail design system
 * (../mail/render.ts), which escapes every value. URLs are SITE_URL plus a
 * validated slug, never raw input.
 */

export { esc } from "../mail/escape.js";

/** Same shape the OG route accepts for a file name (slugs and release tags). */
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function origin(siteUrl: string): string {
  const u = new URL(siteUrl);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("SITE_URL must be http(s)");
  return u.origin;
}

export function cardUrl(ev: Pick<AnnounceEvent, "kind" | "ref">, siteUrl: string): string | null {
  if (!SLUG.test(ev.ref)) return null;
  const kind = ev.kind === "release" ? "release" : "blog";
  return `${origin(siteUrl)}/api/seo/og/${kind}/${encodeURIComponent(ev.ref)}.png?format=og`;
}

export const adminUrl = (siteUrl: string) => `${origin(siteUrl)}/admin/announce`;

type Caption = { label: string; lang: "en" | "he"; item: KitItem };

const LABELS = { linkedin: "LinkedIn", x: "X", email: "Email" } as const;

function captions(kit: Kit): Caption[] {
  const out: Caption[] = [];
  for (const lang of ["en", "he"] as const) {
    const k = kit[lang];
    const pick: Array<[string, KitItem | undefined]> = [
      [LABELS.linkedin, k.linkedin],
      [LABELS.x, k.x],
      [LABELS.email, k.gmail ?? k.email],
    ];
    for (const [label, item] of pick) if (item) out.push({ label: lang === "he" ? `${label} (Hebrew)` : label, lang, item });
  }
  return out;
}

export function buildOwnerEmail(ev: AnnounceEvent, kit: Kit, siteUrl: string): { subject: string; html: string; text: string } {
  const subject = ev.kind === "release" ? `${ev.title} is out` : `New on the blog: ${ev.title}`;
  const img = cardUrl(ev, siteUrl);
  const admin = adminUrl(siteUrl);
  const kindLabel = ev.kind === "release" ? `New version${ev.version ? ` ${ev.version}` : ""}` : "New post";
  const heTitle = ev.titleHe && ev.titleHe !== ev.title ? ev.titleHe : "";

  const blocks: MailBlock[] = [
    { type: "paragraph", tone: "kicker", text: kindLabel },
    ...(img ? [{ type: "image" as const, src: img, alt: `Share card: ${ev.title}`, width: 552, height: 290, textLabel: "Card image" }] : []),
    { type: "heading", text: ev.title },
    ...(heTitle ? [{ type: "heading" as const, level: 2 as const, text: heTitle, lang: "he" as const }] : []),
    ...(ev.summary ? [{ type: "paragraph" as const, text: ev.summary }] : []),
    { type: "button", label: "Open the Announce inbox", href: admin },
    ...captions(kit).map((c): MailBlock => ({ type: "card", label: c.label, ...(c.item.limit === null ? {} : { meta: `${c.item.length}/${c.item.limit}${c.item.over ? " (over the limit)" : ""}` }), lines: c.item.text.split(/\r?\n/), lang: c.lang })),
    { type: "paragraph", tone: "muted", text: "Nothing is posted for you. Copy a caption, post it yourself, then mark it done in the inbox." },
  ];
  const { html, text } = renderMail(blocks, { lang: "en", title: subject, preheader: ev.summary || subject, origin: origin(siteUrl) });
  return { subject, html, text };
}
