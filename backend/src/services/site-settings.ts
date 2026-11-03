import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import { DEFAULT_SETTINGS, SiteSettingsSchema, type SiteSettings } from "../schemas/site-settings.js";

/*
 * The site's settings document (#254): read, write, and the fallback.
 *
 * One document, `settings:site`. `settings` is what the site uses; `history`
 * is every earlier version, newest first, so any of them can be put back. A
 * revert is a new version whose body is the old one, so the history only
 * ever grows forward and a revert can itself be reverted.
 *
 * THE FALLBACK
 * ------------
 * No document reads as DEFAULT_SETTINGS, which is the site as it was built.
 * A document that no longer parses (hand-edited in Fauxton, say) also reads
 * as the defaults, and says so in the log. The crawler renders use
 * `settingsOrDefault()`, which also covers a store that cannot be reached.
 */

export const SETTINGS_ID = "settings:site";

/** How many earlier versions are kept. Each is well under a kilobyte. */
export const HISTORY_LIMIT = 30;

export type SettingsVersion = { version: number; at: string; settings: SiteSettings };

export type SettingsDoc = {
  _id: string;
  _rev?: string;
  type: "settings";
  version: number;
  settings: SiteSettings;
  updatedAt: string;
  history: SettingsVersion[];
};

export async function getSettingsDoc(): Promise<SettingsDoc | null> {
  try {
    return await couch.get<SettingsDoc>(SETTINGS_ID);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

/** The settings a document holds, or the defaults when it holds none that parse. */
export function settingsOf(doc: SettingsDoc | null): SiteSettings {
  if (!doc) return DEFAULT_SETTINGS;
  const parsed = SiteSettingsSchema.safeParse(doc.settings);
  if (parsed.success) return parsed.data;
  logger.warn({ id: SETTINGS_ID }, "settings document does not parse; serving the defaults");
  return DEFAULT_SETTINGS;
}

/** What the public site uses. Throws when the store cannot be read. */
export async function publishedSettings(): Promise<SiteSettings> {
  return settingsOf(await getSettingsDoc());
}

/** For the crawler renders, which must answer with the store down. */
export async function settingsOrDefault(): Promise<SiteSettings> {
  try {
    return await publishedSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * The next document: `next` as the current version, and what was current
 * pushed onto the history (the defaults count as version 0 when there was
 * no document, so the first save can be undone too).
 */
export function nextDoc(existing: SettingsDoc | null, next: SiteSettings, now: string): SettingsDoc {
  const previous: SettingsVersion = existing
    ? { version: existing.version, at: existing.updatedAt, settings: settingsOf(existing) }
    : { version: 0, at: now, settings: DEFAULT_SETTINGS };
  return {
    _id: SETTINGS_ID,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "settings",
    version: (existing?.version ?? 0) + 1,
    settings: next,
    updatedAt: now,
    history: [previous, ...(existing?.history ?? [])].slice(0, HISTORY_LIMIT),
  };
}
