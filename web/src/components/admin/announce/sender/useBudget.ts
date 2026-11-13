import { useEffect, useState } from "react";
import { adminCampaigns, type BudgetView } from "@/services/adminCampaigns";

export const whenOf = (iso: string) => new Intl.DateTimeFormat(document.documentElement.lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" }).format(new Date(iso));

/** The budget as the server counts it. `null` while loading, `"failed"` when it could not be read. */
export function useBudget(remaining?: number, refresh = 0): BudgetView | "failed" | null {
  const [state, setState] = useState<BudgetView | "failed" | null>(null);
  useEffect(() => {
    let live = true;
    adminCampaigns.budget(remaining).then(
      (b) => live && setState(b),
      () => live && setState("failed"),
    );
    return () => {
      live = false;
    };
  }, [remaining, refresh]);
  return state;
}
