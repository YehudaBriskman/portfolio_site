import { useEffect, useState } from "react";
import { adminAnnounce, type AnnounceLang, type AnnounceSummary } from "@/services/adminAnnounce";
import { cardSrc, eventUrl } from "../helpers";
import { SAMPLE, type Vars } from "./variables";

/*
 * What a template is previewed against: a built-in sample, or one of the
 * owner's recent real events (the inbox list, then that event's own detail
 * for its summary, tags and version). A failed read falls back to the sample
 * rather than leaving the preview empty.
 */

export type SampleMeta = { url: string; title: string; description: string; image: string };
export type Sample = { vars: Vars; meta: SampleMeta };

export const BUILTIN = "builtin";
const RECENT = 8;

export function useRecentEvents() {
  const [events, setEvents] = useState<AnnounceSummary[]>([]);
  useEffect(() => {
    let live = true;
    adminAnnounce.inbox().then(
      (r) => live && setEvents(r.items.slice(0, RECENT)),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return events;
}

const builtin = (lang: AnnounceLang, hashtags: string[]): Sample => {
  const v = { ...SAMPLE[lang] };
  if (hashtags.length) v.tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return { vars: v, meta: { url: v.url, title: v.title, description: v.summary, image: "" } };
};

export function useSample(choice: string, events: AnnounceSummary[], lang: AnnounceLang, hashtags: string[]) {
  const [loaded, setLoaded] = useState<{ id: string; sample: Omit<Sample, "meta"> & { ev: AnnounceSummary } } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ev = choice === BUILTIN ? undefined : events.find((e) => e.id === choice);

  useEffect(() => {
    if (!ev) return;
    let live = true;
    adminAnnounce.get(ev.id).then(
      (d) => {
        if (!live) return;
        setFailed(null);
        setLoaded({ id: ev.id, sample: { ev: d.event, vars: { ...SAMPLE.en, title: d.event.title, summary: d.event.summary, url: d.event.url, version: d.event.version ?? "", tags: d.event.tags.map((t) => `#${t}`).join(" ") } } });
      },
      () => live && setFailed(ev.id),
    );
    return () => {
      live = false;
    };
  }, [ev]);

  const base = builtin(lang, hashtags);
  if (!ev) return { sample: base, state: "ready" as const };
  if (failed === ev.id) return { sample: base, state: "failed" as const };
  if (!loaded || loaded.id !== ev.id) return { sample: base, state: "loading" as const };
  const { vars, ev: full } = loaded.sample;
  const url = eventUrl(full, lang);
  const merged: Vars = { ...vars, url, site: SAMPLE.en.site, first_name: SAMPLE[lang].first_name };
  if (hashtags.length) {
    const own = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
    merged.tags = [...new Set([...own, ...vars.tags.split(" ").filter(Boolean)])].join(" ");
  }
  return { sample: { vars: merged, meta: { url, title: merged.title, description: merged.summary, image: cardSrc(full, "og") } }, state: "ready" as const };
}
