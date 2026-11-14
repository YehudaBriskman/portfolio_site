import type { Health, PauseReason } from "./schemas.js";

/*
 * When the sender stops a campaign by itself. Pure, so the rules are tested
 * without a clock or a store. Only the owner resumes.
 *
 * Thresholds follow the providers' own limits: Resend asks for a bounce rate
 * under 4% and a spam rate under 0.08%, Google never wants 0.30%. On a small
 * list one complaint already exceeds both, so early on it pauses at once.
 */
const PAUSE_STREAK = 5;
const MIN_ATTEMPTS = 20;
const PAUSE_FAIL_RATE = 0.1;
export const PAUSE_HARD_RATE = 0.03;
/* Below MIN_ATTEMPTS a percentage means nothing, so a count decides. */
const PAUSE_HARD_COUNT = 3;
/* "Early": the first sends of a campaign, or while the sender is warming up. */
export const EARLY_SENDS = 500;
const LATER_COMPLAINTS = 2;
const LATER_COMPLAINT_RATE = 0.003;

/** Why the campaign should stop now, judged on what happened since it started or was last resumed. */
export function pauseReason(h: Health): PauseReason | null {
  if (h.streak >= PAUSE_STREAK) return "consecutive";
  if (h.hard >= PAUSE_HARD_COUNT) return "hard-bounce-rate";
  const attempts = h.sent + h.failed;
  if (attempts < MIN_ATTEMPTS) return null;
  if (h.hard / attempts >= PAUSE_HARD_RATE) return "hard-bounce-rate";
  if (h.failed / attempts >= PAUSE_FAIL_RATE) return "failure-rate";
  return null;
}

/** True when the complaints so far justify pausing. */
export function complaintPause(x: { complaints: number; sent: number; warming: boolean }): boolean {
  if (x.complaints <= 0) return false;
  if (x.warming || x.sent < EARLY_SENDS) return true;
  return x.complaints >= LATER_COMPLAINTS || x.complaints / Math.max(1, x.sent) >= LATER_COMPLAINT_RATE;
}

/**
 * One spam complaint arrived. Counts it on a campaign that is sending and
 * pauses that campaign when the rules say so. Returns false (and leaves the
 * campaign alone) for any other status.
 */
export function applyComplaint(c: { status: string; health?: Health; counters: { sent: number }; pausedReason?: PauseReason }, warming: boolean): boolean {
  if (c.status !== "sending") return false;
  const h: Health = { sent: 0, failed: 0, hard: 0, streak: 0, ...c.health };
  h.complaints = (h.complaints ?? 0) + 1;
  c.health = h;
  if (complaintPause({ complaints: h.complaints, sent: Math.max(h.sent, c.counters.sent), warming })) {
    c.status = "paused";
    c.pausedReason = "complaint";
  }
  return true;
}
