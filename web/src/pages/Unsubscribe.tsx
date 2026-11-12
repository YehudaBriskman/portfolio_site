import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubscribeFrame, { Result } from "@/components/SubscribeFrame";
import { useSubscribeWords } from "@/i18n/subscribe";
import { unsubscribe } from "@/services/subscribe";

/* A click, not a page load: mail scanners open links, and a scanner must not
   unsubscribe anyone. The one-click header in each email is the other path. */
export default function Unsubscribe() {
  const w = useSubscribeWords();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "ok" | "bad">(token ? "idle" : "bad");

  async function go() {
    setState("working");
    try {
      await unsubscribe(token);
      setState("ok");
    } catch {
      setState("bad");
    }
  }

  return (
    <SubscribeFrame title={w.unsubTitle}>
      {state !== "bad" && state !== "ok" && <p>{w.unsubIntro}</p>}
      <Result kind={state === "ok" ? "ok" : state === "bad" ? "error" : "idle"}>
        {state === "ok" ? w.unsubDone : state === "bad" ? w.unsubBad : state === "working" ? w.working : ""}
      </Result>
      {(state === "idle" || state === "working") && (
        <button type="button" className="btn btn-solid" onClick={go} disabled={state === "working"}>
          {w.unsubButton}
        </button>
      )}
    </SubscribeFrame>
  );
}
