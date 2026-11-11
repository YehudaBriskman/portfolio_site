import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import {
  AnnounceSettingsSchema,
  DEFAULT_ANNOUNCE_SETTINGS,
  SETTINGS_DOC_ID,
  type AnnounceEvent,
  type AnnounceSettings,
  type AnnounceSettingsDoc,
} from "./schemas.js";

const PREFIX = "announce:";
/** Bookkeeping doc: the release tags already seen. Not `announce:`-prefixed, so the inbox never lists it. */
export const STATE_ID = "announce-state";

export const eventId = (kind: string, ref: string, stamp: string) => `${PREFIX}${kind}:${ref}:${stamp}`;

const isStatus = (e: unknown, s: number) => e instanceof CouchError && e.status === s;

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (isStatus(e, 404)) return null;
    throw e;
  }
}

/** Creates the event; false when its id already exists (the dedupe). */
export async function createEvent(ev: AnnounceEvent): Promise<boolean> {
  try {
    await couch.append(ev._id, ev as unknown as Record<string, unknown>);
    return true;
  } catch (e) {
    if (isStatus(e, 409)) return false;
    throw e;
  }
}

export const getEvent = (id: string) => tryGet<AnnounceEvent>(id);

/** Newest first. */
export async function listEvents(limit = 200): Promise<AnnounceEvent[]> {
  const { docs } = await couch.find<AnnounceEvent>({ selector: { _id: { $gt: PREFIX, $lt: `${PREFIX}￿` } }, limit });
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Read-modify-write, retried once on a revision clash (two taps at once). */
export async function updateEvent(id: string, change: (ev: AnnounceEvent) => void): Promise<AnnounceEvent | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ev = await getEvent(id);
    if (!ev) return null;
    change(ev);
    try {
      const r = await couch.put<{ rev?: string }>(id, ev);
      if (r && typeof r.rev === "string") ev._rev = r.rev;
      return ev;
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  throw new CouchError(409, "announce event changed concurrently");
}

export async function getSettingsDoc(): Promise<AnnounceSettingsDoc | null> {
  return tryGet<AnnounceSettingsDoc>(SETTINGS_DOC_ID);
}

export function settingsOf(doc: AnnounceSettingsDoc | null): AnnounceSettings {
  if (!doc) return DEFAULT_ANNOUNCE_SETTINGS;
  const parsed = AnnounceSettingsSchema.safeParse(doc.settings);
  if (parsed.success) return parsed.data;
  logger.warn({ id: SETTINGS_DOC_ID }, "announce settings do not parse; using the defaults");
  return DEFAULT_ANNOUNCE_SETTINGS;
}

/** Never throws: a store hiccup must not stop a publish or a refresh tick. */
export async function loadSettings(): Promise<AnnounceSettings> {
  try {
    return settingsOf(await getSettingsDoc());
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "announce settings unreadable; using the defaults");
    return DEFAULT_ANNOUNCE_SETTINGS;
  }
}

export type AnnounceState = { _id: typeof STATE_ID; _rev?: string; seenReleases: string[]; seededAt: string };

export const getState = () => tryGet<AnnounceState>(STATE_ID);
export async function putState(state: AnnounceState): Promise<void> {
  await couch.put(STATE_ID, state);
}
