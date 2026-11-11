import { useEffect, useSyncExternalStore } from "react";
import { ContentConflictError, ContentInvalidError, type Issue } from "./adminContent";

/*
 * The owner's announce inbox (/api/admin/announce). Same rules as
 * adminSettings.ts: relative paths so a request stays on the gated origin,
 * 409 is a conflict, 400 carries `issues`. Everything a caption says arrives
 * as plain text and is shown as text.
 */

export const ANNOUNCE_CHANNELS = ["linkedin", "instagram", "email", "gmail", "x"] as const;
export type AnnounceChannel = (typeof ANNOUNCE_CHANNELS)[number];
export const ANNOUNCE_KINDS = ["post", "release", "note", "project", "area", "story", "home", "custom"] as const;
export type AnnounceKind = (typeof ANNOUNCE_KINDS)[number];
export type AnnounceLang = "en" | "he";

export type AnnounceSummary = {
  id: string;
  kind: AnnounceKind;
  ref: string;
  title: string;
  url: string;
  langs: AnnounceLang[];
  createdAt: string;
  readAt: string | null;
  done: Partial<Record<AnnounceChannel, string>>;
  dismissed: string | null;
};

export type AnnounceInbox = { ok: true; unread: number; items: AnnounceSummary[] };

export type KitItem = { text: string; subject: string; limit: number | null; length: number; over: boolean; draft?: boolean };
export type Kit = Record<AnnounceLang, Partial<Record<AnnounceChannel, KitItem>>>;

export type AnnounceDetail = {
  ok: true;
  event: AnnounceSummary & {
    _rev?: string | null;
    summary: string;
    tags: string[];
    version: string | null;
    drafts?: Partial<Record<AnnounceLang, Partial<Record<AnnounceChannel, string>>>>;
    custom?: { title: string; summary: string; url?: string; imageUrl?: string } | null;
  };
  kit: Kit;
};

export type PreviewIssue = {
  code:
    | "title-missing"
    | "title-long"
    | "description-missing"
    | "description-long"
    | "image-missing"
    | "image-size"
    | "no-hebrew-translation";
  field: "title" | "description" | "image" | "translation";
  severity: "error" | "warn";
  limit?: number;
  length?: number;
};

/** The head a platform reads for the event's own page. */
export type AnnouncePreview = {
  ok: true;
  title: string;
  description: string;
  image: string;
  imageWidth: number | null;
  imageHeight: number | null;
  siteName: string;
  url: string;
  lang: AnnounceLang;
  issues: PreviewIssue[];
};

export type AnnounceSnippetKind = "hashtags" | "signature" | "cta" | "links";
export const ANNOUNCE_SNIPPET_KINDS: readonly AnnounceSnippetKind[] = ["hashtags", "signature", "cta", "links"];
export type AnnounceSnippet = { id: string; name: string; kind: AnnounceSnippetKind; text: string };
export type AnnounceLibraryItem = { id: string; name: string; channel: AnnounceChannel; lang: AnnounceLang; text: string };
export type AnnounceUtm = { enabled: boolean; source: string; mediumByChannel: Partial<Record<AnnounceChannel, string>> };

export type AnnounceSettings = {
  enabled: boolean;
  email: { enabled: boolean; events: AnnounceKind[] };
  hashtags: string[];
  signature: string;
  channels: AnnounceChannel[];
  templates: Record<AnnounceLang, Partial<Record<AnnounceChannel, string>>>;
  snippets: AnnounceSnippet[];
  library: AnnounceLibraryItem[];
  advanced: { utm: AnnounceUtm };
};

export type AnnounceSettingsView = {
  ok: true;
  exists: boolean;
  _rev: string | null;
  updatedAt: string | null;
  settings: AnnounceSettings;
};

function issuesOf(body: unknown): Issue[] {
  const list = (body as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(list)) return [];
  return list.flatMap((i: unknown) => {
    const { path, message } = (i ?? {}) as Record<string, unknown>;
    return typeof message === "string" ? [{ path: typeof path === "string" ? path : "", message }] : [];
  });
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/announce${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("api-down");
  }
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 409) throw new ContentConflictError();
  if (res.status === 400) throw new ContentInvalidError("invalid", issuesOf(body));
  if (!res.ok) throw new Error(`status-${res.status}`);
  return body as T;
}

const id = (s: string) => encodeURIComponent(s);
const post = (path: string, body?: unknown) =>
  call<{ ok: true; event: AnnounceSummary | null }>(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });

export const adminAnnounce = {
  inbox: async () => {
    const r = await call<AnnounceInbox>("");
    if (typeof r.unread === "number") setUnread(r.unread);
    return r;
  },
  get: (eventId: string) => call<AnnounceDetail>(`/${id(eventId)}`),
  preview: (eventId: string, lang: AnnounceLang) => call<AnnouncePreview>(`/${id(eventId)}/preview?lang=${lang}`),
  read: (eventId: string) => post(`/${id(eventId)}/read`),
  done: (eventId: string, channel: AnnounceChannel) => post(`/${id(eventId)}/done`, { channel }),
  dismiss: (eventId: string) => post(`/${id(eventId)}/dismiss`),
  /** A hand-made announcement. `story` and `home` take no link; `url` and `imageUrl` must be on the site. */
  create: (b: { kind: "custom" | "story" | "home"; title: string; summary: string; url?: string; imageUrl?: string }) =>
    call<{ ok: true; event: AnnounceSummary }>("", { method: "POST", body: JSON.stringify(b) }),
  /** The owner's own caption for one language and channel; `null` clears it back to the template. */
  saveDraft: (eventId: string, b: { lang: AnnounceLang; channel: AnnounceChannel; text: string | null }) =>
    call<AnnounceDetail>(`/${id(eventId)}/draft`, { method: "PUT", body: JSON.stringify(b) }),
  settings: () => call<AnnounceSettingsView>("/settings"),
  saveSettings: (settings: AnnounceSettings, rev: string | null) =>
    call<AnnounceSettingsView>("/settings", { method: "PUT", body: JSON.stringify({ settings, ...(rev ? { _rev: rev } : {}) }) }),
};

/* ------------------------------------------------------------ nav badge */

/*
 * The unread count beside the nav item. The shell reads it; the page that
 * changes it (opening or dismissing an event) pushes the new number, so the
 * badge is right without a second request. `null` is "not known": no badge,
 * never a zero.
 */
let unread: number | null = null;
const listeners = new Set<() => void>();

export function setUnread(n: number | null): void {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The unread count; asks the server once per mount of the shell. */
export function useAnnounceUnread(): number | null {
  const n = useSyncExternalStore(subscribe, () => unread, () => null);
  useEffect(() => {
    let live = true;
    call<AnnounceInbox>("")
      .then((r) => live && setUnread(typeof r?.unread === "number" ? r.unread : null))
      .catch(() => live && setUnread(null));
    return () => {
      live = false;
    };
  }, []);
  return n;
}
