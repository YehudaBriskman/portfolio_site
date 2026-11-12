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
export type PauseReason = "auth" | "consecutive" | "failure-rate" | "hard-bounce-rate";
export type CampaignTopic = "blog" | "releases";

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "cta"; url: string; label: string }
  | { type: "image"; url: string; text?: string };
export type BlockType = Block["type"];

export type Counters = { queued: number; sent: number; failed: number; suppressed: number };

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

export type AudienceSample = { count: number; samples: string[] };

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
  if (res.status === 409 || res.status === 422) throw new CampaignRefusedError(typeof msg === "string" ? msg : "refused", res.status);
  if (!res.ok) throw new Error(`status-${res.status}`);
  return body as T;
}

const enc = encodeURIComponent;
const json = (b: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(b) });

export const adminCampaigns = {
  list: async () => (await call<{ campaigns: Campaign[] }>("")).campaigns,
  get: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}`)).campaign,
  create: async (b: CampaignInput) => (await call<{ campaign: Campaign }>("", json(b))).campaign,
  update: async (id: string, b: Partial<CampaignInput>, rev: string | null) =>
    (await call<{ campaign: Campaign }>(`/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ ...b, ...(rev ? { _rev: rev } : {}) }) })).campaign,
  remove: (id: string) => call<{ ok: true }>(`/${enc(id)}`, { method: "DELETE" }),
  /** The count and masked samples for a selection, saved or not: the page asks as the boxes are ticked. */
  audienceOf: async (sel: { groups: string[]; lang: CampaignLang; topic: CampaignTopic | null }): Promise<AudienceSample> => {
    const r = await call<{ count: number; samples: string[] }>("/audience", json(sel));
    return { count: r.count ?? 0, samples: Array.isArray(r.samples) ? r.samples : [] };
  },
  /** The mail as the server would send it, from draft text that need not be saved. */
  preview: (b: { subject: string; preheader: string; bodyText: string; blocks: Block[] | null; lang: "en" | "he" }) =>
    call<{ subject: string; html: string; text: string }>("/preview", json(b)),
  test: (id: string) => call<{ sent: number; failed: number }>(`/${enc(id)}/test`, { method: "POST" }),
  /** `null` takes a scheduled campaign back to a draft. */
  schedule: async (id: string, sendAt: string | null) => (await call<{ campaign: Campaign }>(`/${enc(id)}/schedule`, json({ sendAt }))).campaign,
  sendNow: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}/send-now`, { method: "POST" })).campaign,
  /** A paused campaign carries on, once the cause is fixed. */
  resume: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}/resume`, { method: "POST" })).campaign,
  cancel: async (id: string) => (await call<{ campaign: Campaign }>(`/${enc(id)}/cancel`, { method: "POST" })).campaign,
};
