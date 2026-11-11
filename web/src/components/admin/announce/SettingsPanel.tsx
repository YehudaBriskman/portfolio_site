import { useCallback, useEffect, useId, useState } from "react";
import { ErrorState } from "@/components/admin/ui";
import { ContentConflictError, ContentInvalidError, type Issue } from "@/services/adminContent";
import { ANNOUNCE_CHANNELS, adminAnnounce, type AnnounceKind, type AnnounceLang, type AnnounceSettings, type AnnounceSettingsView } from "@/services/adminAnnounce";
import { parseTags } from "./helpers";
import { useAnnounceWords } from "./words";

/*
 * The owner's announce settings: their own document, saved with the revision
 * that was read, so a stale save is a 409 and never a silent overwrite (the
 * same rule as the site settings). Nothing here is public.
 */

type Status = "idle" | "saving" | "saved" | "conflict" | "failed";

const TEMPLATE_MAX = 2000;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function SettingsPanel() {
  const w = useAnnounceWords();
  const uid = useId();
  const [view, setView] = useState<AnnounceSettingsView | null>(null);
  const [draft, setDraft] = useState<AnnounceSettings | null>(null);
  /* Typed as the person types it; parsed on save, so a trailing comma is not eaten mid-word. */
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState(false);

  const take = useCallback((v: AnnounceSettingsView) => {
    setView(v);
    setDraft(structuredClone(v.settings));
    setTags(v.settings.hashtags.join(" "));
  }, []);

  const [attempt, setAttempt] = useState(0);
  const load = () => {
    setLoadError(false);
    setStatus("idle");
    setIssues([]);
    setView(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    adminAnnounce.settings().then(
      (v) => live && take(v),
      () => live && setLoadError(true),
    );
    return () => {
      live = false;
    };
  }, [attempt, take]);

  if (loadError) return <ErrorState message={w.settingsFailed} onRetry={load} />;
  if (!draft || !view) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const working: AnnounceSettings = { ...draft, hashtags: parseTags(tags) };
  const dirty = !same(working, view.settings);
  const edit = (fn: (d: AnnounceSettings) => void) => {
    setDraft((d) => {
      const next = structuredClone(d!);
      fn(next);
      return next;
    });
    if (status === "saved") setStatus("idle");
  };

  const save = async () => {
    setStatus("saving");
    setIssues([]);
    try {
      take(await adminAnnounce.saveSettings(working, view._rev));
      setStatus("saved");
    } catch (e) {
      if (e instanceof ContentConflictError) setStatus("conflict");
      else {
        if (e instanceof ContentInvalidError) setIssues(e.issues);
        setStatus("failed");
      }
    }
  };

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v));
  const statusText =
    status === "saving" ? w.saving : status === "saved" ? w.saved : status === "conflict" ? w.conflict : status === "failed" ? w.saveFailed : dirty ? w.unsaved : "";
  const bad = status === "conflict" || status === "failed";

  const check = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={checked} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {hint && <p id={`${id}-hint`} className="a-hint !mt-0 ps-8">{hint}</p>}
    </div>
  );

  return (
    <form noValidate onSubmit={(e) => (e.preventDefault(), void save())} className="max-w-3xl space-y-8" aria-labelledby={`${uid}-h`}>
      <div>
        <h2 id={`${uid}-h`} className="display-tight text-xl">{w.settingsHeading}</h2>
        <p className="a-hint">{w.settingsIntro}</p>
      </div>

      <fieldset className="space-y-1">
        <legend className="sr-only">{w.enabled}</legend>
        {check(`${uid}-on`, w.enabled, draft.enabled, (v) => edit((d) => void (d.enabled = v)), w.enabledHint)}
        {check(`${uid}-mail`, w.emailEnabled, draft.email.enabled, (v) => edit((d) => void (d.email.enabled = v)), w.emailHint)}
        <fieldset className="ps-8" disabled={!draft.email.enabled}>
          <legend className="a-label">{w.emailEvents}</legend>
          {(["post", "release"] as AnnounceKind[]).map((k) =>
            <div key={k}>{check(`${uid}-ev-${k}`, w.kinds[k], draft.email.events.includes(k), (v) => edit((d) => void (d.email.events = toggle(d.email.events, k, v))))}</div>,
          )}
        </fieldset>
      </fieldset>

      <fieldset>
        <legend className="a-label">{w.channelsHeading}</legend>
        {ANNOUNCE_CHANNELS.map((c) => (
          <div key={c}>{check(`${uid}-ch-${c}`, w.channels[c], draft.channels.includes(c), (v) => edit((d) => void (d.channels = ANNOUNCE_CHANNELS.filter((x) => (x === c ? v : d.channels.includes(x))))))}</div>
        ))}
      </fieldset>

      <div>
        <label className="a-label" htmlFor={`${uid}-tags`}>{w.hashtags}</label>
        <input id={`${uid}-tags`} className="a-input" dir="auto" value={tags} onChange={(e) => (setTags(e.target.value), status === "saved" && setStatus("idle"))} aria-describedby={`${uid}-tags-h`} autoComplete="off" />
        <p id={`${uid}-tags-h`} className="a-hint">{w.hashtagsHint}</p>
      </div>

      <div>
        <label className="a-label" htmlFor={`${uid}-sig`}>{w.signature}</label>
        <textarea id={`${uid}-sig`} className="a-textarea" rows={2} maxLength={300} dir="auto" value={draft.signature} onChange={(e) => edit((d) => void (d.signature = e.target.value))} aria-describedby={`${uid}-sig-h`} />
        <p id={`${uid}-sig-h`} className="a-hint">{w.signatureHint}</p>
      </div>

      <section aria-labelledby={`${uid}-tpl`} className="space-y-3">
        <h3 id={`${uid}-tpl`} className="a-label !mb-0">{w.templatesHeading}</h3>
        <p className="a-hint !mt-0">{w.templatesHint}</p>
        {(["en", "he"] as AnnounceLang[]).map((l) => (
          <details key={l} className="a-box">
            <summary className="a-box-head min-h-[44px] cursor-pointer" lang={l}>{w.langs[l]}</summary>
            <div className="space-y-4 p-4">
              {ANNOUNCE_CHANNELS.map((c) => {
                const id = `${uid}-t-${l}-${c}`;
                const value = draft.templates[l][c] ?? "";
                return (
                  <div key={c}>
                    <label className="a-label" htmlFor={id}>{w.templateFor(w.langs[l], w.channels[c])}</label>
                    <textarea
                      id={id}
                      className="a-textarea"
                      rows={3}
                      maxLength={TEMPLATE_MAX}
                      dir={l === "he" ? "rtl" : "ltr"}
                      lang={l}
                      value={value}
                      onChange={(e) =>
                        edit((d) => {
                          if (e.target.value === "") delete d.templates[l][c];
                          else d.templates[l][c] = e.target.value;
                        })
                      }
                    />
                    <p className="a-hint tabular-nums">{w.templateCount(value.length, TEMPLATE_MAX)}</p>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </section>

      {issues.length > 0 && (
        <div role="alert">
          <p className="a-error">{w.invalid}</p>
          <ul className="list-disc ps-5">
            {issues.map((i) => (
              <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirty || status === "saving"}>{w.save}</button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => take(view)}>{w.reset}</button>
        {status === "conflict" && <button type="button" className="a-btn min-h-[44px]" onClick={load}>{w.reload}</button>}
        <span role="status" className={`text-sm ${bad ? "font-bold text-[rgb(var(--destructive-ink))]" : "text-clay"}`}>{statusText}</span>
      </div>
    </form>
  );
}
