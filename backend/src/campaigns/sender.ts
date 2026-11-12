import type { SenderSettings } from "../announce/schemas.js";
import { loadSettings } from "../announce/store.js";
import { couch } from "../db/couch.js";
import { listRecipients, getContact, isSuppressed } from "../audience/store.js";
import { logger } from "../logger.js";
import { emailService, type BulkMessage } from "../services/email.service.js";
import { resolveSender } from "./config.js";
import { renderCampaignMail } from "./render.js";
import type { Campaign, SendResult } from "./schemas.js";
import {
  claimSend, finishSend, getCampaign, getRate, isStatus, mutateCampaign, putRate, resultsOf, sendId,
  RATE_ID, type RateState,
} from "./store.js";

/*
 * The sender tick. State lives in CouchDB, so a restart resumes where it was:
 * a campaign is `scheduled` -> `sending` (claimed with its _rev; a 409 means
 * another tick won) -> `sent`. Each recipient has its own result doc
 * `send:<campaign>:<hash>`, created BEFORE the mail goes out; that doc is what
 * makes a resumed or doubled-up run skip people already done.
 *
 * No address is ever logged or stored in a result: a failure message is
 * scrubbed of anything that looks like one.
 */

const BATCH_MAX = 25;
const TICK_MS = 30_000;
/* An "attempting" doc this old belongs to a crashed run: its mail is retried. */
const STALE_ATTEMPT_MS = 5 * 60_000;

type Clock = () => number;
export type Deliver = (msgs: BulkMessage[], opts: { from: string; replyTo?: string }) => ReturnType<typeof emailService.sendBulk>;
export type SenderDeps = { now?: Clock; deliver?: Deliver };

/* --- time rules ------------------------------------------------------------- */

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { day: `${o.year}-${o.month}-${o.day}`, hour: `${o.year}-${o.month}-${o.day}T${o.hour}`, minutes: Number(o.hour) * 60 + Number(o.minute) };
}
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** True inside the owner's quiet window (which may wrap past midnight). `from` is inclusive, `to` exclusive. */
export function inQuietHours(q: SenderSettings["quietHours"], ms: number): boolean {
  if (!q) return false;
  const m = parts(ms, q.tz).minutes;
  const a = toMin(q.from);
  const b = toMin(q.to);
  if (a === b) return false;
  return a < b ? m >= a && m < b : m >= a || m < b;
}

/* --- rate budget ------------------------------------------------------------ */

function rolled(prev: RateState | null, s: SenderSettings, ms: number): RateState {
  const p = parts(ms, s.quietHours?.tz ?? "UTC");
  const sameHour = prev?.hour === p.hour;
  const sameDay = prev?.day === p.day;
  return {
    _id: RATE_ID, ...(prev?._rev ? { _rev: prev._rev } : {}), type: "sender-state",
    hour: p.hour, hourCount: sameHour ? prev!.hourCount : 0,
    day: p.day, dayCount: sameDay ? prev!.dayCount : 0,
  };
}

/** Reserves up to `want` sends from the hour and day budget. Reserved BEFORE sending, so a crash never overspends. 0 when none is left or another tick won the race. */
async function reserve(s: SenderSettings, want: number, ms: number): Promise<number> {
  const st = rolled(await getRate(), s, ms);
  const n = Math.min(want, s.throttlePerHour - st.hourCount, s.dailyCap - st.dayCount);
  if (n <= 0) return 0;
  st.hourCount += n;
  st.dayCount += n;
  try {
    await putRate(st);
  } catch (e) {
    if (isStatus(e, 409)) return 0;
    throw e;
  }
  return n;
}

/** Gives back what a batch reserved but did not use. Best effort. */
async function refund(s: SenderSettings, n: number, ms: number): Promise<void> {
  if (n <= 0) return;
  try {
    const st = rolled(await getRate(), s, ms);
    st.hourCount = Math.max(0, st.hourCount - n);
    st.dayCount = Math.max(0, st.dayCount - n);
    await putRate(st);
  } catch {
    /* A lost refund only makes the budget stricter. */
  }
}

/* --- one campaign ------------------------------------------------------------ */

