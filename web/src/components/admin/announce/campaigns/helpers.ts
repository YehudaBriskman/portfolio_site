import type { Block, CampaignInput, CampaignLang, CampaignTopic } from "@/services/adminCampaigns";

/*
 * Small client-side helpers. The mail itself is never drawn here: the preview
 * is the server's own render (POST /api/admin/campaigns/preview). What stays is
 * what the server cannot do for an unsaved form: tell a block's problem early,
 * make the text version of a block body, and turn a wall-clock time in a zone
 * into an instant.
 */

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

/* ------------------------------------------------------------ time zones */

/**
 * The UTC instant of a wall-clock time ("YYYY-MM-DDTHH:mm") in an IANA zone, as an ISO string.
 * null if it does not parse or does not exist in that zone (the hour skipped when clocks go forward).
 * A time that happens twice (clocks go back) is the first occurrence.
 */
export function zonedToIso(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  /* Date.UTC would carry 30 February into March and read year 0001 as 1901: a date that does not exist is not moved. */
  if (y < 1970 || mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59) return null;
  const at = new Date(Date.UTC(2000, mo - 1, 1));
  at.setUTCFullYear(y, mo - 1, d);
  at.setUTCHours(h, mi, 0, 0);
  if (at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null;
  const guess = at.getTime();
  if (!Number.isFinite(guess)) return null;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  const offset = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  };
  /* Every offset the zone uses near this day is a candidate; only one that reads back as the same wall time is real. */
  const DAY = 86_400_000;
  const hits = new Set<number>();
  for (const o of [offset(guess - DAY), offset(guess), offset(guess + DAY)]) {
    const t = guess - o;
    if (offset(t) === o) hits.add(t);
  }
  if (hits.size === 0) return null;
  return new Date(Math.min(...hits)).toISOString();
}

export type Form = { name: string; subject: string; preheader: string; bodyText: string; useBlocks: boolean; blocks: Block[]; groups: string[]; lang: CampaignLang; topic: "" | CampaignTopic };

export const cleanBlocks = (bs: Block[]): Block[] => bs.map((b) => (b.type === "ul" ? { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) } : b));

/* The save payload. null is meaningful to an update (it clears blocks / topic). */
export const toInput = (f: Form): CampaignInput => {
  const blocks = f.useBlocks ? cleanBlocks(f.blocks) : null;
  return {
    name: f.name.trim() || f.subject.trim().slice(0, 120), subject: f.subject.trim(), preheader: f.preheader.trim(), bodyText: blocks ? blocksToText(blocks) : f.bodyText,
    blocks, groups: f.groups, lang: f.lang, topic: f.topic || null,
  };
};

/* A new campaign has nothing to clear, so absent fields are omitted rather than sent as null. */
export const createPayload = ({ blocks, topic, ...rest }: CampaignInput): CampaignInput => ({ ...rest, ...(blocks ? { blocks } : {}), ...(topic ? { topic } : {}) });
