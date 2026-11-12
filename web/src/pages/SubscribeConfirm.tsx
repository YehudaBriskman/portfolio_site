import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubscribeFrame, { Result } from "@/components/SubscribeFrame";
import { useSubscribeWords } from "@/i18n/subscribe";
import { confirmSubscription } from "@/services/subscribe";

/* Opened from the confirmation email. The token is read once and sent to the
   API; it is never printed, and the page is noindex (server render). */
export default function SubscribeConfirm() {
  const w = useSubscribeWords();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "bad">(token ? "working" : "bad");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    confirmSubscription(token).then(
      () => setState("ok"),
      () => setState("bad"),
    );
  }, [token]);

  return (
    <SubscribeFrame title={w.confirmTitle}>
      <Result kind={state === "ok" ? "ok" : state === "bad" ? "error" : "idle"}>
        {state === "working" ? w.working : state === "ok" ? w.confirmDone : w.confirmBad}
      </Result>
    </SubscribeFrame>
  );
}
