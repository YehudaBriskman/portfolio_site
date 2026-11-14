import { ContentInvalidError } from "@/services/adminContent";

/*
 * What a failed Audience action says. The service throws `not-authorised`, `api-down` or `status-<n>`, and a 400
 * as ContentInvalidError (a field the server named). Each action gets its own sentence, so an action with no
 * fields never tells the owner to check them.
 */
export type ActionKind = "save" | "erase";
type Say = {
  saveFailed: string; errAuth: string; errOffline: string; errSaveServer: string; errSaveGone: string; errSaveLocked: string;
  eraseFailed: string; eraseFailedLedger: string;
};

export function actionError(err: unknown, kind: ActionKind, w: Say): string {
  const m = err instanceof Error ? err.message : "";
  if (m === "not-authorised") return w.errAuth;
  if (err instanceof ContentInvalidError) return kind === "save" ? w.saveFailed : w.eraseFailed;
  const status = /^status-(\d+)$/.exec(m)?.[1];
  if (!status) return w.errOffline;
  const n = Number(status);
  if (kind === "erase") return n === 503 || n === 502 ? w.eraseFailedLedger : w.eraseFailed;
  if (n === 404) return w.errSaveGone;
  if (n === 409) return w.errSaveLocked;
  return w.errSaveServer;
}
