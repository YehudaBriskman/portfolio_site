import { esc, escMulti, oneLine } from "./escape.js";
import { safeHref, safeImage, siteOrigin } from "./urls.js";

/*
 * The mail design system: blocks in, one email-client-safe page and its
 * plain-text twin out. Table layout and inline styles at 600 px, system fonts,
 * no script, form, remote font or stylesheet, no tracking pixel, no redirecting
 * links. Every dynamic value goes through `esc` (./escape.ts) and every URL
 * through `safeHref` / `safeImage`; nothing else writes markup from data.
 *
 * Direction: <html lang dir> carries the mail's language. Text elements are
 * left to the browser's `dir="auto"` where the content may be mixed, and never
 * get an explicit text-align, so alignment follows the direction everywhere.
 */

export type MailLang = "en" | "he";
export type MailTheme = "auto" | "light" | "dark";
/** Plain text, or a link whose visible text is `text`. */
export type Inline = string | { href: string; text: string };

export type MailBlock =
  | { type: "heading"; text: string; level?: 1 | 2; lang?: MailLang }
  /* kicker = the small label above a title; strong = a bold line (the advertisement label); muted = secondary text. */
  /* htmlOnly = shown in the page, left out of the plain-text twin (a link the text already carries). */
  | { type: "paragraph"; text: string | Inline[]; tone?: "normal" | "strong" | "muted" | "kicker"; lang?: MailLang; htmlOnly?: boolean }
  | { type: "button"; label: string; href: string }
  | { type: "list"; items: string[] }
  /* A labelled box of lines the reader copies from (captions); each line is its own direction unit. */
  | { type: "card"; label?: string; meta?: string; lines: string[]; lang?: MailLang }
  /* Only from the site's own origin; alt text and a width are required. Without a height the image scales by its width. */
  | { type: "image"; src: string; alt: string; width: number; height?: number; textLabel?: string }
  /* The owner's handwritten signature: a dark-ink PNG, and a light-ink one a dark-mode client swaps in. Own origin only, alt and size required. */
  | { type: "signature"; src: string; srcDark?: string; alt: string; width: number; height: number }
  | { type: "divider" }
  /* Who sent it and how to reach them (lines), then the note with the unsubscribe link. */
  | { type: "footer"; lines: string[]; note?: Inline[]; extra?: Inline[][] };

export type RenderOptions = {
  lang: MailLang;
  /** auto = light with a prefers-color-scheme dark block (what is sent); light / dark force one palette (the gallery). */
  theme?: MailTheme;
  /** The <title> and the hidden preview line; neither is shown in the body. */
  title?: string;
  preheader?: string;
  /** Images must come from this origin (default: the public site). */
  origin?: string;
};

export type RenderedMailPage = { html: string; text: string; bytes: number; oversize: boolean };

/** Gmail clips a message above about 102 KB of HTML. */
export const MAIL_HTML_LIMIT = 100 * 1024;

