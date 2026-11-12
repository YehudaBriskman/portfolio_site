import { env } from "../env.js";
import { esc } from "../announce/emailHtml.js";
import type { Block } from "./schemas.js";

/*
 * The email body is RENDERED here from plain text and a few block types; the
 * client never supplies HTML. Every field goes through the one `esc`, links
 * are http(s)/mailto parsed with `new URL`, images are https on the site's own
 * origin.
 */

/** The normalised href when `raw` is http(s) or mailto, else null. */
export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "https:" || u.protocol === "http:") return u.username || u.password ? null : u.href;
    return u.protocol === "mailto:" ? u.href : null;
  } catch {
    return null;
  }
}
export function safeImage(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.origin === new URL(env.SITE_URL).origin && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/** Blank lines separate paragraphs; a single newline is a line break. */
export const paragraphs = (text: string): Block[] =>
  text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((text) => ({ type: "p" as const, text }));

const row = (inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 14px 0">${inner}</td></tr></table>`;
const multi = (s: string) => esc(s).replace(/\r?\n/g, "<br>");

function block(b: Block): string {
  switch (b.type) {
    case "p":
      return row(`<p dir="auto" style="margin:0">${multi(b.text ?? "")}</p>`);
    case "h2":
      return row(`<h2 dir="auto" style="margin:0;font-size:20px;line-height:1.3">${esc(b.text ?? "")}</h2>`);
    case "ul":
      return row(`<ul style="margin:0;padding-inline-start:22px">${(b.items ?? []).map((i) => `<li dir="auto">${esc(i)}</li>`).join("")}</ul>`);
    case "cta": {
      const href = safeHref(b.url ?? "");
      const label = esc(b.label || b.text || b.url || "");
      return href
        ? row(`<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px">${label}</a>`)
        : row(`<p dir="auto" style="margin:0">${label}</p>`);
    }
    case "image": {
      const src = safeImage(b.url ?? "");
      return src ? row(`<img src="${esc(src)}" alt="${esc(b.text ?? "")}" style="max-width:100%;height:auto;border:0">`) : "";
    }
  }
}

export const renderBody = (c: { bodyText: string; blocks?: Block[] }): string => (c.blocks?.length ? c.blocks : paragraphs(c.bodyText)).map(block).join("");
