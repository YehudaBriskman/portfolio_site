import type { SenderSettings } from "../announce/schemas.js";
import { loadSettings } from "../announce/store.js";
import { couch, CouchError } from "../db/couch.js";
import { logger } from "../logger.js";
import {
  BUDGET_THRESHOLDS, DAY_MS, computeBudget, dayKey, inWindow, monthKey, monthStart, thresholdsReached, transactionalAllowed,
  type Budget, type BudgetLimits, type BudgetThreshold, type Usage,
} from "./budget.js";

/*
 * Where the budget's counts come from. Newsletter sends are counted from the
 * send documents themselves (nothing is kept beside them, so a restart or a
 * restore cannot double count). Transactional mail leaves no send document, so
 * it has one tiny counter per UTC day, `mailcount:<yyyy-mm-dd>`: a number and
 * nothing else, never an address.
 */

const COUNTER = "mailcount:";
export const counterId = (ms: number) => `${COUNTER}${dayKey(ms)}`;

type Counter = { _id: string; _rev?: string; type: "mailcount"; day: string; count: number };

export const budgetLimits = (s: Pick<SenderSettings, "dailyLimit" | "monthlyLimit" | "safety" | "reserveShare">): BudgetLimits => ({
  dailyLimit: s.dailyLimit, monthlyLimit: s.monthlyLimit, safety: s.safety, reserveShare: s.reserveShare,
});

/**
 * Counts one transactional mail that the provider accepted. Best effort and
 * never throws: a lost count only makes the budget a little more generous, and
 * a confirmation is not worth failing over bookkeeping.
 */
export async function countTransactional(ms: number = Date.now()): Promise<void> {
  const id = counterId(ms);
  for (let i = 0; i < 4; i++) {
    try {
      let cur: Counter | null = null;
      try {
        cur = await couch.get<Counter>(id);
      } catch (e) {
        if (!(e instanceof CouchError && e.status === 404)) throw e;
      }
      if (cur) await couch.put(id, { ...cur, count: cur.count + 1 });
      else await couch.append(id, { _id: id, type: "mailcount", day: dayKey(ms), count: 1 });
      return;
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) continue;
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, "could not count a transactional mail");
      return;
    }
  }
}

/** Newsletter sends of the rolling day and the calendar month, plus the transactional counters for the same windows. `newsTimes` lets the caller say when a full day frees up. */
export async function readUsage(ms: number): Promise<{ usage: Usage; newsTimes: number[] }> {
  const since = Math.min(monthStart(ms), ms - DAY_MS);
  const newsTimes: number[] = [];
  let bookmark: string | undefined;
  for (;;) {
    const r = (await couch.find<{ at: string }>({
      selector: { type: "send", status: "sent", at: { $gte: new Date(since).toISOString() } }, fields: ["at"], limit: 500, ...(bookmark ? { bookmark } : {}),
    })) as { docs: Array<{ at: string }>; bookmark?: string };
    for (const d of r.docs) {
      const t = Date.parse(d.at);
      if (Number.isFinite(t)) newsTimes.push(t);
    }
    if (r.docs.length < 500 || !r.bookmark) break;
    bookmark = r.bookmark;
  }
  const start = monthStart(ms);
  const ids = new Set<string>([counterId(ms), counterId(ms - DAY_MS)]);
  for (let t = start; t <= ms; t += DAY_MS) ids.add(counterId(t));
  const counters = await couch.docs<Counter>([...ids]);
  const today = dayKey(ms);
  const yesterday = dayKey(ms - DAY_MS);
  const month = monthKey(ms);
  let transDay = 0;
  let transMonth = 0;
  for (const c of counters) {
    if (c.day === today || c.day === yesterday) transDay += c.count;
    if (c.day.startsWith(month)) transMonth += c.count;
  }
  return {
    usage: { newsDay: inWindow(newsTimes, ms), newsMonth: newsTimes.filter((t) => t >= start && t <= ms).length, transDay, transMonth },
    newsTimes,
  };
}

