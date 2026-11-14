import { ContentInvalidError, type Issue } from "./adminContent";

/*
 * The owner's campaigns (/api/admin/campaigns). Shapes copied from the
 * server's `view` in backend/src/campaigns/route.ts. A campaign holds no
 * address; the audience route answers with a count and three masked samples.
 * The mail HTML is rendered on the server from `bodyText` or `blocks`: the
 * client never sends HTML.
 */

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "canceled", "paused"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type CampaignLang = "en" | "he" | "all";
/** Why the sender stopped the campaign by itself. */
export type PauseReason = "auth" | "consecutive" | "failure-rate" | "hard-bounce-rate" | "complaint";
export type CampaignTopic = "blog" | "releases";

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "cta"; url: string; label: string }
  | { type: "image"; url: string; text?: string };
export type BlockType = Block["type"];

export type Counters = { queued: number; sent: number; failed: number; suppressed: number; /** Skipped by the per-person monthly limit; absent until one is. */ capped?: number };

export type Campaign = {
  id: string;
  _rev: string | null;
  name: string;
  subject: string;
  preheader: string;
  bodyText: string;
  blocks: Block[] | null;
  groups: string[];
  lang: CampaignLang;
  topic: CampaignTopic | null;
  status: CampaignStatus;
  sendAt: string | null;
  counters: Counters;
  eventId: string | null;
  pausedReason: PauseReason | null;
  /** When the current text was last test-sent to the owner; null when it was never, or was edited since. */
  testedAt: string | null;
  /** Set when the owner sent past the monthly limit. */
  capOverride: { at: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignInput = {
  name: string;
  subject: string;
  preheader?: string;
  bodyText: string;
  blocks?: Block[] | null;
  groups: string[];
  lang: CampaignLang;
  topic?: CampaignTopic | null;
  eventId?: string;
};

/** Present when the monthly limit is on: how many of `count` already got `cap` mails in 30 days. */
export type AudienceSample = { count: number; samples: string[]; overCap?: number; cap?: number };
/** What the owner chooses when the limit blocks a send: the capped are skipped, or everyone is sent to. */
export type CapChoice = { skipCapped?: boolean; overrideCap?: boolean; /** The audience size the owner confirmed; the server refuses when it no longer matches. */ confirmCount?: number };
export type CapInfo = { code: "cap"; capped: number; total: number; max: number };

/** The mail budget (GET /budget): counts only. `plan` is present when `remaining` was asked; null means the settings leave no room at all. */
export type ReadinessView = { domain: string | null; replyTo: boolean; items: Array<{ id: "spf" | "dkim" | "dmarc" | "domainMatch" | "replyTo" | "identity" | "testRecipient" | "webhook"; status: "ok" | "fix" | "unknown" | "info" }> };
export type BudgetView = {
  today: { used: number; usable: number; reserve: number; room: number };
  month: { used: number; usable: number; room: number };
  capacity: number;
  waiting: "day" | "month" | null;
  resumeAt: string | null;
  thresholds: Array<70 | 90>;
  /** The new-sender ramp today, or null when it is off or over. */
  warmup?: { day: number; daily: number; hourly: number } | null;
  plan?: { days: number; finishAt: string } | null;
};

export class CampaignConflictError extends Error {
  constructor(message = "conflict") {
    super(message);
  }
}
/** A refusal with a sentence the server wrote for the owner (422 / 409). */
export class CampaignRefusedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly cap?: CapInfo,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/campaigns${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("api-down");
  }
  const msg = (body as { error?: unknown } | null)?.error;
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 400) {
    const raw = (body as { issues?: unknown } | null)?.issues;
    throw new ContentInvalidError("invalid", Array.isArray(raw) ? (raw as Issue[]) : []);
  }
  if (res.status === 409 && typeof msg === "string" && /changed elsewhere/i.test(msg)) throw new CampaignConflictError();
  if (res.status === 409 || res.status === 422 || res.status === 423) {
    const b = body as Partial<CapInfo> | null;
    const cap = b?.code === "cap" && typeof b.capped === "number" && typeof b.total === "number" && typeof b.max === "number" ? { code: "cap" as const, capped: b.capped, total: b.total, max: b.max } : undefined;
    throw new CampaignRefusedError(typeof msg === "string" ? msg : "refused", res.status, cap);
  }
  if (!res.ok) throw new Error(`status-${res.status}`);
  return body as T;
}

