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
  switch (b.type) {
    case "p":
      return { type: "paragraph", text: b.text ?? "" };
    case "h2":
      return { type: "heading", level: 2, text: b.text ?? "" };
    case "ul":
      return { type: "list", items: b.items ?? [] };
    case "cta":
      return { type: "button", label: b.label || b.text || b.url || "", href: b.url ?? "" };
    case "image":
      return { type: "image", src: b.url ?? "", alt: b.text ?? "", width: 552 };
  }
}

export const bodyBlocks = (c: { bodyText: string; blocks?: Block[] }): MailBlock[] => (c.blocks?.length ? c.blocks : paragraphs(c.bodyText)).map(toMail);