const scrub = (msg: string) => msg.replace(/[^\s<>"',;]+@[^\s<>"',;]+/g, "[address]").slice(0, 200);

async function claimCampaign(c: Campaign, ms: number): Promise<Campaign | null> {
  const fresh = await getCampaign(c._id.slice("campaign:".length));
  if (!fresh || fresh.status !== "scheduled") return null;
  fresh.status = "sending";
  fresh.startedAt = new Date(ms).toISOString();
  fresh.updatedAt = fresh.startedAt;
  try {
    const r = await couch.put<{ rev?: string }>(fresh._id, fresh);
    if (r && typeof r.rev === "string") fresh._rev = r.rev;
    return fresh;
  } catch (e) {
    if (isStatus(e, 409)) return null;
    throw e;
  }
}

async function runCampaign(c: Campaign, settings: SenderSettings, deps: Required<SenderDeps>): Promise<void> {
  const id = c._id.slice("campaign:".length);
  const done = await resultsOf(id);
  const ms = deps.now();

  /* Everyone still to do, in id order. Stale attempts from a crashed run come back in. */
  const todo: Array<{ hash: string; lang: "en" | "he" }> = [];
  let queued = 0;
  for await (const r of listRecipients({ groups: c.groups, ...(c.lang && c.lang !== "all" ? { lang: c.lang } : {}), ...(c.topic ? { topic: c.topic } : {}) })) {
    queued++;
    const hash = r._id.slice("contact:".length);
    const prev = done.get(hash);
    if (prev && !(prev.status === "attempting" && ms - Date.parse(prev.at) > STALE_ATTEMPT_MS)) continue;
    todo.push({ hash, lang: r.lang });
  }

  if (todo.length === 0) {
    await mutateCampaign(id, (x) => {
      if (x.status !== "sending") return false;
      x.counters.queued = Math.max(x.counters.queued, queued);
      x.status = x.counters.sent === 0 && x.counters.failed > 0 ? "failed" : "sent";
      x.finishedAt = new Date(ms).toISOString();
    });
    logger.info({ campaign: id }, "campaign finished");
    return;
  }

  const granted = await reserve(settings, Math.min(BATCH_MAX, todo.length), ms);
  if (granted === 0) return;
  const from = resolveSender(settings);
  let used = 0;
  let sent = 0, failed = 0, suppressed = 0;

  for (const t of todo.slice(0, granted)) {
    /* Cancel (or any other change of state) stops the run at the next recipient. */
    const live = await getCampaign(id);
    if (!live || live.status !== "sending") break;
    const contact = await getContact(t.hash);
    const base: SendResult = { _id: sendId(id, t.hash), type: "send", campaignId: id, contact: t.hash, status: "attempting", at: new Date(deps.now()).toISOString() };
    const stale = done.get(t.hash);
    if (stale) {
      /* Taken over with the revision we saw: if another worker got there first, it is theirs. */
      try {
        await couch.put(base._id, { ...base, _rev: stale._rev });
      } catch (e) {
        if (isStatus(e, 409)) continue;
        throw e;
      }
    } else if (!(await claimSend(base))) continue;
    /* Never to anyone no longer active or on the suppression list: checked on the fresh record, not the scan. */
    if (!contact || contact.status !== "active" || (await isSuppressed(contact.email))) {
      await finishSend({ ...base, status: "suppressed" });
      suppressed++;
      continue;
    }
    used++;
    let result;
    try {
      const mail = await renderCampaignMail(c, contact, t.hash, settings);
      [result] = await deps.deliver([{ to: contact.email, ...mail }], { from: from.from, replyTo: from.replyTo });
    } catch (err) {
      result = { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    if (result?.ok) {
      await finishSend({ ...base, status: "sent", at: new Date(deps.now()).toISOString() });
      sent++;
    } else {
      await finishSend({ ...base, status: "failed", at: new Date(deps.now()).toISOString(), error: scrub(result?.error ?? "unknown") });
      failed++;
    }
  }

  await refund(settings, granted - used, ms);
  await mutateCampaign(id, (x) => {
    x.counters.queued = Math.max(x.counters.queued, queued);
    x.counters.sent += sent;
    x.counters.failed += failed;
    x.counters.suppressed += suppressed;
  });
  logger.info({ campaign: id, sent, failed, suppressed }, "campaign batch done");
}

/* --- the tick ------------------------------------------------------------------ */

let running = false;

/** One pass: claim what is due, then give each sending campaign one batch. Never throws. */
export async function runSenderTick(deps: SenderDeps = {}): Promise<void> {
  if (running) return;
  running = true;
  const d: Required<SenderDeps> = { now: deps.now ?? Date.now, deliver: deps.deliver ?? ((m, o) => emailService.sendBulk(m, o)) };
  try {
    const settings = (await loadSettings()).sender;
    const ms = d.now();
    if (inQuietHours(settings.quietHours, ms)) return;
    const { docs } = await couch.find<Campaign>({ selector: { _id: { $gt: "campaign:", $lt: "campaign:\uffff" }, status: { $in: ["scheduled", "sending"] } }, limit: 200 });
    for (const c of docs.sort((a, b) => (a.sendAt ?? a.createdAt).localeCompare(b.sendAt ?? b.createdAt))) {
      try {
        let cur: Campaign | null = c;
        if (c.status === "scheduled") {
          if (!c.sendAt || Date.parse(c.sendAt) > ms) continue;
          cur = await claimCampaign(c, ms);
        }
        if (cur) await runCampaign(cur, settings, d);
      } catch (err) {
        logger.warn({ campaign: c._id, err: err instanceof Error ? err.message : String(err) }, "campaign tick failed");
      }
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "sender tick failed");
  } finally {
    running = false;
  }
}

export function startSender(every = TICK_MS): () => void {
  const t = setInterval(() => void runSenderTick(), every);
  t.unref?.();
  return () => clearInterval(t);
}
