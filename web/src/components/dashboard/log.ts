import { ACTIVITY_KINDS, type ActivityEvent, type ActivityKind } from "@/services/activity";
import { INTL, type Lang } from "@/components/dashboard/i18n";

/*
 * The channel log's logic (#226), apart from the page so it can be tested
 * without rendering: what the URL says is filtered, the URLs that change it,
 * the feed that matches it, and how a page of events falls into days.
 *
 * THE URL IS THE FILTER. `?kind=release&kind=post&area=windom`: `kind` is
 * repeated (the gallery's facet shape, `gallery/facets.ts`, so the phone's
 * filter tokens read it as they read every other page's), `area` is one slug
 * because the activity API filters by one. A value the API does not know is
 * dropped on read rather than sent, so a stale or hand-typed link shows the
 * log with the filters that still mean something instead of an error.
 *
 * The cursor is NOT in the URL. "Load more" is a reader reaching further down
 * one list, not a new view: a shared link opens the log at its newest.
 */

export const LOG_PATH = "/blog/log";
export const LOG_FEED = "/api/seo/feed/log.xml";
/** Events per request. The API allows up to 50. */
export const LOG_PAGE = 25;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type LogFilters = { kinds: ActivityKind[]; area: string | null };

export function readLogFilters(params: URLSearchParams): LogFilters {
  const asked = new Set(
    params
      .getAll("kind")
      .flatMap((v) => v.split(","))
      .map((v) => v.trim()),
  );
  /* In the API's own order, so `?kind=post&kind=release` and the reverse are one filter. */
  const kinds = ACTIVITY_KINDS.filter((k) => asked.has(k));
  const area = (params.get("area") ?? "").trim();
  return { kinds, area: SLUG.test(area) && area.length <= 80 ? area : null };
}

function hrefOf(path: string, f: LogFilters): string {
  const p = new URLSearchParams();
  for (const k of f.kinds) p.append("kind", k);
  if (f.area) p.set("area", f.area);
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

export function logHref(f: LogFilters): string {
  return hrefOf(LOG_PATH, f);
}

/** The feed of exactly what the page shows. */
export function logFeedHref(f: LogFilters): string {
  return hrefOf(LOG_FEED, f);
}

export function hrefToggledKind(f: LogFilters, kind: ActivityKind): string {
  const on = f.kinds.includes(kind);
  return logHref({ ...f, kinds: ACTIVITY_KINDS.filter((k) => (k === kind ? !on : f.kinds.includes(k))) });
}

/** One area at a time: choosing the chosen one takes it off. */
export function hrefToggledArea(f: LogFilters, area: string): string {
  return logHref({ ...f, area: f.area === area ? null : area });
}

export const filterCount = (f: LogFilters) => f.kinds.length + (f.area ? 1 : 0);

/* ─────────────────────────────────────────────────────────────── days */

/**
 * The calendar day an event happened on, in the reader's time zone: a push at
 * 23:30 UTC is "tomorrow" in Tel Aviv, and the heading it sits under should
 * say so. `en-CA` is used only because it formats as YYYY-MM-DD.
 */
export function dayKey(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "undated";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(d);
}

/** "Tuesday, 3 November 2026" / "יום שלישי, 3 בנובמבר 2026". */
export function dayLabel(iso: string, lang: Lang, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return lang === "he" ? "ללא תאריך" : "Undated";
  return new Intl.DateTimeFormat(INTL[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

export type LogDay = { key: string; label: string; items: ActivityEvent[] };

/** Consecutive events of one day under one heading. The API's order is kept. */
export function groupByDay(events: ActivityEvent[], lang: Lang, timeZone?: string): LogDay[] {
  const days: LogDay[] = [];
  for (const e of events) {
    const key = dayKey(e.at, timeZone);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(e);
    else days.push({ key, label: dayLabel(e.at, lang, timeZone), items: [e] });
  }
  return days;
}

/* ─────────────────────────────────────────────────────────────── words */

const EN = {
  title: "Channel log",
  lede: "Everything that happens on the site, newest first: notes, releases, pushes, site releases and new areas.",
  log: "Channel log",
  railLabel: "Filter the log",
  kinds: "Kind",
  areas: "Area",
  kindPlural: {
    post: "Notes",
    release: "Releases",
    push: "Pushes",
    site: "Site",
    area: "Areas",
  } as Record<ActivityKind, string>,
  clear: "Clear the filters",
  anyKind: "Any kind",
  anyArea: "Any area",
  subscribe: "Subscribe",
  subscribeBody: "The log as RSS, with the filters you have on.",
  subscribeAll: "Every note, as RSS",
  rss: "RSS",
  feedTitle: "Yehuda Briskman · Channel log",
  events: "Events",
  loadMore: "Load more",
  loading: "Loading…",
  shown: (n: number) => (n === 1 ? "1 event shown" : `${n} events shown`),
  end: "That’s the whole log.",
  emptyTitle: "Nothing has happened on the site yet.",
  emptyBody: "Notes, releases and pushes appear here as they happen.",
  noMatch: "No event matches these filters.",
  failedTitle: "The log couldn’t be loaded.",
  failedBody: "The log is served by a small machine I run myself, and it isn’t answering right now. Usually that means a restart.",
  moreFailed: "The next events couldn’t be loaded.",
  leaves: "on GitHub",
  inArea: "Area",
  noAreas: "No areas yet.",
};

export type LogWords = typeof EN;

const HE: LogWords = {
  title: "יומן הערוץ",
  lede: "כל מה שקורה באתר, מהחדש לישן: רשימות, גרסאות, עדכוני קוד, גרסאות אתר ותחומים חדשים.",
  log: "יומן הערוץ",
  railLabel: "סינון היומן",
  kinds: "סוג",
  areas: "תחום",
  kindPlural: {
    post: "רשימות",
    release: "גרסאות",
    push: "עדכוני קוד",
    site: "האתר",
    area: "תחומים",
  },
  clear: "ניקוי הסינון",
  anyKind: "כל סוג",
  anyArea: "כל תחום",
  subscribe: "הרשמה",
  subscribeBody: "היומן כ־RSS, עם הסינון הנוכחי.",
  subscribeAll: "כל הרשימות כ־RSS",
  rss: "RSS",
  feedTitle: "Yehuda Briskman · Channel log",
  events: "אירועים",
  loadMore: "טעינת עוד",
  loading: "טוען…",
  shown: (n: number) => (n === 1 ? "מוצג אירוע אחד" : `מוצגים ${n} אירועים`),
  end: "זה כל היומן.",
  emptyTitle: "עוד לא קרה כלום באתר.",
  emptyBody: "רשימות, גרסאות ועדכוני קוד יופיעו כאן כשיקרו.",
  noMatch: "אין אירוע שמתאים לסינון.",
  failedTitle: "לא ניתן לטעון את היומן.",
  failedBody: "היומן מוגש ממכונה קטנה שאני מפעיל בעצמי, והיא לא עונה כרגע. בדרך כלל זה אומר הפעלה מחדש.",
  moreFailed: "לא ניתן לטעון את האירועים הבאים.",
  leaves: "ב־GitHub",
  inArea: "תחום",
  noAreas: "עוד אין תחומים.",
};

export const LOG_WORDS: Record<Lang, LogWords> = { en: EN, he: HE };
