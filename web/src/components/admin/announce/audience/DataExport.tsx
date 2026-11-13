import { useId, useState } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { adminAudience } from "@/services/adminAudience";
import { useExportWords } from "./exportWords";

/* Downloads one JSON file of everything held about the typed address. The address is sent in the request body and never stored or shown again. */
export default function DataExport() {
  const w = useExportWords();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "none" | "failed">("idle");

  const run = async () => {
    setState("busy");
    try {
      const data = await adminAudience.exportData(email.trim());
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "address-data.json";
      a.click();
      URL.revokeObjectURL(url);
      setEmail("");
      setState("idle");
    } catch (e) {
      setState(e instanceof Error && e.message === "status-404" ? "none" : "failed");
    }
  };

  return (
    <Disclosure className="a-box" summary={w.heading}>
      <form className="space-y-2" onSubmit={(e) => (e.preventDefault(), email.trim() && state !== "busy" && void run())}>
        <p className="a-hint !mt-0" id={`${uid}-h`}>{w.hint}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <label className="a-label" htmlFor={`${uid}-e`}>{w.label}</label>
            <input id={`${uid}-e`} type="email" dir="ltr" autoComplete="off" aria-describedby={`${uid}-h`} className="a-input min-h-[44px] text-start" value={email} onChange={(e) => (setEmail(e.target.value), setState("idle"))} />
          </div>
          <button type="submit" className="a-btn min-h-[44px]" disabled={!email.trim() || state === "busy"}>{state === "busy" ? w.busy : w.run}</button>
        </div>
        <div role="status" aria-live="polite">
          {state === "none" && <p className="a-hint">{w.none}</p>}
          {state === "failed" && <p className="a-error">{w.failed}</p>}
        </div>
      </form>
    </Disclosure>
  );
}
