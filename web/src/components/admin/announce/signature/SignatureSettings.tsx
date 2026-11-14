import { useEffect, useId, useState } from "react";
import { ErrorState } from "@/components/admin/ui";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/lib/toast";
import { adminSignature, SIG_LANGS, type SigLang, type SigShow, type SigSlot, type SigState, type SigUse } from "@/services/adminSignature";
import SignatureEditor from "./SignatureEditor";
import { useSignatureWords } from "./words";

/*
 * Marketing > Settings > Signature image. Unlike the rest of the settings this
 * is not part of the page's Save: each language saves itself (the files are
 * rendered on the server) and each switch saves as it is flipped, with a
 * toast for the result. Nothing here is public until a switch is on.
 */

/* "cards" stays in the stored shape (tolerant) but has no consumer yet, so no switch is shown for it. */
const USES: SigUse[] = ["email", "posts"];

export default function SignatureSettings({ defaultAlt }: { defaultAlt: string }) {
  const w = useSignatureWords();
  const uid = useId();
  const [state, setState] = useState<SigState | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ lang: SigLang; mode: "draw" | "upload" } | null>(null);
  const [confirm, setConfirm] = useState<SigLang | null>(null);

  const [tick, setTick] = useState(0);
  const load = () => (setFailed(false), setTick((t) => t + 1));
  useEffect(() => {
    let live = true;
    adminSignature.get().then(
      (s) => live && setState(s),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [tick]);

  if (failed) return <ErrorState message={w.loadFailed} onRetry={load} />;
  if (!state) return <p className="a-box a-box-row text-clay" role="status">…</p>;

  const flip = async (use: SigUse, on: boolean) => {
    const before = state.show;
    const next: SigShow = { ...before, [use]: on };
    setState({ ...state, show: next });
    try {
      await adminSignature.saveShow(next);
      toast.success(w.useSaved);
    } catch {
      setState((s) => (s ? { ...s, show: before } : s));
      toast.error(w.useFailed);
    }
  };

  const remove = async (lang: SigLang) => {
    setConfirm(null);
    try {
      await adminSignature.remove(lang);
      setState((s) => (s ? { ...s, slots: { ...s.slots, [lang]: null } } : s));
      toast.success(w.removed(w.langName[lang]));
    } catch {
      toast.error(w.saveFailed);
    }
  };

  const useLabel: Record<SigUse, string> = { email: w.useEmail, posts: w.usePosts, cards: w.useCards };

  return (
    <div className="space-y-5" data-testid="signature-settings">
      <p className="a-hint !mt-0">{w.intro}</p>
      <p className="a-hint !mt-0 font-bold" data-testid="signature-bank-note">{w.bankNote}</p>

      {SIG_LANGS.map((lang) => {
        const slot = state.slots[lang];
        const open = editing?.lang === lang ? editing : null;
        return (
          <section key={lang} className="a-box space-y-3 p-4" aria-labelledby={`${uid}-${lang}`} data-testid={`signature-slot-${lang}`}>
            <h3 id={`${uid}-${lang}`} className="display-tight text-base">{w.langName[lang]}</h3>
            {slot ? (
              <div className="grid place-items-center rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.5)] p-3" style={{ background: "#fbfaf6" }}>
                <img src={slot.preview.email} alt={slot.alt} width={slot.width} height={slot.height} style={{ maxWidth: "100%", height: "auto" }} />
              </div>
            ) : (
              <p className="a-hint !mt-0">{w.empty}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setEditing({ lang, mode: "draw" })}>{slot?.mode === "drawn" ? w.edit : w.draw}</button>
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setEditing({ lang, mode: "upload" })}>{w.upload}</button>
              {slot &&
                (confirm === lang ? (
                  <>
                    <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => void remove(lang)}>{w.remove}?</button>
                    <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancel}</button>
                  </>
                ) : (
                  <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(lang)}>{w.remove}</button>
                ))}
            </div>
            {open && (
              <SignatureEditor
                key={`${lang}-${open.mode}`}
                lang={lang}
                mode={open.mode}
                existing={slot}
                defaultAlt={defaultAlt}
                onClose={() => setEditing(null)}
                onSaved={(s: SigSlot) => {
                  setState((st) => (st ? { ...st, slots: { ...st.slots, [lang]: s } } : st));
                  setEditing(null);
                }}
              />
            )}
          </section>
        );
      })}

      <fieldset className="space-y-1">
        <legend className="a-label">{w.usesHeading}</legend>
        <p className="a-hint !mt-0">{w.usesHint}</p>
        {USES.map((u) => (
          <Switch key={u} label={useLabel[u]} checked={state.show[u]} onChange={(v) => void flip(u, v)} />
        ))}
      </fieldset>

      <p className="a-hint">{w.typedStays}</p>
    </div>
  );
}
