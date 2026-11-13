import { useCallback, useEffect, useId, useState } from "react";
import { ErrorState } from "@/components/admin/ui";
import { Disclosure } from "@/components/ui/Disclosure";
import { issueText, useSettingsWords } from "@/components/admin/settings/words";
import { templateFor } from "@/lib/share";
import { ContentConflictError, ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminSettings, type SettingsView } from "@/services/adminSettings";
import { SHARE_CHANNELS, SHARE_TEMPLATE_MAX } from "@/settings/schema";
import { setSettings } from "@/settings/store";
import type { AnnounceLang } from "@/services/adminAnnounce";
import { useAnnounceWords } from "../words";
import TemplateText from "./TemplateText";
import { VISITOR_VARS } from "./variables";
import { useLibraryWords } from "./words";

/*
 * The visitor share menu's captions. They live in the public site settings
 * (`sharing.templates`), so they are read and saved through the same endpoint
 * and the same _rev rule as the Settings page, on their own Save: a change
 * here never rides along with the announce document, and nothing owner-only
 * is written to the public object.
 */
type Status = "idle" | "saving" | "saved" | "conflict" | "failed";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function VisitorTemplates() {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const sw = useSettingsWords();
  const uid = useId();
  const [view, setView] = useState<SettingsView | null>(null);
  const [draft, setDraft] = useState<SettingsView["settings"] | null>(null);
  const [lang, setLang] = useState<AnnounceLang>("en");
  const [status, setStatus] = useState<Status>("idle");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const take = useCallback((v: SettingsView) => {
    setView(v);
    setDraft(structuredClone(v.settings));
    setSettings(v.settings);
  }, []);

  useEffect(() => {
    let live = true;
    adminSettings.get().then(
      (v) => live && take(v),
      () => live && setLoadError(true),
    );
    return () => {
      live = false;
    };
  }, [attempt, take]);

  const reload = () => {
    setLoadError(false);
    setStatus("idle");
    setIssues([]);
    setView(null);
    setAttempt((n) => n + 1);
  };

  if (loadError) return <ErrorState message={w.visitorLoadFailed} onRetry={reload} />;
  if (!draft || !view) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const dirty = !same(draft.sharing.templates, view.settings.sharing.templates);
  const edit = (fn: (t: typeof draft.sharing.templates) => void) => {
    setDraft((d) => {
      const next = structuredClone(d!);
      fn(next.sharing.templates);
      return next;
    });
    if (status === "saved") setStatus("idle");
  };

  const save = async () => {
    setStatus("saving");
    setIssues([]);
    try {
      take(await adminSettings.save(draft, view._rev));
      setStatus("saved");
    } catch (e) {
      if (e instanceof ContentConflictError) setStatus("conflict");
      else {
        if (e instanceof ContentInvalidError) setIssues(e.issues);
        setStatus("failed");
      }
    }
  };

  const bad = status === "conflict" || status === "failed";
  const statusText = status === "saving" ? a.saving : status === "saved" ? w.visitorSaved : status === "conflict" ? w.visitorConflict : status === "failed" ? w.visitorFailed : dirty ? w.unsaved : "";

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-4">
      <div>
        <h3 id={`${uid}-h`} className="display-tight text-lg">{w.visitorHeading}</h3>
        <p className="a-hint !mt-0">{w.visitorHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={w.language}>
        {(["en", "he"] as const).map((l) => (
          <button key={l} type="button" className="a-btn min-h-[44px]" aria-pressed={lang === l} onClick={() => setLang(l)}>{a.langs[l]}</button>
        ))}
      </div>
      <div className="space-y-2">
        {SHARE_CHANNELS.map((c) => {
          const value = draft.sharing.templates[lang][c] ?? "";
          const def = templateFor("visitor", "post", lang, c);
          return (
            <Disclosure key={`${lang}-${c}`} className="a-box" summary={w.visitorChannels[c]} meta={value === "" ? w.builtinBadge : w.customised} open={value !== "" || undefined}>
              <div className="space-y-1">
              <TemplateText
                label={w.visitorChannels[c]}
                value={value}
                onChange={(v) => edit((t) => (v === "" ? void delete t[lang][c] : void (t[lang][c] = v)))}
                lang={lang}
                vars={VISITOR_VARS}
                max={SHARE_TEMPLATE_MAX}
                rows={3}
                hideHint
                placeholder={def}
              >
                <p className="a-hint !mt-0">{w.visitorDefault}</p>
                <pre className="a-hint !mt-0 whitespace-pre-wrap font-[inherit]" dir="auto">{def}</pre>
              </TemplateText>
              <button type="button" className="a-btn a-btn-ghost mt-1 min-h-[44px]" aria-label={`${w.resetDefault}: ${w.visitorChannels[c]}`} disabled={value === ""} onClick={() => edit((t) => void delete t[lang][c])}>
                {w.resetDefault}
              </button>
              </div>
            </Disclosure>
          );
        })}
      </div>
      {issues.length > 0 && (
        <div role="alert">
          <p className="a-error">{w.visitorInvalid}</p>
          <ul className="list-disc ps-5">
            {issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{issueText(sw, i.message)}</li>)}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => void save()}>{w.visitorSave}</button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => (setDraft(structuredClone(view.settings)), setStatus("idle"))}>{a.reset}</button>
        {status === "conflict" && <button type="button" className="a-btn min-h-[44px]" onClick={reload}>{a.reload}</button>}
        <span role="status" className={`text-sm ${bad ? "font-bold text-[rgb(var(--destructive-ink))]" : "text-clay"}`}>{statusText}</span>
      </div>
    </section>
  );
}
