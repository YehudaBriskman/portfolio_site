import { useEffect, useState } from "react";
import { admin } from "@/services/admin";

/*
 * Whether the person reading is the signed-in admin, so a note can offer
 * "Edit" (#249). Nothing shows for a visitor, and a visitor's browser is not
 * made to ask.
 *
 * The admin API answers only on the gated admin host (oauth2-proxy in front
 * of it); on the public host every /api/admin request is a 401. So the probe
 * runs only where it can succeed: on a host whose name starts with `admin.`,
 * or in a browser that has opened the admin before (AdminShell leaves a mark
 * once `/me` answers). Even then the answer is the server's: the mark only
 * decides whether to ask, never whether to show.
 */

export const ADMIN_MARK = "admin-seen-v1";

export function markAdminSeen(): void {
  try {
    window.localStorage.setItem(ADMIN_MARK, "1");
  } catch {
    /* storage blocked: the next note simply does not ask */
  }
}

function worthAsking(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hostname.startsWith("admin.")) return true;
  try {
    return window.localStorage.getItem(ADMIN_MARK) === "1";
  } catch {
    return false;
  }
}

export function useIsAdmin(): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    if (!worthAsking()) return;
    let alive = true;
    admin
      .me()
      .then(() => alive && setYes(true))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return yes;
}