const enc = encodeURIComponent;
function parseSending(r: Partial<SendingState> | null): SendingState {
  if (!r || typeof r.paused !== "boolean" || typeof r.envDisabled !== "boolean") throw new Error("bad-sending");
  return { paused: r.paused, pausedAt: typeof r.pausedAt === "string" ? r.pausedAt : null, envDisabled: r.envDisabled, blocked: r.paused || r.envDisabled, settingsHold: typeof r.settingsHold === "string" ? r.settingsHold : null };
}
const json = (b: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(b) });

/** The kill switch (GET/POST /sending): `paused` is the owner's click, `envDisabled` is SEND_ENABLED=false, which this page cannot lift. */
export type SendingState = { paused: boolean; pausedAt: string | null; envDisabled: boolean; blocked: boolean; /** Why the sender is holding on its settings (server text), or null. */ settingsHold: string | null };

export const adminCampaigns = {
  list: async () => (await call<{ campaigns: Campaign[] }>("")).campaigns,
  get: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}`)).campaign,
  create: async (b: CampaignInput) => (await call<{ campaign: Campaign }>("", json(b))).campaign,
  update: async (id: string, b: Partial<CampaignInput>, rev: string | null) =>
    (await call<{ campaign: Campaign }>(`/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ ...b, ...(rev ? { _rev: rev } : {}) }) })).campaign,
  remove: (id: string) => call<{ ok: true }>(`/${enc(id)}`, { method: "DELETE" }),
  /** The count and masked samples for a selection, saved or not: the page asks as the boxes are ticked. */
  audienceOf: async (sel: { groups: string[]; lang: CampaignLang; topic: CampaignTopic | null }): Promise<AudienceSample> => {
    const r = await call<AudienceSample>("/audience", json(sel));
    return { count: r.count ?? 0, samples: Array.isArray(r.samples) ? r.samples : [], ...(typeof r.overCap === "number" && typeof r.cap === "number" ? { overCap: r.overCap, cap: r.cap } : {}) };
  },
  sending: async (): Promise<SendingState> => parseSending(await call<Partial<SendingState> | null>("/sending")),
  /** One click: `true` holds every campaign, `false` lets them carry on. */
  setPaused: async (paused: boolean): Promise<SendingState> => parseSending(await call<Partial<SendingState> | null>("/sending", json({ paused }))),
  /** The mail budget now and, given how many are still to send, how many days that takes. */
  readiness: async (): Promise<ReadinessView> => await call<ReadinessView>("/readiness"),
  budget: async (remaining?: number): Promise<BudgetView> => {
    const r = await call<Partial<BudgetView> | null>(`/budget${remaining === undefined ? "" : `?remaining=${Math.max(0, Math.floor(remaining))}`}`);
    if (!r || typeof r.today?.used !== "number" || typeof r.month?.used !== "number" || typeof r.capacity !== "number") throw new Error("bad-budget");
    return { ...(r as BudgetView), thresholds: Array.isArray(r.thresholds) ? r.thresholds : [] };
  },
  /** The mail as the server would send it, from draft text that need not be saved. */
  preview: (b: { subject: string; preheader: string; bodyText: string; blocks: Block[] | null; lang: "en" | "he" }) =>
    call<{ subject: string; html: string; text: string }>("/preview", json(b)),
  test: (id: string) => call<{ sent: number; failed: number }>(`/${enc(id)}/test`, { method: "POST" }),
  /** `null` takes a scheduled campaign back to a draft. */
  schedule: async (id: string, sendAt: string | null, choice: CapChoice = {}) => (await call<{ campaign: Campaign }>(`/${enc(id)}/schedule`, json({ sendAt, ...choice }))).campaign,
  sendNow: async (id: string, choice: CapChoice = {}) => (await call<{ campaign: Campaign }>(`/${enc(id)}/send-now`, json(choice))).campaign,
  /** A paused campaign carries on, once the cause is fixed. */
  resume: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}/resume`, { method: "POST" })).campaign,
  cancel: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}/cancel`, { method: "POST" })).campaign,
};
