import { useEffect, useState } from "react";
import { adminAnnounce } from "@/services/adminAnnounce";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";
import { translationReport, type TranslationReport } from "@/services/translations";

const failedSends = (c: Campaign) => c.status === "failed" || (c.status !== "draft" && c.counters.failed > 0);

export type Needs = {
  /** `null` = not known (yet, or the source failed). */
  unread: number | null;
  failed: number | null;
  campaigns: Campaign[] | null;
  translations: TranslationReport | null;
};

/** What the other screens say needs the owner, and the two lists the lower panels draw. */
export function useNeeds(): Needs {
  const [unread, setUnread] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [translations, setTranslations] = useState<TranslationReport | null>(null);
  useEffect(() => {
    let live = true;
    adminAnnounce.inbox().then((r) => live && setUnread(typeof r.unread === "number" ? r.unread : null), () => {});
    adminCampaigns.list().then((list) => live && setCampaigns(list), () => {});
    translationReport().then((r) => live && setTranslations(r), () => {});
    return () => {
      live = false;
    };
  }, []);
  return { unread, failed: campaigns ? campaigns.filter(failedSends).length : null, campaigns, translations };
}
