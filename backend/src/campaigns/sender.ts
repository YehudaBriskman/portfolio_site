import type { SenderSettings } from "../announce/schemas.js";
import { loadSettings } from "../announce/store.js";
import { couch } from "../db/couch.js";
import { listRecipients, getContact, isSuppressed, updateContact } from "../audience/store.js";
import { cachedKind, ledgerPutQuietly } from "../audience/ledger.js";
import { logger } from "../logger.js";
import { emitOwnerEvent } from "../notify/hooks.js";
import { budgetNow, checkBudgetThresholds } from "./budgetStore.js";
import { ledgerGuard } from "./guard.js";
import { emailService, type BulkMessage } from "../services/email.service.js";
import { resolveSender } from "./config.js";
import { renderCampaignMail } from "./render.js";
import type { Campaign, Health, PauseReason, SendResult } from "./schemas.js";
import {
  claimSend, finishSend, getCampaign, getRate, isStatus, mutateCampaign, putRate, resultsOf, sendId, sentCounts,
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
/* A transient failure (relay busy, timeout) is tried again after this long, up to MAX_TRIES attempts in all. */
const RETRY_MS = 15 * 60_000;
const MAX_TRIES = 3;
/** The window of the per-person monthly limit. */
export const CAP_WINDOW_MS = 30 * 24 * 3_600_000;
/* Consecutive soft failures, across campaigns, before an address is suppressed. */
const SOFT_LIMIT = 3;
/* Auto-pause: the owner fixes the cause, then resumes. Rates are only judged once there are enough attempts to mean something. */
const PAUSE_STREAK = 5;
const MIN_ATTEMPTS = 20;
const PAUSE_FAIL_RATE = 0.1;
const PAUSE_HARD_RATE = 0.05;

/** Why the campaign should stop now, judged on what happened since it started or was last resumed. */
export function pauseReason(h: Health): PauseReason | null {
  if (h.streak >= PAUSE_STREAK) return "consecutive";
  const attempts = h.sent + h.failed;
  if (attempts < MIN_ATTEMPTS) return null;
  if (h.hard / attempts >= PAUSE_HARD_RATE) return "hard-bounce-rate";
  if (h.failed / attempts >= PAUSE_FAIL_RATE) return "failure-rate";
  return null;
}

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

/** Takes an address off the mailing list for good reason. Only an active contact is touched; never deletes. Never logs the address. */
async function suppressBounced(hash: string, reason: "hard-bounce" | "soft-bounces"): Promise<void> {
  await ledgerPutQuietly(hash, "suppressed");
  try {
    await updateContact(hash, (c) => {
      if (c.status !== "active") return false;
      c.status = "suppressed";
      c.suppressedReason = reason;
      delete c.softBounces;
    });
  } catch (err) {
    logger.warn({ reason, err: err instanceof Error ? err.message : String(err) }, "could not suppress a bounced contact");
  }
}

/** Counts one more soft failure for the contact and suppresses it on the SOFT_LIMIT-th in a row. */
async function noteSoftBounce(hash: string): Promise<void> {
  let reached = false;
  try {
    await updateContact(hash, (c) => {
      if (c.status !== "active") return false;
      c.softBounces = (c.softBounces ?? 0) + 1;
      reached = c.softBounces >= SOFT_LIMIT;
    });
  } catch {
    return;
  }
  if (reached) await suppressBounced(hash, "soft-bounces");
}

async function clearSoftBounces(hash: string): Promise<void> {
  try {
    await updateContact(hash, (c) => {
      if (!c.softBounces) return false;
      delete c.softBounces;
    });
  } catch {
    /* A stale counter only makes suppression a little earlier; a delivered mail is not worth failing the batch. */
  }
}

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

/* The counters are a view of the result docs, which are written before and after each
   mail and survive a crash; adding up per-batch tallies loses every mail of a batch
   that was cut short, which the resumed run then skips. */
function tally(results: Iterable<SendResult>) {
  const n = { sent: 0, failed: 0, suppressed: 0 };
  let capped = 0;
  for (const r of results) {
    if (r.status === "capped") capped++;
    else if (r.status === "sent" || r.status === "failed" || r.status === "suppressed") n[r.status]++;
  }
  /* Only present once there is one, so a campaign the limit never touched keeps the counters it always had. */
  return capped > 0 ? { ...n, capped } : n;
}

async function runCampaign(c: Campaign, settings: SenderSettings, deps: Required<SenderDeps>): Promise<void> {
  const id = c._id.slice("campaign:".length);
  const done = await resultsOf(id);
  const ms = deps.now();

  /* Everyone still to do, in id order. Stale attempts from a crashed run come back in. */
  const todo: Array<{ hash: string; lang: "en" | "he" }> = [];
  let queued = 0;
  let waiting = 0;
  for await (const r of listRecipients({ groups: c.groups, ...(c.lang && c.lang !== "all" ? { lang: c.lang } : {}), ...(c.topic ? { topic: c.topic } : {}) })) {
    queued++;
    const hash = r._id.slice("contact:".length);
    const prev = done.get(hash);
    if (prev?.status === "deferred") {
      /* Not final: due again at retryAt. Until then the campaign is not finished. */
      if (Date.parse(prev.retryAt ?? prev.at) > ms) { waiting++; continue; }
    } else if (prev && !(prev.status === "attempting" && ms - Date.parse(prev.at) > STALE_ATTEMPT_MS)) continue;
    todo.push({ hash, lang: r.lang ?? "en" });
  }

  if (todo.length === 0) {
    if (waiting > 0) {
      await mutateCampaign(id, (x) => {
        if (x.status !== "sending") return false;
        Object.assign(x.counters, tally(done.values()));
      });
      return;
    }
    let finished: Campaign | null = null;
    await mutateCampaign(id, (x) => {
      if (x.status !== "sending") return false;
      x.counters.queued = Math.max(x.counters.queued, queued);
      Object.assign(x.counters, tally(done.values()));
      /* "Sent" would hide a run where most mail failed. */
      const attempts = x.counters.sent + x.counters.failed;
      x.status = x.counters.failed > 0 && x.counters.failed * 2 >= attempts ? "failed" : "sent";
      x.finishedAt = new Date(ms).toISOString();
      finished = x;
    });
    if (finished) {
      const f = finished as Campaign;
      emitOwnerEvent({ kind: "campaign", name: f.name, status: f.status === "failed" ? "failed" : "sent", sent: f.counters.sent, failed: f.counters.failed, suppressed: f.counters.suppressed });
    }
    logger.info({ campaign: id }, "campaign finished");
    return;
  }

  /* Read before the budget is reserved, so a failed read (nothing is sent) costs no budget. Checked again per recipient below, against this fresh count. */
  const limit = Math.floor(settings.maxPerContact30d);
  const counts = limit > 0 && !c.capOverride ? await sentCounts(ms - CAP_WINDOW_MS, id) : null;
  /* The provider's quota: counted from the send docs, never remembered, so a restart cannot double count. A failed read throws and nothing is sent. */
  const { budget } = await budgetNow(ms, settings);
  await checkBudgetThresholds(ms, budget);
  if (budget.capacity <= 0) {
    logger.debug({ campaign: id, waiting: budget.waiting }, "campaign waits for the mail budget");
    return;
  }
  const granted = await reserve(settings, Math.min(BATCH_MAX, todo.length, budget.capacity), ms);
  if (granted === 0) return;
  const from = resolveSender(settings);
  let used = 0;
  let sent = 0, failed = 0, suppressed = 0, capped = 0;
  const h: Health = { sent: 0, failed: 0, hard: 0, streak: 0, ...c.health };
  let pause: PauseReason | null = null;

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
    if (!contact || contact.status !== "active" || cachedKind(t.hash) || (await isSuppressed(contact.email))) {
      await finishSend({ ...base, status: "suppressed" });
      suppressed++;
      continue;
    }
    /* Not a failure: no mail, a final result, and nothing the auto-pause rules see. */
    if (counts && (counts.get(t.hash) ?? 0) >= limit) {
      await finishSend({ ...base, status: "capped" });
      capped++;
      continue;
    }
    used++;
    let result: Awaited<ReturnType<Deliver>>[number] | undefined;
    try {
      const mail = await renderCampaignMail(c, { lang: contact.lang ?? "en" }, t.hash, settings);
      [result] = await deps.deliver([{ to: contact.email, ...mail }], { from: from.from, replyTo: from.replyTo });
    } catch (err) {
      result = { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    const at = new Date(deps.now()).toISOString();
    if (result?.ok) {
      await finishSend({ ...base, status: "sent", at });
      sent++;
      h.sent++;
      h.streak = 0;
      if (contact.softBounces) await clearSoftBounces(t.hash);
      /* A rate is only judged once there are enough attempts, which a delivery can be the one to reach. */
      pause = pauseReason(h);
      if (pause) break;
      continue;
    }
    const kind = result?.kind ?? "unknown";
    const code = result?.code;
    const note = { error: scrub(result?.error ?? "unknown"), kind, ...(code !== undefined ? { code } : {}) };
    const tries = (stale?.tries ?? 0) + 1;
    h.streak++;
    if (kind === "transient" && tries < MAX_TRIES) {
      await finishSend({ ...base, status: "deferred", at, tries, retryAt: new Date(deps.now() + RETRY_MS).toISOString(), ...note });
    } else {
      await finishSend({ ...base, status: "failed", at, ...(kind === "transient" ? { tries } : {}), ...note });
      failed++;
      h.failed++;
      if (kind === "hard") {
        h.hard++;
        await suppressBounced(t.hash, "hard-bounce");
      } else if (kind === "soft") await noteSoftBounce(t.hash);
    }
    pause = kind === "auth" ? "auth" : pauseReason(h);
    if (pause) break;
  }

  await refund(settings, granted - used, ms);
  const stop = pause as PauseReason | null;
  const all = await resultsOf(id);
  await mutateCampaign(id, (x) => {
    x.counters.queued = Math.max(x.counters.queued, queued);
    Object.assign(x.counters, tally(all.values()));
    x.health = { ...h };
    if (stop && x.status === "sending") {
      x.status = "paused";
      x.pausedReason = stop;
    }
  });
  logger.info({ campaign: id, sent, failed, suppressed, capped, ...(stop ? { paused: stop } : {}) }, "campaign batch done");
  if (sent > 0) {
    try {
      await checkBudgetThresholds(ms, (await budgetNow(deps.now(), settings)).budget);
    } catch {
      /* An alert that cannot be computed is skipped; the next batch tries again. */
    }
  }
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
    /* No readable ledger, or contacts it protects that cannot be put right: nothing is claimed or continued. */
    if (docs.length > 0 && !(await ledgerGuard(ms)).ok) return;
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
