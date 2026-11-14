import type { Block } from "@/services/adminCampaigns";

/*
 * Soft advice before sending, never a block. The same lines in the ready list
 * of the campaign editor. Mail providers and mailbox filters are the reason:
 * a long or shouting subject, a link shortener, a plain http link, text that
 * shows one address and goes to another, a mail that is all pictures.
 */
export type ContentWarning = "subjectLong" | "subjectCaps" | "subjectBang" | "subjectRe" | "linkShort" | "linkHttp" | "linkMismatch" | "imageAlt" | "imageHeavy";

export const SUBJECT_LONG = 60;
/* Well-known shorteners; a list of names, never fetched or resolved. */
const SHORTENERS = new Set(["bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "lnkd.in", "t.ly", "rb.gy", "youtu.be", "wp.me", "fb.me"]);
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

function urlsOf(text: string, blocks: Block[] | null): { url: string; label?: string }[] {
  const out: { url: string; label?: string }[] = [];
  if (blocks?.length) {
    for (const b of blocks) {
      if (b.type === "cta" && b.url) out.push({ url: b.url, label: b.label });
      for (const t of b.type === "ul" ? b.items : b.type === "p" || b.type === "h2" ? [b.text] : []) for (const m of t.match(URL_RE) ?? []) out.push({ url: m });
    }
  } else for (const m of text.match(URL_RE) ?? []) out.push({ url: m });
  return out;
}

export function contentWarnings(f: { subject: string; bodyText: string; blocks: Block[] | null }): ContentWarning[] {
  const w = new Set<ContentWarning>();
  const subject = f.subject.trim();
  if ([...subject].length > SUBJECT_LONG) w.add("subjectLong");
  /* Two or more shouted words in a row, or one long one. Hebrew has no case, so only Latin letters count. */
  if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b/.test(subject) || /\b[A-Z]{6,}\b/.test(subject)) w.add("subjectCaps");
  if (/[!?]{2,}/.test(subject)) w.add("subjectBang");
  if (/^\s*(re|fwd?|fw)\s*:/i.test(subject)) w.add("subjectRe");
  for (const { url, label } of urlsOf(f.bodyText, f.blocks)) {
    const h = hostOf(url);
    if (SHORTENERS.has(h)) w.add("linkShort");
    if (/^http:\/\//i.test(url)) w.add("linkHttp");
    const shown = label ? /([a-z0-9-]+\.)+[a-z]{2,}/i.exec(label)?.[0].toLowerCase().replace(/^www\./, "") : undefined;
    if (shown && h && shown !== h && !h.endsWith(`.${shown}`)) w.add("linkMismatch");
  }
  if (f.blocks?.length) {
    const images = f.blocks.filter((b) => b.type === "image");
    if (images.some((b) => !(b.text ?? "").trim())) w.add("imageAlt");
    const chars = f.blocks.reduce((n, b) => n + (b.type === "ul" ? b.items.join("").length : b.type === "p" || b.type === "h2" ? b.text.length : 0), 0);
    if (images.length > 0 && chars < 100) w.add("imageHeavy");
  }
  return [...w];
}

/** The next Tuesday 09:30 in `tz` as "YYYY-MM-DDTHH:mm", strictly in the future. */
export function suggestedSlot(now: number, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const at = (t: number) => Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const DAY = 86_400_000;
  for (let i = 0; i < 9; i++) {
    const p = at(now + i * DAY);
    if (p.weekday !== "Tue") continue;
    const past = i === 0 && Number(p.hour) * 60 + Number(p.minute) >= 9 * 60 + 30;
    if (!past) return `${p.year}-${p.month}-${p.day}T09:30`;
  }
  return "";
}
