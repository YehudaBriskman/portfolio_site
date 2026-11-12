import {
  countChars,
  gmailComposeUrl,
  linkedInShareUrl,
  localePath,
  mailtoUrl,
  xShareUrl,
  channelLimit,
} from "@/lib/share";
import type {
  AnnounceChannel,
  AnnounceLang,
  AnnounceSummary,
} from "@/services/adminAnnounce";

/** The tabs of a card. Email and Gmail share one: same caption, two ways to open it. */
export const TABS = ["linkedin", "instagram", "email", "x"] as const;
export type Tab = (typeof TABS)[number];

export type Format = "og" | "square" | "story";

/** Used only until the server's answer arrives, or when it carries none. */
export const DEFAULT_SITE_ORIGIN = "https://yehudabriskman.com";

/**
 * The public site's origin, for card images and the email block, as the server
 * reports it. Never the page's own origin (the admin lives on another, SSO-gated
 * host) and never an event's address (a release points at GitHub: no card there).
 */
export const siteOrigin = (fromServer?: string | null): string => {
  try {
    return new URL(fromServer ?? "").origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
};

/** A release is stored as "<repo> <tag>"; the page reads "Release <tag>". Other titles are untouched. */
export function releaseTag(ev: Pick<AnnounceSummary, "kind" | "title" | "ref">): string | null {
  const m = ev.kind === "release" ? /^\S+ (\S+)$/.exec(ev.title.trim()) : null;
  return m && m[1] === ev.ref ? ev.ref : null;
}

/** The card for an event, from its own ref only. Releases have their own kind. */
export function cardSrc(
  ev: Pick<AnnounceSummary, "kind" | "ref">,
  format: Format,
): string {
  const dir = ev.kind === "release" ? "release" : "blog";
  const base = `/api/seo/og/${dir}/${encodeURIComponent(ev.ref)}.png`;
  return format === "og" ? base : `${base}?format=${format}`;
}

/**
 * The address a share dialog is given. A note's Hebrew page lives under /he;
 * a release links to its GitHub page, which has no Hebrew form.
 */
export function eventUrl(
  ev: Pick<AnnounceSummary, "kind" | "url">,
  lang: AnnounceLang,
): string {
  if (lang === "en" || ev.kind !== "post") return ev.url;
  try {
    const u = new URL(ev.url);
    u.pathname = localePath(u.pathname, "he");
    return u.href;
  } catch {
    return ev.url;
  }
}

/** The kit channel a tab edits: Email falls back to the Gmail text when Email is switched off. */
export function kitChannel(
  tab: Tab,
  has: (c: AnnounceChannel) => boolean,
): AnnounceChannel | null {
  if (tab === "email")
    return has("email") ? "email" : has("gmail") ? "gmail" : null;
  return has(tab) ? tab : null;
}

export const count = (text: string, tab: Tab) =>
  countChars(text, tab === "email" ? undefined : tab);
export const limitOf = (tab: Tab) =>
  tab === "email" ? null : channelLimit(tab);

export const links = {
  linkedin: (url: string) => linkedInShareUrl(url),
  gmail: (subject: string, body: string) => gmailComposeUrl(subject, body),
  mailto: (subject: string, body: string) => mailtoUrl(subject, body),
  /* The kit's X text already carries the link; a second `url` parameter would print it twice. */
  x: (url: string, text: string) => {
    const u = new URL(xShareUrl(url, text));
    if (text.includes(url)) u.searchParams.delete("url");
    return u.href;
  },
};

/** "#a, b  c" -> ["#a","b","c"]; the server checks the shape of each. */
export const parseTags = (raw: string) => raw.split(/[\s,]+/).filter(Boolean);

export const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
