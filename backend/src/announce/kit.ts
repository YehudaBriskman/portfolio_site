import { SITE_URL, absoluteUrl, pathIn } from "../services/seo.js";
import { LIMITS, type AnnounceEvent, type AnnounceSettings, type Channel } from "./schemas.js";

/*
 * The ready-to-send text for one event: plain text per channel and language.
 * It is rendered as text by the admin, never as HTML. URLs come from SITE_URL
 * plus the entity's own path, or the release's stored GitHub link.
 */

type Lang = "en" | "he";

const DEFAULTS: Record<Lang, { post: Partial<Record<Channel, string>>; release: Partial<Record<Channel, string>> }> = {
  en: {
    post: {
      linkedin: "New on the blog: {title}\n\n{summary}\n\n{url}\n\n{tags}",
      instagram: "New on the blog: {title}\n\n{summary}\n\nLink in bio.\n\n{tags}",
      email: "New on the blog: {title}\n\n{summary}\n\n{url}",
      gmail: "New on the blog: {title}\n\n{summary}\n\n{url}",
      x: "New on the blog: {title} {url}",
    },
    release: {
      linkedin: "{site} {version} is out.\n\n{summary}\n\n{url}\n\n{tags}",
      instagram: "{site} {version} is out.\n\n{summary}\n\n{tags}",
      email: "{site} {version} is out.\n\n{url}",
      gmail: "{site} {version} is out.\n\n{url}",
      x: "{site} {version} is out {url}",
    },
  },
  he: {
    post: {
      linkedin: "חדש בבלוג: {title}\n\n{summary}\n\n{url}\n\n{tags}",
      instagram: "חדש בבלוג: {title}\n\n{summary}\n\nהקישור בביו.\n\n{tags}",
      email: "חדש בבלוג: {title}\n\n{summary}\n\n{url}",
      gmail: "חדש בבלוג: {title}\n\n{summary}\n\n{url}",
      x: "חדש בבלוג: {title} {url}",
    },
    release: {
      linkedin: "{site} {version} יצאה.\n\n{summary}\n\n{url}\n\n{tags}",
      instagram: "{site} {version} יצאה.\n\n{summary}\n\n{tags}",
      email: "{site} {version} יצאה.\n\n{url}",
      gmail: "{site} {version} יצאה.\n\n{url}",
      x: "{site} {version} יצאה {url}",
    },
  },
};

export type KitItem = { text: string; subject: string; limit: number | null; length: number; over: boolean };
export type Kit = Record<Lang, Partial<Record<Channel, KitItem>>>;

function urlFor(ev: AnnounceEvent, lang: Lang): string {
  return ev.path ? absoluteUrl(pathIn(ev.path, lang)) : ev.url;
}

const fill = (tpl: string, vars: Record<string, string>) =>
  /* One pass over the template, so a value containing "{url}" is not expanded again. */
  tpl.replace(/\{(title|summary|url|tags|version|site)\}/g, (_m, k: string) => vars[k] ?? "");

export function renderKit(ev: AnnounceEvent, settings: AnnounceSettings): Kit {
  const hashtags = settings.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
  const kit: Kit = { en: {}, he: {} };
  for (const lang of ev.langs) {
    const he = lang === "he";
    const vars = {
      title: (he && ev.titleHe) || ev.title,
      summary: (he && ev.summaryHe) || ev.summary,
      url: urlFor(ev, lang),
      tags: [...new Set([...hashtags, ...ev.tags.map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`).filter((t) => t.length > 1)])].join(" "),
      version: ev.version ?? "",
      site: new URL(SITE_URL).hostname,
    };
    for (const ch of settings.channels) {
      const tpl = settings.templates[lang][ch] ?? DEFAULTS[lang][ev.kind][ch] ?? "";
      let text = fill(tpl, vars).replace(/\n{3,}/g, "\n\n").trim();
      if (settings.signature && ch !== "x") text = `${text}\n\n${settings.signature}`;
      const limit = LIMITS[ch];
      kit[lang][ch] = {
        text,
        subject: fill(DEFAULTS[lang][ev.kind].email!.split("\n")[0], vars),
        limit,
        length: [...text].length,
        over: limit !== null && [...text].length > limit,
      };
    }
  }
  return kit;
}
