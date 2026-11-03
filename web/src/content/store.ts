import { useSyncExternalStore } from "react";
import { z } from "zod";
import { useLang, type Lang } from "@/components/dashboard/i18n";
import { localize, seedBundle, type ContentView } from "./convert";
import { ProjectsContentSchema, SiteCopySchema, StoryContentSchema, type ContentBundle } from "./schema";

/*
 * The site's content, read from the API with the data files underneath (#163).
 *
 * The page renders from `seedBundle()` — the data files in the store's shape
 * — from the first frame, and `loadContent()` swaps in what the API serves
 * once it answers. A dead API, a body that fails the schema, or a store that
 * was never seeded all leave the seed in place, so the page is never blank
 * and never waits on the network to paint.
 *
 * Swapped only when it differs. The store's first state is the seed, byte for
 * byte, so on almost every load the answer equals what is already rendered;
 * replacing it anyway would hand every consumer new arrays, and anything keyed
 * on identity (an arrival, a measured layout) would run again for no change.
 *
 * PREVIEW
 * -------
 * `?preview=1` on a page asks the admin API for the drafts instead. That API
 * only answers through the admin host's login, so on the public host the
 * request fails and the page shows what is published, which is the right
 * answer to a stranger who found the parameter.
 */

const BundleSchema = z.object({
  projects: ProjectsContentSchema,
  story: StoryContentSchema,
  siteCopy: SiteCopySchema,
});

const FALLBACK: ContentBundle = seedBundle();
let current: ContentBundle = FALLBACK;
let currentKey = JSON.stringify(FALLBACK);
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Replaces the content, if it differs, and tells every reader. */
export function setContent(next: ContentBundle): void {
  const key = JSON.stringify(next);
  if (key === currentKey) return;
  current = next;
  currentKey = key;
  listeners.forEach((fn) => fn());
}

/** The content as it stands, for code that is not a component. */
export function contentSnapshot(): ContentBundle {
  return current;
}

/** Test seam: back to the seed. */
export function resetContent(): void {
  loading = null;
  setContent(FALLBACK);
}

function previewRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("preview");
}

async function fetchBundle(url: string): Promise<ContentBundle | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body: unknown = JSON.parse(await res.text());
  const parsed = BundleSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Fetches the published content once per page load (or the drafts, on preview). */
export function loadContent(): Promise<void> {
  loading ??= (async () => {
    try {
      const preview = previewRequested() ? await fetchBundle("/api/admin/content/preview").catch(() => null) : null;
      const next = preview ?? (await fetchBundle("/api/content"));
      if (next) setContent(next);
    } catch {
      /* The seed is already rendered; a failed read changes nothing. */
    }
  })();
  return loading;
}

export function useContentBundle(): ContentBundle {
  return useSyncExternalStore(subscribe, contentSnapshot, contentSnapshot);
}

/* One view per bundle and language, shared by every reader, so two
   components reading the same projects hold the same array. */
const views = new WeakMap<ContentBundle, Partial<Record<Lang, ContentView>>>();

function viewOf(bundle: ContentBundle, lang: Lang): ContentView {
  const byLang = views.get(bundle) ?? {};
  views.set(bundle, byLang);
  return (byLang[lang] ??= localize(bundle, lang));
}

/** The content in the reader's language, in the shapes the components read. */
export function useContent(): ContentView {
  return viewOf(useContentBundle(), useLang());
}

/** The content in English, for code that is not a component. */
export function contentView(): ContentView {
  return viewOf(current, "en");
}
