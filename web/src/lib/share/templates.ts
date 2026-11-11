import type { ShareAudience, ShareChannel, ShareKind, ShareLocale, ShareSettingsInput } from "./types";

/*
 * Default captions. A template is plain text with {title} {summary} {url}
 * {tags} {version} {site}. For email and Gmail the first line is the subject
 * and the rest is the body.
 */

const LEAD: Record<ShareLocale, { visitor: string; owner: Partial<Record<ShareKind, string>> & { post: string } }> = {
  en: {
    visitor: "Look what I found: {title}",
    owner: {
      post: "New on the blog: {title}",
      project: "New project: {title}",
      story: "My story: {title}",
      home: "{title}",
      release: "{title} {version} is out",
    },
  },
  he: {
    visitor: "מצאתי משהו שכדאי לראות: {title}",
    owner: {
      post: "חדש בבלוג: {title}",
      project: "פרויקט חדש: {title}",
      story: "הסיפור שלי: {title}",
      home: "{title}",
      release: "יצאה גרסה {version} של {title}",
    },
  },
};

const NATIVE_VISITOR_RELEASE: Record<ShareLocale, string> = {
  en: "Look what I found: {title} {version}",
  he: "מצאתי משהו שכדאי לראות: {title} {version}",
};

function lead(audience: ShareAudience, kind: ShareKind, locale: ShareLocale): string {
  const l = LEAD[locale];
  if (audience === "visitor") return kind === "release" ? NATIVE_VISITOR_RELEASE[locale] : l.visitor;
  const k = kind === "note" ? "post" : kind === "area" ? "post" : kind;
  return l.owner[k] ?? l.owner.post;
}

/** The template for one case: the settings' override when there is one, else the default. */
export function templateFor(
  audience: ShareAudience,
  kind: ShareKind,
  locale: ShareLocale,
  channel: ShareChannel,
  settings?: Pick<Partial<ShareSettingsInput>, "templates">,
): string {
  // Settings templates are the visitor menu's; the owner's captions are edited in the Announce page.
  const custom = audience === "visitor" ? settings?.templates?.[locale]?.[channel] : undefined;
  if (typeof custom === "string" && custom.trim() !== "") return custom;

  const head = lead(audience, kind, locale);
  switch (channel) {
    case "copy":
      return audience === "visitor" ? "{url}" : `${head}\n\n{url}`;
    case "native":
      return head;
    case "x":
      return `${head}\n\n{url}`;
    case "whatsapp":
      return `${head}\n{url}`;
    case "email":
    case "gmail":
      return `${head}\n\n{summary}\n\n{url}`;
    case "linkedin":
    case "instagram":
      return `${head}\n\n{summary}\n\n{tags}\n\n{url}`;
  }
}