/** The budget as it stands at `ms` under the saved settings. */
export async function budgetNow(ms: number, sender?: SenderSettings): Promise<{ budget: Budget; usage: Usage; newsTimes: number[]; sender: SenderSettings }> {
  const s = sender ?? (await loadSettings()).sender;
  const { usage, newsTimes } = await readUsage(ms);
  return { budget: computeBudget(budgetLimits(s), usage), usage, newsTimes, sender: s };
}

/**
 * Whether one more transactional mail (a confirmation, the contact notice, an
 * auto-reply) fits. Answers from the reserved share, so a campaign cannot have
 * used up the room these need. Fails open: if the counts cannot be read the
 * answer is yes, because blocking a confirmation over bookkeeping is worse
 * than a mail over the safety margin.
 */
export async function canSendTransactional(ms: number = Date.now()): Promise<boolean> {
  try {
    const s = (await loadSettings()).sender;
    const { usage } = await readUsage(ms);
    return transactionalAllowed(budgetLimits(s), usage).ok;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "transactional budget unreadable, allowing");
    return true;
  }
}

/* --- threshold hook ----------------------------------------------------------
 * The owner notifier (not built here) subscribes with onBudgetThreshold. The
 * hook fires once per threshold per month while the process runs; a notifier
 * that must survive a restart keeps its own record. */

export type BudgetThresholdEvent = { threshold: BudgetThreshold; month: string; used: number; usable: number };
export type BudgetThresholdHook = (e: BudgetThresholdEvent) => void | Promise<void>;

const hooks = new Set<BudgetThresholdHook>();
const fired = new Map<string, Set<BudgetThreshold>>();

export function onBudgetThreshold(h: BudgetThresholdHook): () => void {
  hooks.add(h);
  return () => void hooks.delete(h);
}
/** For tests. */
export function resetBudgetThresholds(): void {
  hooks.clear();
  fired.clear();
  exhaustedHooks.clear();
  exhaustedSeen.clear();
}

export type BudgetExhaustedEvent = { scope: "day" | "month"; period: string };
const exhaustedHooks = new Set<(e: BudgetExhaustedEvent) => void | Promise<void>>();
const exhaustedSeen = new Set<string>();
/** Fires once per day or month in which the newsletter room ran out, while the process runs. */
export function onBudgetExhausted(h: (e: BudgetExhaustedEvent) => void | Promise<void>): () => void {
  exhaustedHooks.add(h);
  return () => void exhaustedHooks.delete(h);
}

/** Fires the hook for each threshold of the month reached and not yet announced. Never throws. */
export async function checkBudgetThresholds(ms: number, b: Pick<Budget, "usedMonth" | "usableMonth"> & Partial<Pick<Budget, "waiting">>): Promise<void> {
  if (b.waiting) {
    const scope = b.waiting;
    const period = scope === "month" ? monthKey(ms) : dayKey(ms);
    if (!exhaustedSeen.has(`${scope}:${period}`)) {
      exhaustedSeen.add(`${scope}:${period}`);
      for (const h of exhaustedHooks) {
        try {
          await h({ scope, period });
        } catch (err) {
          logger.warn({ scope, err: err instanceof Error ? err.message : String(err) }, "budget exhausted hook failed");
        }
      }
    }
  }
  const month = monthKey(ms);
  const seen = fired.get(month) ?? new Set<BudgetThreshold>();
  fired.set(month, seen);
  for (const threshold of thresholdsReached(b.usedMonth, b.usableMonth)) {
    if (seen.has(threshold)) continue;
    seen.add(threshold);
    for (const h of hooks) {
      try {
        await h({ threshold, month, used: b.usedMonth, usable: b.usableMonth });
      } catch (err) {
        logger.warn({ threshold, err: err instanceof Error ? err.message : String(err) }, "budget threshold hook failed");
      }
    }
  }
}

export { BUDGET_THRESHOLDS };
