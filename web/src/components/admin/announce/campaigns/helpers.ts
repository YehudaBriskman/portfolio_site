import type { Block } from "@/services/adminCampaigns";

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
