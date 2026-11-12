import type { Block, CampaignLang } from "@/services/adminCampaigns";
import type { SenderSettings } from "@/services/adminAnnounce";

/*
 * A client-side twin of backend/src/campaigns/render.ts + body.ts.
 *
 * The server has no preview route for a draft (only the test send renders the
 * real mail), so the preview is drawn here from the same inputs with the same
 * escaping and the same markup. It is labelled as a preview in the UI and the
 * test send stays the proof. If render.ts changes, change this with it; the
 * markup is deliberately a copy, not a reinterpretation.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const multi = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
export const COMMERCIAL_LABEL_HE = "פרסומת";

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
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/** Blank lines separate paragraphs; a single newline is a line break. */
export const paragraphs = (text: string): Block[] =>
  text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((text) => ({ type: "p" as const, text }));

const row = (inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 14px 0">${inner}</td></tr></table>`;

function block(b: Block): string {
  switch (b.type) {
    case "p":
      return row(`<p dir="auto" style="margin:0">${multi(b.text)}</p>`);
    case "h2":
      return row(`<h2 dir="auto" style="margin:0;font-size:20px;line-height:1.3">${esc(b.text)}</h2>`);
    case "ul":
      return row(`<ul style="margin:0;padding-inline-start:22px">${b.items.map((i) => `<li dir="auto">${esc(i)}</li>`).join("")}</ul>`);
    case "cta": {
      const href = safeHref(b.url);
      const label = esc(b.label || b.url);
      return href
        ? row(`<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px">${label}</a>`)
        : row(`<p dir="auto" style="margin:0">${label}</p>`);
    }
    case "image": {
      const src = safeImage(b.url);
      return src ? row(`<img src="${esc(src)}" alt="${esc(b.text ?? "")}" style="max-width:100%;height:auto;border:0">`) : "";
    }
  }
}

/** The plain-text twin of a block list: what the text part of the mail says. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "p":
        case "h2":
          return b.text;
        case "ul":
          return b.items.map((i) => `- ${i}`).join("\n");
        case "cta":
          return `${b.label}: ${b.url}`;
        case "image":
          return b.text ?? "";
      }
    })
    .filter((t) => t.trim())
    .join("\n\n");
}

/** A block the server would refuse (empty text, a link that is not http(s)/mailto). */
export function blockProblem(b: Block): "empty" | "link" | "image" | null {
  switch (b.type) {
    case "p":
    case "h2":
      return b.text.trim() ? null : "empty";
    case "ul":
      return b.items.some((i) => i.trim()) ? null : "empty";
    case "cta":
      return !b.label.trim() ? "empty" : safeHref(b.url) ? null : "link";
    case "image":
      return safeImage(b.url) ? null : "image";
  }
}

export type PreviewInput = { subject: string; preheader: string; bodyText: string; blocks: Block[] | null };

const fill = (tpl: string, vars: { site: string; link: string }, html: boolean) =>
  tpl.replace(/\{(name|site|days|link)\}/g, (_, k: string) => {
    const v = k === "site" ? vars.site : k === "link" ? vars.link : "";
    return html ? (k === "link" ? `<a href="#">${esc(v)}</a>` : esc(v)) : v;
  });

export function previewMail(c: PreviewInput, lang: Exclude<CampaignLang, "all">, sender: SenderSettings, site: string) {
  const he = lang === "he";
  const label = he && sender.commercialLabel;
  const note = he ? sender.unsubscribeNoteHe : sender.unsubscribeNoteEn;
  const identity = sender.footerIdentity.trim();
  const link = `${site}/unsubscribe`;
  const subject = `${label ? `${COMMERCIAL_LABEL_HE}: ` : ""}${c.subject.replace(/[\r\n]+/g, " ").trim()}`;
  const body = (c.blocks?.length ? c.blocks : paragraphs(c.bodyText)).map(block).join("");
  const pre = c.preheader.trim();
  const html =
    `<div dir="${he ? "rtl" : "ltr"}" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55">` +
    (pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>` : "") +
    body +
    `<hr style="border:0;border-top:1px solid #d9d9d9;margin:28px 0 14px"><div style="font-size:12px;line-height:1.5;color:#6b6b6b">` +
    (label ? `<p style="margin:0 0 8px">${COMMERCIAL_LABEL_HE}</p>` : "") +
    (identity ? `<p style="margin:0 0 8px">${multi(identity)}</p>` : "") +
    `<p style="margin:0">${fill(note, { site, link }, true)}</p></div></div>`;
  const text = `${(c.blocks?.length ? blocksToText(c.blocks) : c.bodyText).trim()}\n\n--\n${label ? `${COMMERCIAL_LABEL_HE}\n` : ""}${identity ? `${identity}\n` : ""}${fill(note, { site, link }, false)}`;
  return { subject, html, text };
}

/* ------------------------------------------------------------ time zones */

/** The UTC instant of a wall-clock time ("YYYY-MM-DDTHH:mm") in an IANA zone, as an ISO string; null if it does not parse. */
export function zonedToIso(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(new Date(t))
        .map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  };
  let t = guess - offset(guess);
  t = guess - offset(t);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
