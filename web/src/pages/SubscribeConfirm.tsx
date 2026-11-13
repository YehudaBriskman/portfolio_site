import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubscribeFrame, { Result } from "@/components/SubscribeFrame";
import { isDeadLink, retryKind, useFocusWhen } from "@/components/subscribeRetry";
import { useSubscribeWords } from "@/i18n/subscribe";
import { confirmSubscription } from "@/services/subscribe";

/* A click, not a page load: mail scanners and link previewers open every link in
   a message, and a robot must not be able to subscribe anyone. Opening the page
   changes nothing; only the button calls the API. The token is read from the URL
   once, never printed, and the page is noindex (server render). */
export default function SubscribeConfirm() {
  const w = useSubscribeWords();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "ok" | "bad" | "retry">(token ? "idle" : "bad");

  const [why, setWhy] = useState<"rate" | "reach">("reach");
  const retryRef = useFocusWhen(state === "retry");

  async function go() {
    setState("working");
    try {
      await confirmSubscription(token);
      setState("ok");
    } catch (e) {
      if (isDeadLink(e)) setState("bad");
      else {
        setWhy(retryKind(e));
        setState("retry");
      }
    }
  }

  return (
    <SubscribeFrame title={w.confirmTitle}>
      {state !== "bad" && state !== "ok" && <p>{w.confirmIntro}</p>}
      <Result kind={state === "ok" ? "ok" : state === "bad" || state === "retry" ? "error" : "idle"}>
        {state === "ok" ? w.confirmDone : state === "bad" ? w.confirmBad : state === "retry" ? (why === "rate" ? w.errRate : w.errReach) : state === "working" ? w.working : ""}
      </Result>
      {(state === "idle" || state === "working" || state === "retry") && (
        <button ref={retryRef} type="button" className="btn btn-solid" onClick={go} disabled={state === "working"}>
          {state === "retry" ? w.retry : w.confirmButton}
        </button>
      )}
    </SubscribeFrame>
  );
}
