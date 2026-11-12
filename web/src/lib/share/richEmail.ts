import { safeOrigin } from "./urls";

/*
 * A formatted block for pasting into a mail composer: the card, the title, the
 * summary and a button-style link, as `text/html` plus a `text/plain` twin.
 *
 * Pure, no DOM: every field is escaped as text before it goes into markup, and
 * the two addresses must sit on the site's own origin, so a caller cannot make
 * it link or load from anywhere else. The markup is what mail clients agree
 * on: nested tables with presentation roles, inline CSS only, system fonts, no
 * script, no <style>, no external fonts, and a "bulletproof" button (a padded
 * link inside a coloured cell) because Outlook ignores padding on a bare link.
 *
 * The owner-announcement email on the server wants the same idea; it is a
 * separate copy there, not an import across web and backend.
 */

export type RichEmailInput = {
  title: string;
  summary?: string;
  /** The entity's address. Must be on `origin`. */
  url: string;
  /** The card's address. Must be on `origin`; left out when it is not. */
  image?: string;
  /** The site origin, from the page. */
  origin: string;
  /** Further origins the link (never the card) may point at, e.g. a release's GitHub page. */
  linkOrigins?: string[];
  /** The button's words. */
  buttonLabel: string;
  /** The card's alternative text; defaults to the title. */
  imageAlt?: string;
  dir?: "ltr" | "rtl";
};

export type RichEmail = { html: string; text: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text for an element body or a quoted attribute. Control characters become spaces. */
export function escapeHtml(input: string | undefined | null): string {
  // eslint-disable-next-line no-control-regex
  return (input ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** The address as the URL parser writes it, or null when it is not on the origin. */
function onOrigin(address: string | undefined, origin: string): string | null {
  if (!address) return null;
  try {
    const u = new URL(address);
    return u.origin === origin ? u.href : null;
  } catch {
    return null;
  }
}

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const WIDTH = 600;

export function buildRichEmail(input: RichEmailInput): RichEmail {
  const origin = safeOrigin(input.origin);
  const url = [origin, ...(input.linkOrigins ?? []).map(safeOrigin)].map((o) => onOrigin(input.url, o)).find(Boolean) ?? null;
  if (!url) throw new RangeError("share: the link must be on the site origin");
  const image = onOrigin(input.image, origin);
  const dir = input.dir ?? "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const title = input.title.replace(/\s+/g, " ").trim();
  const summary = (input.summary ?? "").replace(/\s+/g, " ").trim();

  const cell = (style: string, inner: string) => `<tr><td style="${style}">${inner}</td></tr>`;
  const rows = [
    image
      ? `<tr><td style="padding:0;font-size:0;line-height:0"><a href="${escapeHtml(url)}" style="text-decoration:none"><img src="${escapeHtml(image)}" width="${WIDTH}" alt="${escapeHtml(input.imageAlt ?? title)}" style="display:block;width:100%;max-width:${WIDTH}px;height:auto;border:0;outline:none"></a></td></tr>`
      : "",
    cell(`padding:20px 24px 8px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:#1c1a16;text-align:${align}`, escapeHtml(title)),
    summary ? cell(`padding:0 24px 16px;font-family:${FONT};font-size:16px;line-height:1.5;color:#3d3a33;text-align:${align}`, escapeHtml(summary)) : "",
    cell(
      `padding:4px 24px 24px;text-align:${align}`,
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#1c1a16" style="border-radius:999px;background-color:#1c1a16"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(input.buttonLabel)}</a></td></tr></table>`,
    ),
  ].join("");

  const html =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}"><tr><td align="center" style="padding:0">` +
    `<table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${WIDTH}px;background-color:#ffffff;border:1px solid #e3dfd3">` +
    rows +
    `</table></td></tr></table>`;

  const text = [title, summary, url].filter(Boolean).join("\n\n");
  return { html, text };
}
