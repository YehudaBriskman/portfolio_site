import { env } from "../env.js";
import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";

/*
 * Two ways to stop sending, both fail-safe.
 *
 *  - SEND_ENABLED=false in the environment holds EVERY outgoing mail (campaigns,
 *    test sends, confirmations, the contact form) at the provider. It needs a
 *    restart of the container, not a deploy. Only an explicit off value counts, so
 *    a typo cannot silently turn sending off; unset means on.
 *  - The owner's pause (one click in Marketing > Campaigns) holds campaigns: the
 *    tick, test sends and queueing. Confirmation mails keep going, because a pause
 *    that swallowed them would lose people who signed up in good faith.
 *
 * A paused campaign stays `sending`/`scheduled`; resuming continues exactly where
 * it stopped, and nobody is mailed twice (results are keyed per campaign).
 */

export const SWITCH_ID = "sender:switch";
export type SwitchDoc = { _id: typeof SWITCH_ID; _rev?: string; type: "sender-switch"; paused: boolean; at: string };

const OFF = new Set(["false", "0", "off", "no", "disabled"]);

/** True when the environment says no mail leaves, whatever the settings say. Read live so a test (or a restart with a new value) sees it. */
export const sendDisabledByEnv = (): boolean => OFF.has((env.SEND_ENABLED ?? "").trim().toLowerCase());

export async function readSwitch(): Promise<SwitchDoc | null> {
  try {
    return await couch.get<SwitchDoc>(SWITCH_ID);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

export async function setPaused(paused: boolean, now = new Date()): Promise<SwitchDoc> {
  for (let i = 0; i < 4; i++) {
    const cur = await readSwitch();
    const doc: SwitchDoc = { _id: SWITCH_ID, ...(cur?._rev ? { _rev: cur._rev } : {}), type: "sender-switch", paused, at: now.toISOString() };
    try {
      const r = await couch.put<{ rev?: string }>(SWITCH_ID, doc);
      if (r && typeof r.rev === "string") doc._rev = r.rev;
      return doc;
    } catch (e) {
      if (!(e instanceof CouchError && e.status === 409)) throw e;
    }
  }
  throw new CouchError(409, "switch changed concurrently");
}

export type SendingState = { paused: boolean; pausedAt: string | null; envDisabled: boolean; blocked: boolean };

/** What the admin sees. A read failure throws: the caller decides (the sender holds, the page shows an error). */
export async function sendingState(): Promise<SendingState> {
  const envDisabled = sendDisabledByEnv();
  const doc = await readSwitch();
  const paused = doc?.paused === true;
  return { paused, pausedAt: paused ? (doc?.at ?? null) : null, envDisabled, blocked: envDisabled || paused };
}

let lastWarn = 0;
/**
 * True when campaigns must not send now. Fails CLOSED: if the switch cannot be
 * read, the answer is "blocked", so an outage of the store can never be the
 * reason mail goes out against the owner's pause.
 */
export async function campaignsBlocked(): Promise<boolean> {
  if (sendDisabledByEnv()) return true;
  try {
    return (await readSwitch())?.paused === true;
  } catch (err) {
    const now = Date.now();
    if (now - lastWarn > 5 * 60_000) {
      lastWarn = now;
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "sending switch unreadable; campaigns are held");
    }
    return true;
  }
}
