import type { MailBlock } from "../mail/render.js";
import { safeHref, safeImage } from "../mail/urls.js";
import type { Block } from "./schemas.js";

/*
 * The email body is built here from plain text and a few block types; the
 * client never supplies HTML. The blocks become design-system blocks
 * (../mail/render.ts), which escape every field and validate every URL.
 */
export { safeHref, safeImage };

/** Blank lines separate paragraphs; a single newline is a line break. */
export const paragraphs = (text: string): Block[] =>
  text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((text) => ({ type: "p" as const, text }));

function toMail(b: Block): MailBlock {
  const lang = b.lang ? { lang: b.lang } : {};
  switch (b.type) {
    case "p":
      return { type: "paragraph", text: b.text ?? "", ...(b.tone ? { tone: b.tone } : {}), ...lang };
    case "h2":
      return { type: "heading", level: 2, text: b.text ?? "", ...lang };
    case "ul":
      return { type: "list", items: b.items ?? [], ...lang };
    case "cta":
      return { type: "button", label: b.label || b.text || b.url || "", href: b.url ?? "", ...(b.outline ? { outline: true } : {}) };
    case "facts":
      return { type: "facts", rows: b.rows ?? [], ...lang };
    case "dot":
      return { type: "dot" };
    case "rule":
      return { type: "divider" };
    case "image":
      return { type: "image", src: b.url ?? "", alt: b.text ?? "", width: 552 };
  }
}

/**
 * Blocks tagged with a language go only to recipients of that language; untagged
 * blocks go to everyone. (An issue tags the English and Hebrew copy of an item
 * with their language and leaves an untranslated item untagged.) Passing no
 * language keeps every block, as the preview of a mixed draft does.
 */
export const blocksFor = (blocks: Block[], lang?: "en" | "he"): Block[] => (lang ? blocks.filter((b) => !b.lang || b.lang === lang) : blocks);

export const bodyBlocks = (c: { bodyText: string; blocks?: Block[] }, lang?: "en" | "he"): MailBlock[] => blocksFor(c.blocks?.length ? c.blocks : paragraphs(c.bodyText), lang).map(toMail);
