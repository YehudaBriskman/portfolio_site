import { SITE_URL, absoluteUrl, pathIn } from "../services/seo.js";
import { LIMITS, type AnnounceEvent, type AnnounceSettings, type Channel, type EventKind } from "./schemas.js";

/*
 * The ready-to-send text for one event: plain text per channel and language.
 * It is rendered as text by the admin, never as HTML. URLs come from SITE_URL
 * plus the entity's own path, or the release's stored GitHub link.
 */

type Lang = "en" | "he";

type Templates = Partial<Record<Channel, string>>;

/* The release wording is its own shape; every other kind is a lead line plus the same body. */
const RELEASE: Record<Lang, Templates> = {
  en: {
    linkedin: "{site} {version} is out.\n\n{summary}\n\n{url}\n\n{tags}",
    instagram: "{site} {version} is out.\n\n{summary}\n\n{tags}",
    email: "{site} {version} is out.\n\n{url}",
    gmail: "{site} {version} is out.\n\n{url}",
    x: "{site} {version} is out {url}",
  },
  he: {
    linkedin: "{site} {version} יצאה.\n\n{summary}\n\n{url}\n\n{tags}",
    instagram: "{site} {version} יצאה.\n\n{summary}\n\n{tags}",
    email: "{site} {version} יצאה.\n\n{url}",
    gmail: "{site} {version} יצאה.\n\n{url}",
    x: "{site} {version} יצאה {url}",
  },
};

/* The wording matches the visitor-facing owner captions in web/src/lib/share/templates.ts. */
const LEAD: Record<Lang, Record<Exclude<EventKind, "release">, string>> = {
  en: {
    post: "New on the blog: {title}",
    note: "New on the blog: {title}",
    project: "New project: {title}",
    area: "New collection: {title}",
    story: "My story: {title}",
    home: "{title}",
    custom: "{title}",
  },
  he: {
    post: "חדש בבלוג: {title}",
    note: "חדש בבלוג: {title}",
    project: "פרויקט חדש: {title}",
    area: "אוסף חדש: {title}",
    story: "הסיפור שלי: {title}",
    home: "{title}",
    custom: "{title}",
  },
};
const IN_BIO: Record<Lang, string> = { en: "Link in bio.", he: "הקישור בביו." };

function withLead(lang: Lang, kind: Exclude<EventKind, "release">): Templates {
  const head = LEAD[lang][kind];
  return {
    linkedin: `${head}\n\n{summary}\n\n{url}\n\n{tags}`,
    instagram: `${head}\n\n{summary}\n\n${IN_BIO[lang]}\n\n{tags}`,
    email: `${head}\n\n{summary}\n\n{url}`,
    gmail: `${head}\n\n{summary}\n\n{url}`,
    x: `${head} {url}`,
  };
}

export const defaultTemplates = (lang: Lang, kind: EventKind): Templates => (kind === "release" ? RELEASE[lang] : withLead(lang, kind));

export type KitItem = { text: string; subject: string; limit: number | null; length: number; over: boolean; draft: boolean };
export type Kit = Record<Lang, Partial<Record<Channel, KitItem>>>;

function urlFor(ev: AnnounceEvent, lang: Lang): string {
  return ev.path ? absoluteUrl(pathIn(ev.path, lang)) : ev.url;
}

/* The owner's opt-in utm tags, for a link to the site itself; a link elsewhere is left alone. */
function tagged(url: string, ch: Channel, settings: AnnounceSettings): string {
  const utm = settings.advanced.utm;
  if (!utm.enabled) return url;
  try {
    const u = new URL(url);
    if (u.origin !== new URL(SITE_URL).origin) return url;
    u.searchParams.set("utm_source", utm.source);
    u.searchParams.set("utm_medium", utm.mediumByChannel[ch] ?? ch);
    return u.href;
  } catch {
    return url;
  }
}

const fill = (tpl: string, vars: Record<string, string>) =>
  /* One pass over the template, so a value containing "{url}" is not expanded again. */
  tpl.replace(/\{(title|summary|url|tags|version|site)\}/g, (_m, k: string) => vars[k] ?? "");

export function renderKit(ev: AnnounceEvent, settings: AnnounceSettings): Kit {
  const hashtags = settings.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
  const kit: Kit = { en: {}, he: {} };
  /* A language with the owner's own text is shown even where the event has no page in it. */
  const langs = (["en", "he"] as const).filter((l) => ev.langs.includes(l) || Object.keys(ev.drafts?.[l] ?? {}).length > 0);
  for (const lang of langs) {
    const he = lang === "he";
    const vars = {
      title: (he && ev.titleHe) || ev.title,
      summary: (he && ev.summaryHe) || ev.summary,
      url: urlFor(ev, lang),
      tags: [...new Set([...hashtags, ...ev.tags.map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`).filter((t) => t.length > 1)])].join(" "),
      version: ev.version ?? "",
      site: new URL(SITE_URL).hostname,
    };
    const defaults = defaultTemplates(lang, ev.kind);
    for (const ch of settings.channels) {
      const own = ev.drafts?.[lang]?.[ch]?.trim();
      const chVars = { ...vars, url: tagged(vars.url, ch, settings) };
      const tpl = settings.templates[lang][ch] ?? defaults[ch] ?? "";
      let text = own || fill(tpl, chVars).replace(/\n{3,}/g, "\n\n").trim();
      if (!own && settings.signature && ch !== "x") text = `${text}\n\n${settings.signature}`;
      const limit = LIMITS[ch];
      kit[lang][ch] = {
        text,
        subject: fill((settings.templates[lang].email ?? defaults.email ?? "").split("\n")[0], chVars),
        limit,
        length: [...text].length,
        over: limit !== null && [...text].length > limit,
        draft: Boolean(own),
      };
    }
  }
  return kit;
}
