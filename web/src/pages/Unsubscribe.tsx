import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubscribeFrame, { Result } from "@/components/SubscribeFrame";
import { isDeadLink, retryKind, useFocusWhen } from "@/components/subscribeRetry";
import { useSubscribeWords } from "@/i18n/subscribe";
import { contact } from "@/data/site";
import { unsubscribe } from "@/services/subscribe";

/* The address is a link of its own, left-to-right inside a Hebrew sentence. */
function withEmail(text: string) {
  const [before, after = ""] = text.split("{email}");
  return (
    <>
      {before}
      <a className="underline underline-offset-4" href={`mailto:${contact.email}`} dir="ltr">
        {contact.email}
      </a>
      {after}
    </>
  );
}

/* A click, not a page load: mail scanners open links, and a scanner must not
   unsubscribe anyone. The one-click header in each email is the other path. */
export default function Unsubscribe() {
  const w = useSubscribeWords();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "ok" | "bad" | "retry">(token ? "idle" : "bad");

  const [why, setWhy] = useState<"rate" | "reach">("reach");
  const retryRef = useFocusWhen(state === "retry");

  async function go() {
    setState("working");
    try {
      await unsubscribe(token);
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
    <SubscribeFrame title={w.unsubTitle}>
      {state !== "bad" && state !== "ok" && <p>{w.unsubIntro}</p>}
      <Result kind={state === "ok" ? "ok" : state === "bad" || state === "retry" ? "error" : "idle"}>
        {state === "ok" ? withEmail(w.unsubDone) : state === "bad" ? withEmail(w.unsubBad) : state === "retry" ? (why === "rate" ? w.errRate : w.errReach) : state === "working" ? w.working : ""}
      </Result>
      {(state === "idle" || state === "working" || state === "retry") && (
        <button ref={retryRef} type="button" className="btn btn-solid" onClick={go} disabled={state === "working"}>
          {state === "retry" ? w.retry : w.unsubButton}
        </button>
      )}
    </SubscribeFrame>
  );
}
