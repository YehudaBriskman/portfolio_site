import { loadSettings } from "../announce/store.js";
import type { NotifyEvent } from "../announce/schemas.js";
import { onBudgetExhausted, onBudgetThreshold, readUsage } from "../campaigns/budgetStore.js";
import { reserveOf, usableOf } from "../campaigns/budget.js";
import { onComplaintReceived } from "../audience/complaintHook.js";
import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import { SITE_URL } from "../services/seo.js";
import { emitOwnerEvent, onOwnerEvent, type OwnerEvent } from "./hooks.js";
import { composeOwnerMail } from "./texts.js";

/*
 * The owner notifier: one mail to CONTACT_TO per event (or one daily summary),
 * through the transactional renderer. It is the only subscriber of the event
 * seams, so a campaign, a webhook or the sweep never waits for it and never
 * fails because of it.
 *
 * Rules held here:
 *  - a notice counts toward the provider's daily total (the transactional
 *    counter does that in the email service) but never against a campaign's
 *    budget, and it is skipped, not queued, once the reserved transactional
 *    share is spent: a notice must not eat the room confirmations need;
 *  - each kind is sent at most once per its configured hours; events inside
 *    that window are only counted and mentioned in the next notice;
 *  - the state document holds timestamps and counts, never an address.
 */

export const STATE_ID = "notifystate:owner";
type Stored = { event: OwnerEvent };
export type NotifyState = {
  _id: typeof STATE_ID;
  _rev?: string;
  type: "notifystate";
  last: Partial<Record<NotifyEvent, string>>;
  held: Partial<Record<NotifyEvent, number>>;
  queue: Stored[];
  digestDay?: string;
};
const QUEUE_MAX = 100;
const DIGEST_KINDS = new Set<NotifyEvent>(["bounce", "campaign", "subscriber"]);

async function loadState(): Promise<NotifyState> {
  try {
    return await couch.get<NotifyState>(STATE_ID);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return { _id: STATE_ID, type: "notifystate", last: {}, held: {}, queue: [] };
    throw e;
  }
}
const saveState = (s: NotifyState) => couch.put(STATE_ID, s);

/* Events are handled one at a time so two arriving together cannot both pass the de-dup. */
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
};

/** True while the reserved transactional share of the day has room. Unreadable counts mean no: a notice is never worth the risk. */
export async function reserveHasRoom(now: number): Promise<boolean> {
  try {
    const s = (await loadSettings()).sender;
    const { usage } = await readUsage(now);
    return usage.transDay < reserveOf(usableOf(s.dailyLimit, s.safety), s.reserveShare);
  } catch {
    return false;
  }
}

const link = () => `${SITE_URL}/admin/announce`;

async function deliver(entries: OwnerEvent[], lang: "en" | "he", o: { held?: number; digest?: boolean }): Promise<boolean> {
  try {
    const { subject, html, text } = composeOwnerMail(entries, lang, { ...o, link: link() });
    /* No replyTo: that is what makes the email service send a visitor an auto-reply. */
    const r = (await emailService.send({ subject, html, text })) as { ok?: boolean };
    if (r?.ok === false) logger.warn({ kind: entries[0]?.kind }, "owner notification not accepted by the provider");
    return r?.ok !== false;
  } catch {
    logger.warn({ kind: entries[0]?.kind }, "owner notification failed");
    return false;
  }
}

/** Decides and sends for one event. Never throws. */
export function handleOwnerEvent(ev: OwnerEvent, now = Date.now()): Promise<void> {
  return serial(async () => {
    try {
      const n = (await loadSettings()).notify;
      const rule = n.events[ev.kind];
      if (!n.enabled || !rule.on) return;
      const st = await loadState();
      if (n.digest.enabled && DIGEST_KINDS.has(ev.kind)) {
        st.queue = [...st.queue, { event: ev }].slice(-QUEUE_MAX);
        await saveState(st);
        return;
      }
      const last = Date.parse(st.last[ev.kind] ?? "");
      if (Number.isFinite(last) && now - last < rule.hours * 3_600_000) {
        st.held[ev.kind] = (st.held[ev.kind] ?? 0) + 1;
        await saveState(st);
        return;
      }
      if (!(await reserveHasRoom(now))) {
        logger.info({ kind: ev.kind }, "owner notification skipped: transactional reserve is spent");
        return;
      }
      if (await deliver([ev], n.lang, { held: st.held[ev.kind] })) {
        st.last[ev.kind] = new Date(now).toISOString();
        delete st.held[ev.kind];
        await saveState(st);
      }
    } catch {
      logger.warn({ kind: ev.kind }, "owner notification not handled");
    }
  });
}

const localParts = (now: number, tz: string) => {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  } catch {
    return { day: new Date(now).toISOString().slice(0, 10), hour: new Date(now).getUTCHours() };
  }
};

/** Sends the waiting summary once a day, from the configured local hour. Never throws. */
export function runOwnerDigest(now = Date.now()): Promise<boolean> {
  return serial(async () => {
    try {
      const settings = await loadSettings();
      const n = settings.notify;
      const st = await loadState();
      if (!st.queue.length) return false;
      const { day, hour } = localParts(now, settings.sender.quietHours?.tz ?? "Asia/Jerusalem");
      /* Turning the digest off flushes what is waiting at the next pass. */
      if (n.digest.enabled && (hour < n.digest.hour || st.digestDay === day)) return false;
      if (!n.enabled || !(await reserveHasRoom(now))) return false;
      if (!(await deliver(st.queue.map((q) => q.event), n.lang, { digest: true }))) return false;
      st.queue = [];
      st.digestDay = day;
      await saveState(st);
      return true;
    } catch {
      logger.warn("owner digest not handled");
      return false;
    }
  });
}

/** Subscribes to every seam and starts the hourly digest check. Returns the function that undoes it. */
export function startOwnerNotifier(every = 3_600_000): () => void {
  const offs = [
    onOwnerEvent((e) => handleOwnerEvent(e)),
    onBudgetThreshold((e) => emitOwnerEvent({ kind: e.threshold === 70 ? "budget70" : "budget90", used: e.used, usable: e.usable })),
    onBudgetExhausted((e) => emitOwnerEvent({ kind: "budgetOut", scope: e.scope })),
    onComplaintReceived((e) => emitOwnerEvent({ kind: "bounce", reason: e.reason ?? "complaint", ref: e.hash.slice(0, 6) })),
  ];
  const t = setInterval(() => void runOwnerDigest(), every);
  t.unref?.();
  return () => {
    clearInterval(t);
    for (const off of offs) off();
  };
}

