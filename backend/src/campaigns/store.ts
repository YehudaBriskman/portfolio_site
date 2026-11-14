import { couch, CouchError } from "../db/couch.js";
import type { Campaign, SendResult } from "./schemas.js";

const PREFIX = "campaign:";
const SEND = "send:";
export const campaignId = (id: string) => `${PREFIX}${id}`;
export const sendId = (campaign: string, hash: string) => `${SEND}${campaign}:${hash}`;
export const isStatus = (e: unknown, s: number) => e instanceof CouchError && e.status === s;

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (isStatus(e, 404)) return null;
    throw e;
  }
}

export const getCampaign = (id: string) => tryGet<Campaign>(campaignId(id));

export async function listCampaigns(): Promise<Campaign[]> {
  const { docs } = await couch.find<Campaign>({ selector: { _id: { $gt: PREFIX, $lt: `${PREFIX}\uffff` } }, limit: 500 });
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCampaign(c: Campaign): Promise<boolean> {
  try {
    await couch.append(c._id, c as unknown as Record<string, unknown>);
    return true;
  } catch (e) {
    if (isStatus(e, 409)) return false;
    throw e;
  }
}

/** Writes with the revision it read; a clash is a 409 for the caller. */
export async function putCampaign(c: Campaign): Promise<Campaign> {
  c.updatedAt = new Date().toISOString();
  const r = await couch.put<{ rev?: string }>(c._id, c);
  if (r && typeof r.rev === "string") c._rev = r.rev;
  return c;
}

/** Read-modify-write, retried on a revision clash. `change` returns false to leave the doc as it is. */
export async function mutateCampaign(id: string, change: (c: Campaign) => boolean | void, attempts = 4): Promise<Campaign | null> {
  for (let i = 0; i < attempts; i++) {
    const c = await getCampaign(id);
    if (!c) return null;
    if (change(c) === false) return c;
    try {
      return await putCampaign(c);
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
    }
  }
  throw new CouchError(409, "campaign changed concurrently");
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const c = await getCampaign(id);
  if (!c?._rev) return false;
  try {
    await couch.del(c._id, c._rev);
    return true;
  } catch (e) {
    if (isStatus(e, 404)) return false;
    throw e;
  }
}

/** Every result doc of one campaign, keyed by contact hash. */
export async function resultsOf(campaign: string): Promise<Map<string, SendResult>> {
  const out = new Map<string, SendResult>();
  let after = `${SEND}${campaign}:`;
  const end = `${SEND}${campaign}:\uffff`;
  for (;;) {
    const { docs } = await couch.find<SendResult>({ selector: { _id: { $gt: after, $lt: end } }, sort: [{ _id: "asc" }], limit: 500 });
    for (const d of docs) out.set(d.contact, d);
    if (docs.length < 500) return out;
    after = docs[docs.length - 1]._id;
  }
}

/** Claims one recipient: false when another worker (or an earlier run) already holds it. */
export async function claimSend(r: SendResult): Promise<boolean> {
  try {
    await couch.append(r._id, r as unknown as Record<string, unknown>);
    return true;
  } catch (e) {
    if (isStatus(e, 409)) return false;
    throw e;
  }
}

export async function finishSend(r: SendResult): Promise<void> {
  const cur = await couch.get<SendResult>(r._id);
  await couch.put(r._id, { ...r, _rev: cur._rev });
}

/* The sender's own bookkeeping: how many went out this hour and this day, across all campaigns. */
export const RATE_ID = "sender:state";
export type RateState = { _id: typeof RATE_ID; _rev?: string; type: "sender-state"; hour: string; hourCount: number; day: string; dayCount: number; /** When warm-up day 1 began: the first newsletter reservation. Absent until then. */ firstSendAt?: string };
export const getRate = () => tryGet<RateState>(RATE_ID);
export async function putRate(s: RateState): Promise<void> {
  await couch.put(RATE_ID, s);
}

/** The one index the monthly limit reads: sent results by time. Idempotent; called at boot. */
export const SEND_INDEX = "send-type-status-at";
export const ensureSendIndex = () => couch.ensureIndex(SEND_INDEX, ["type", "status", "at"]);

/**
 * How many mails each contact got since `sinceMs`, from the result docs
 * themselves (nothing is stored on the contact, so there is no second copy to
 * drift). Counts only `sent`; `except` leaves out one campaign, the one being
 * checked. One scan per call, not per recipient.
 */
export async function sentCounts(sinceMs: number, except?: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const since = new Date(sinceMs).toISOString();
  let bookmark: string | undefined;
  for (;;) {
    const r = (await couch.find<Pick<SendResult, "contact" | "campaignId">>({
      selector: { type: "send", status: "sent", at: { $gte: since } }, fields: ["contact", "campaignId"], limit: 500, ...(bookmark ? { bookmark } : {}),
    })) as { docs: Array<Pick<SendResult, "contact" | "campaignId">>; bookmark?: string };
    for (const d of r.docs) if (d.campaignId !== except) out.set(d.contact, (out.get(d.contact) ?? 0) + 1);
    if (r.docs.length < 500 || !r.bookmark) return out;
    bookmark = r.bookmark;
  }
}
