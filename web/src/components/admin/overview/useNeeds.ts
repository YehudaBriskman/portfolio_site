import { useEffect, useState } from "react";
import { adminAnnounce } from "@/services/adminAnnounce";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";

const failedSends = (c: Campaign) => c.status === "failed" || (c.status !== "draft" && c.counters.failed > 0);

/** What the other screens say needs the owner: unread inbox and campaigns with failed sends. `null` = not known (yet). */
export function useNeeds(): { unread: number | null; failed: number | null } {
  const [unread, setUnread] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    adminAnnounce.inbox().then((r) => live && setUnread(typeof r.unread === "number" ? r.unread : null), () => {});
    adminCampaigns.list().then((list) => live && setFailed(list.filter(failedSends).length), () => {});
    return () => {
      live = false;
    };
  }, []);
  return { unread, failed };
}
