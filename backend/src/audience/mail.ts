import { loadSettings } from "../announce/store.js";
import type { SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import type { Contact, Lang } from "./schemas.js";
import { expiresIn, signToken } from "./tokens.js";

const DAY = 86_400;
export const UNSUB_TTL_SECONDS = 3 * 365 * DAY;
export const MANAGE_TTL_SECONDS = 3 * 365 * DAY;

export const pageUrl = (path: string, token: string) => `${env.SITE_URL}${path}?token=${encodeURIComponent(token)}`;

export async function unsubscribeUrls(hash: string) {
  const token = await signToken({ t: "unsub", h: hash, exp: expiresIn(UNSUB_TTL_SECONDS) });
  return {
    page: pageUrl("/unsubscribe", token),
    /* RFC 8058 target: a POST with `List-Unsubscribe=One-Click`; the token rides in the query. */
    oneClick: `${env.SITE_URL}/api/subscribe/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}
export async function manageUrl(hash: string) {
  return pageUrl("/subscribe/manage", await signToken({ t: "manage", h: hash, exp: expiresIn(MANAGE_TTL_SECONDS) }));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const PLACEHOLDER = /\{(name|site|days|link)\}/g;

/**
 * Fills a template in ONE pass, so a value is never itself scanned for
 * placeholders. The html form escapes both the template's own text and every
 * value; only the link becomes markup, and it is built here from our own URL.
 */
export function fillTemplate(tpl: string, vars: Record<"name" | "site" | "days" | "link", string>, html: boolean): string {
  const out: string[] = [];
  let last = 0;
  for (const m of tpl.matchAll(PLACEHOLDER)) {
    const lit = tpl.slice(last, m.index);
    out.push(html ? esc(lit) : lit);
    const v = vars[m[1] as keyof typeof vars];
    out.push(html ? (m[1] === "link" ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)) : v);
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = tpl.slice(last);
  out.push(html ? esc(tail) : tail);
  return out.join("");
}

/* "Hi ," when a visitor gave no name reads badly: drop the gap before punctuation. */
const tidy = (s: string) => s.replace(/[ \t]+([,،])/g, "$1");

export function renderConfirmMail(contact: Pick<Contact, "name" | "lang">, link: string, sender: SenderSettings) {
  const lang: Lang = contact.lang;
  const subject = lang === "he" ? sender.confirmSubjectHe : sender.confirmSubjectEn;
  let tpl = lang === "he" ? sender.confirmBodyHe : sender.confirmBodyEn;
  // An owner edit that drops {link} must not produce a mail nobody can confirm.
  if (!tpl.includes("{link}")) tpl += "\n\n{link}";
  const site = new URL(env.SITE_URL).host;
  const vars = { name: contact.name?.trim() || (lang === "he" ? "" : "there"), site, days: String(sender.pendingTtlDays), link };
  const text = tidy(fillTemplate(tpl, vars, false));
  const body = tidy(fillTemplate(tpl, vars, true))
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<div dir="${lang === "he" ? "rtl" : "ltr"}" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55">${body}</div>`;
  return { subject: subject.replace(/[\r\n]+/g, " "), text, html };
}

/** Sends the double opt-in mail. Never throws and never logs the address. */
export async function sendConfirmMail(contact: Contact, hash: string): Promise<boolean> {
  try {
    const sender = (await loadSettings()).sender;
    const token = await signToken({ t: "confirm", h: hash, exp: expiresIn(sender.pendingTtlDays * DAY) });
    const mail = renderConfirmMail(contact, pageUrl("/subscribe/confirm", token), sender);
    const r = await emailService.sendTo({ to: contact.email, ...mail });
    if (!r.ok) logger.warn({ contact: hash, err: r.error }, "confirmation mail failed");
    return r.ok;
  } catch (err) {
    logger.warn({ contact: hash, err: err instanceof Error ? err.message : String(err) }, "confirmation mail failed");
    return false;
  }
}