export const PALETTE = {
  light: { page: "#ECE8DC", card: "#FBFAF6", box: "#F1EDE0", ink: "#14130F", soft: "#55524A", rule: "#CFC9B8", link: "#1D4ED8", btn: "#14130F", btnInk: "#FFFFFF" },
  dark: { page: "#1C1A16", card: "#282520", box: "#34302A", ink: "#F2F0EA", soft: "#B5B1A6", rule: "#4A453C", link: "#7AA2E8", btn: "#F2F0EA", btnInk: "#14130F" },
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans Hebrew','Arial Hebrew',sans-serif";
const dirOf = (l: MailLang) => (l === "he" ? "rtl" : "ltr");
/* Attribute pair for a block whose language differs from the mail's. */
const langAttrs = (l: MailLang | undefined, root: MailLang) => (l && l !== root ? ` dir="${dirOf(l)}" lang="${l}"` : "");
const dim = (n: number, max: number) => Math.max(1, Math.min(max, Math.round(Number.isFinite(n) ? n : max)));

const inlineHtml = (parts: string | Inline[], link: string): string =>
  typeof parts === "string"
    ? escMulti(parts)
    : parts
        .map((p) => {
          if (typeof p === "string") return escMulti(p);
          const href = safeHref(p.href);
          return href ? `<a href="${esc(href)}" class="lnk" style="color:${link};text-decoration:underline">${esc(p.text)}</a>` : esc(p.text);
        })
        .join("");

const inlineText = (parts: string | Inline[]): string =>
  typeof parts === "string"
    ? parts
    : parts
        .map((p) => {
          if (typeof p === "string") return p;
          const href = safeHref(p.href);
          return !href ? p.text : p.text === href || p.text === p.href ? href : `${p.text} (${href})`;
        })
        .join("");

function rowOf(inner: string, card: string, root: MailLang, o: { top?: number; bottom?: number } = {}): string {
  return `<tr><td class="card" dir="${dirOf(root)}" bgcolor="${card}" style="background-color:${card};overflow-wrap:break-word;word-break:break-word;padding:${o.top ?? 0}px 24px ${o.bottom ?? 16}px 24px">${inner}</td></tr>`;
}

type Pal = (typeof PALETTE)["light"] | (typeof PALETTE)["dark"];
function renderBlock(b: MailBlock, root: MailLang, origin: string, L: Pal): { html: string; text: string } {
  const row = (inner: string, o: { top?: number; bottom?: number } = {}) => rowOf(inner, L.card, root, o);
  switch (b.type) {
    case "heading": {
      const size = b.level === 2 ? 20 : 24;
      return {
        html: row(`<h${b.level === 2 ? 2 : 1} class="ink" dir="auto"${langAttrs(b.lang, root)} style="margin:0;font-size:${size}px;line-height:1.3;font-weight:700;color:${L.ink}">${esc(b.text)}</h${b.level === 2 ? 2 : 1}>`),
        text: b.text,
      };
    }
    case "paragraph": {
      const tone = b.tone ?? "normal";
      const style =
        tone === "kicker"
          ? `margin:0;font-size:13px;line-height:1.4;font-weight:700;color:${L.soft}${root === "en" ? ";letter-spacing:.06em;text-transform:uppercase" : ""}`
          : tone === "muted"
            ? `margin:0;font-size:14px;line-height:1.5;color:${L.soft}`
            : `margin:0;font-size:16px;line-height:1.5;color:${L.ink}${tone === "strong" ? ";font-weight:700" : ""}`;
      return {
        html: row(`<p class="${tone === "normal" || tone === "strong" ? "ink" : "soft"}" dir="auto"${langAttrs(b.lang, root)} style="${style}">${inlineHtml(b.text, L.link)}</p>`),
        text: b.htmlOnly ? "" : inlineText(b.text),
      };
    }
    case "button": {
      const href = safeHref(b.href);
      if (!href) return { html: row(`<p class="ink" dir="auto" style="margin:0;font-size:16px;line-height:1.5;color:${L.ink}">${esc(b.label)}</p>`), text: b.label };
      return {
        html: row(
          `<table role="presentation" dir="${dirOf(root)}" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" bgcolor="${L.btn}" height="44" style="background-color:${L.btn};border-radius:8px"><a class="btna" href="${esc(href)}" style="display:inline-block;min-height:20px;padding:12px 24px;font-size:16px;line-height:20px;font-weight:700;color:${L.btnInk};text-decoration:none">${esc(b.label)}</a></td></tr></table>`,
          { top: 4, bottom: 20 },
        ),
        text: `${b.label}: ${href}`,
      };
    }
    case "list":
      return {
        html: row(`<ul class="ink" style="margin:0;padding:0;padding-${root === "he" ? "right" : "left"}:22px;padding-inline-start:22px;font-size:16px;line-height:1.5;color:${L.ink}">${b.items.map((i) => `<li dir="auto" style="margin:0 0 4px 0">${esc(i)}</li>`).join("")}</ul>`),
        text: b.items.map((i) => `- ${i}`).join("\n"),
      };
    case "card": {
      const lines = b.lines.map((l) => `<div dir="auto" style="min-height:1.55em;">${l ? esc(l) : "&nbsp;"}</div>`).join("");
      return {
        html: row(
          (b.label ? `<div class="soft" style="margin:0 0 6px 0;font-size:13px;line-height:1.4;font-weight:700;color:${L.soft}">${esc(b.label)}${b.meta ? ` &middot; ${esc(b.meta)}` : ""}</div>` : "") +
            `<div class="box ink"${langAttrs(b.lang, root)} style="font-size:15px;line-height:1.55;color:${L.ink};background-color:${L.box};border:1px solid ${L.rule};border-radius:8px;padding:12px 14px">${lines}</div>`,
        ),
        text: `${b.label ? `${b.label}:\n` : ""}${b.lines.join("\n")}`,
      };
    }
    case "image": {
      const src = safeImage(b.src, origin);
      if (!src) return { html: "", text: "" };
      const w = dim(b.width, 552);
      const size = `width="${w}"${b.height ? ` height="${dim(b.height, 4000)}"` : ""}`;
      return {
        html: row(`<img src="${esc(src)}" alt="${esc(b.alt)}" ${size} style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:6px">`),
        text: `${b.textLabel ?? b.alt}: ${src}`,
      };
    }
    case "signature": {
      const abs = (u: string) => safeImage(new URL(u, origin).href, origin);
      const src = abs(b.src);
      if (!src) return { html: "", text: "" };
      const dark = b.srcDark ? abs(b.srcDark) : null;
      const w = dim(b.width, 480);
      const h = dim(b.height, 240);
      /* Dark ink on a light card by default; a client that honours prefers-color-scheme swaps to the light-ink file. */
      const img = (cls: string, s: string, hidden: boolean) =>
        `<img class="${cls}" src="${esc(s)}" alt="${esc(b.alt)}" width="${w}" height="${h}" style="${hidden ? "display:none;" : "display:block;"}width:${w}px;max-width:100%;height:auto;border:0">`;
      const forcedDark = L === PALETTE.dark && !!dark;
      return { html: row(img("sig-l", src, forcedDark) + (dark ? img("sig-d", dark, !forcedDark) : "")), text: b.alt };
    }
    case "divider":
      return { html: row(`<div class="rule" style="border-top:1px solid ${L.rule};font-size:1px;line-height:1px;height:1px">&nbsp;</div>`), text: "--" };
    case "footer": {
      const lines = b.lines.map((l) => l.trim()).filter(Boolean);
      const note = b.note?.length ? `<p class="soft" dir="auto" style="margin:0;font-size:13px;line-height:1.5;color:${L.soft}">${inlineHtml(b.note, L.link)}</p>` : "";
      const extra = (b.extra ?? []).map((n) => `<p class="soft" dir="auto" style="margin:8px 0 0 0;font-size:13px;line-height:1.5;color:${L.soft}">${inlineHtml(n, L.link)}</p>`).join("");
      const html = row(
        `<div class="rule" style="border-top:1px solid ${L.rule};padding-top:14px">` +
          (lines.length ? `<p class="soft" style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:${L.soft}">${lines.map((l) => `<bdi>${escMulti(l)}</bdi>`).join("<br>")}</p>` : "") +
          note +
          extra +
          `</div>`,
        { top: 12, bottom: 24 },
      );
      const text = ["--", ...lines].join("\n") + "\n" + [b.note ? inlineText(b.note) : "", ...(b.extra ?? []).map(inlineText)].filter(Boolean).join("\n\n");
      return { html, text: text.trimEnd() };
    }
  }
}

function css(theme: MailTheme, sig = false): string {
  const D = PALETTE.dark;
  const dark = `.page{background-color:${D.page} !important}.card{background-color:${D.card} !important}.ink{color:${D.ink} !important}.soft{color:${D.soft} !important}.lnk{color:${D.link} !important}.box{background-color:${D.box} !important;border-color:${D.rule} !important;color:${D.ink} !important}.rule{border-color:${D.rule} !important}.btn{background-color:${D.btn} !important}.btna{color:${D.btnInk} !important}${sig ? ".sig-l{display:none !important}.sig-d{display:block !important}" : ""}`;
  const scheme = theme === "light" ? "light" : theme === "dark" ? "dark" : "light dark";
  return `:root{color-scheme:${scheme};supported-color-schemes:${scheme}}body{margin:0;padding:0;-webkit-text-size-adjust:100%}table{border-collapse:collapse}img{-ms-interpolation-mode:bicubic}` + (theme === "auto" ? `@media (prefers-color-scheme: dark){${dark}}` : "");
}

/** Blocks to a complete mail page and its plain-text twin. */
export function renderMail(blocks: MailBlock[], opts: RenderOptions): RenderedMailPage {
  const { lang } = opts;
  const theme = opts.theme ?? "auto";
  const origin = opts.origin ?? siteOrigin();
  const P = theme === "dark" ? PALETTE.dark : PALETTE.light;
  const parts = blocks.map((b) => renderBlock(b, lang, origin, P));
  /* A forced dark mail writes the dark palette into the inline styles, so it also survives a client that ignores <style>. */
  const dir = dirOf(lang);
  const pre = opts.preheader?.trim();
  const body = `<body class="page" dir="${dir}" bgcolor="${P.page}" style="margin:0;padding:0;background-color:${P.page};font-family:${FONT}">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${P.page}">${esc(pre)}${"&#8204;&nbsp;".repeat(30)}</div>` : ""}
<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" bgcolor="${P.page}" style="background-color:${P.page}"><tr><td align="center" dir="${dir}" style="padding:16px 8px">
<table role="presentation" dir="${dir}" width="600" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="${P.card}" style="width:100%;max-width:600px;table-layout:fixed;background-color:${P.card};border-radius:10px;font-family:${FONT}">
<tr><td class="card" dir="${dir}" bgcolor="${P.card}" height="24" style="height:24px;line-height:24px;font-size:1px;background-color:${P.card};border-radius:10px 10px 0 0">&nbsp;</td></tr>
${parts.map((p) => p.html).filter(Boolean).join("\n")}
</table></td></tr></table></body>`;
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="color-scheme" content="${theme === "auto" ? "light dark" : theme}"><meta name="supported-color-schemes" content="${theme === "auto" ? "light dark" : theme}">
<title>${esc(oneLine(opts.title ?? ""))}</title>
<style>${css(theme, blocks.some((b) => b.type === "signature"))}</style></head>
${body}</html>`;
  const text = parts.map((p) => p.text).filter(Boolean).join("\n\n");
  const bytes = Buffer.byteLength(html, "utf8");
  return { html, text, bytes, oversize: bytes > MAIL_HTML_LIMIT };
}
