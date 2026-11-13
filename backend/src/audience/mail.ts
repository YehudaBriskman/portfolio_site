import { loadSettings } from "../announce/store.js";
import { contactLines, type SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import type { Contact, Lang } from "./schemas.js";
import { oneLine } from "../mail/escape.js";
import { renderMail, type Inline, type MailBlock } from "../mail/render.js";
import { resolveSender } from "../campaigns/config.js";
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

export const PLACEHOLDER_NAMES = ["name", "site", "days", "link"] as const;
const PLACEHOLDER = /\{(name|site|days|link)\}/g;

/** True when the template carries a `{link}` the filler will turn into the link (exact, case-sensitive). */
export const hasLink = (tpl: string) => tpl.includes("{link}");

type Vars = Record<"name" | "site" | "days" | "link", string>;

/**
 * Fills a template in ONE pass, so a value is never itself scanned for
 * placeholders. {link} becomes a link part; escaping is the renderer's job
 * (../mail/escape.ts), never done here.
 */
export function fillParts(tpl: string, vars: Vars): Inline[] {
  const out: Inline[] = [];
  const push = (s: string) => {
    if (typeof out[out.length - 1] === "string") out[out.length - 1] += s;
    else if (s) out.push(s);
  };
  let last = 0;
  for (const m of tpl.matchAll(PLACEHOLDER)) {
    push(tpl.slice(last, m.index));
    const v = vars[m[1] as keyof Vars];
    if (m[1] === "link") out.push({ href: v, text: v });
    else push(v);
    last = (m.index ?? 0) + m[0].length;
  }
  push(tpl.slice(last));
  return out;
}

const partsText = (parts: Inline[]) => parts.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** Plain-text fill, same single pass. */
export const fillTemplate = (tpl: string, vars: Vars): string => partsText(fillParts(tpl, vars));

/* "Hi ," when a visitor gave no name reads badly: drop the gap before punctuation. */
const tidy = (parts: Inline[]): Inline[] => parts.map((p) => (typeof p === "string" ? p.replace(/[ \t]+([,،])/g, "$1") : p));

/* A paragraph that is only the link becomes the button, with the plain link under it as the fallback. */
const ONLY_LINK = /^\{link\}$/;

export function renderConfirmMail(contact: Pick<Contact, "name" | "lang">, link: string, sender: SenderSettings) {
  const lang: Lang = contact.lang ?? "en";
  const subject = oneLine(lang === "he" ? sender.confirmSubjectHe : sender.confirmSubjectEn);
  let tpl = lang === "he" ? sender.confirmBodyHe : sender.confirmBodyEn;
  // An owner edit that drops {link} must not produce a mail nobody can confirm.
  if (!hasLink(tpl)) tpl += "\n\n{link}";
  const site = new URL(env.SITE_URL).host;
  const vars: Vars = { name: contact.name?.trim() || (lang === "he" ? "" : "there"), site, days: String(sender.pendingTtlDays), link };
  const blocks: MailBlock[] = [{ type: "heading", text: subject }];
  let preheader = "";
  for (const para of tpl.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (ONLY_LINK.test(para)) {
      blocks.push({ type: "button", label: subject, href: link }, { type: "paragraph", tone: "muted", htmlOnly: true, text: [{ href: link, text: link }] });
      continue;
    }
    const parts = tidy(fillParts(para, vars));
    if (!preheader && blocks.length > 1) preheader = partsText(parts).replace(/\s+/g, " ").slice(0, 140);
    blocks.push({ type: "paragraph", text: parts });
  }
  const lines = contactLines(sender);
  if (lines.length) blocks.push({ type: "footer", lines });
  const { html, text } = renderMail(blocks, { lang, title: subject, preheader: preheader || subject });
  return { subject, text, html };
}

/** Sends the double opt-in mail. Never throws and never logs the address. */
export async function sendConfirmMail(contact: Contact, hash: string): Promise<boolean> {
  try {
    const sender = (await loadSettings()).sender;
    const from = resolveSender(sender);
    const token = await signToken({ t: "confirm", h: hash, exp: expiresIn(sender.pendingTtlDays * DAY) });
    const mail = renderConfirmMail(contact, pageUrl("/subscribe/confirm", token), sender);
    const r = await emailService.sendTo({ to: contact.email, ...mail, from: from.from, replyTo: from.replyTo });
    if (!r.ok) logger.warn({ contact: hash, err: r.error }, "confirmation mail failed");
    return r.ok;
  } catch (err) {
    logger.warn({ contact: hash, err: err instanceof Error ? err.message : String(err) }, "confirmation mail failed");
    return false;
  }
}
