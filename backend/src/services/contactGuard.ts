import { createHash } from "node:crypto";
import { env } from "../env.js";

/*
 * What the public contact form may cost. Each check says yes or no and the caller
 * answers the visitor the same either way, so a bot learns nothing from a limit.
 *
 * State is in process memory: the API is one process, and a restart only resets the
 * counters (a few extra mails at most, still bounded by the provider's own quota).
 * Addresses are never stored: the per-address window keys on a SHA-256 of the address.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per client IP: messages accepted in a window. */
export const CLIENT_LIMIT = 5;
export const CLIENT_WINDOW_MS = 15 * MINUTE;
/** Whole form, every client together: messages accepted in a window. */
export const GLOBAL_LIMIT = 30;
export const GLOBAL_WINDOW_MS = HOUR;
/** The same address gets at most one auto-reply in this window. */
export const ADDRESS_WINDOW_MS = HOUR;
/** Safety cap on tracked keys, so a flood of distinct values cannot grow memory without bound. */
const MAX_KEYS = 10_000;

class WindowCounter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Records a hit and answers whether it is within the limit. A refused hit is not recorded. */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    // Delete then set: Map keeps insertion order, so the oldest keys stay first for trim().
    this.hits.delete(key);
    this.hits.set(key, recent);
    this.trim(now);
    return true;
  }

  private trim(now: number) {
    if (this.hits.size <= MAX_KEYS) return;
    for (const [k, v] of this.hits) {
      if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    }
    for (const k of this.hits.keys()) {
      if (this.hits.size <= MAX_KEYS) break;
      this.hits.delete(k);
    }
  }
}

let clients = new WindowCounter(CLIENT_LIMIT, CLIENT_WINDOW_MS);
let overall = new WindowCounter(GLOBAL_LIMIT, GLOBAL_WINDOW_MS);
let addresses = new WindowCounter(1, ADDRESS_WINDOW_MS);
let day = { key: "", used: 0 };

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
const addressKey = (address: string) => createHash("sha256").update(address.trim().toLowerCase()).digest("hex");

/** Per-client and global limits for one incoming message. Both must pass; a refused client is not counted globally. */
export function allowMessage(clientIp: string, now = Date.now()): boolean {
  if (!clients.take(clientIp || "unknown", now)) return false;
  return overall.take("all", now);
}

/** True when this address has not had an auto-reply in the last hour; records the reply. */
export function allowAutoReply(address: string, now = Date.now()): boolean {
  return addresses.take(addressKey(address), now);
}

/**
 * The hard daily ceiling, in mails (the owner notice and the auto-reply each count one).
 * Reserves `count` mails and answers whether they fit under today's (UTC) ceiling.
 * Nothing is reserved when they do not fit.
 */
export function reserveDailyMails(count: number, now = Date.now()): boolean {
  const key = dayKey(now);
  if (day.key !== key) day = { key, used: 0 };
  if (day.used + count > env.CONTACT_DAILY_MAIL_CEILING) return false;
  day.used += count;
  return true;
}

/** Gives back a reservation for a mail that was not sent. */
export function releaseDailyMails(count: number, now = Date.now()) {
  if (day.key === dayKey(now)) day.used = Math.max(0, day.used - count);
}

/** Test seam: forget every counter. */
export function resetContactGuard() {
  clients = new WindowCounter(CLIENT_LIMIT, CLIENT_WINDOW_MS);
  overall = new WindowCounter(GLOBAL_LIMIT, GLOBAL_WINDOW_MS);
  addresses = new WindowCounter(1, ADDRESS_WINDOW_MS);
  day = { key: "", used: 0 };
}
