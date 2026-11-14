import { loadSendSettings } from "../announce/store.js";
import { onComplaintReceived } from "../audience/complaintHook.js";
import { couch } from "../db/couch.js";
import { logger } from "../logger.js";
import { applyComplaint } from "./pause.js";
import { getRate, mutateCampaign } from "./store.js";
import type { Campaign } from "./schemas.js";
import { warmupLimits } from "./warmup.js";

/*
 * A spam complaint pauses a campaign that is sending (rules in ./pause.ts).
 * The provider's event names a contact, not a campaign, so every campaign
 * that is sending counts it. Carries no address; never throws.
 */
export async function pauseOnComplaint(now = Date.now()): Promise<void> {
  try {
    const { docs } = await couch.find<Campaign>({ selector: { _id: { $gt: "campaign:", $lt: "campaign:￿" }, status: "sending" }, limit: 50 });
    if (docs.length === 0) return;
    const loaded = await loadSendSettings();
    const first = (await getRate().catch(() => null))?.firstSendAt;
    const warming = loaded.ok ? warmupLimits(loaded.settings.sender.warmup, first, now) !== null : true;
    for (const c of docs) {
      let paused = false;
      await mutateCampaign(c._id.slice("campaign:".length), (x) => {
        if (!applyComplaint(x, warming)) return false;
        paused = x.status === "paused";
      });
      if (paused) logger.warn({ campaign: c._id }, "campaign paused by a spam complaint");
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "could not apply a complaint to the sending campaigns");
  }
}

export function startComplaintPause(): () => void {
  return onComplaintReceived((e) => (e.reason === "hard-bounce" ? undefined : pauseOnComplaint()));
}
