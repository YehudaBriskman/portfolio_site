import { useId, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/admin/ui";
import { ANNOUNCE_CHANNELS, type AnnounceKind, type AnnounceSettings } from "@/services/adminAnnounce";
import { parseTags } from "./helpers";
import { DEFAULT_UTM, same, useSettingsDoc } from "./useSettingsDoc";
import { useSettingsPanelWords } from "./settingsWords";
import { useAnnounceWords } from "./words";

/*
 * The owner's announce settings: their own document, saved with the revision
 * that was read, so a stale save is a 409 and never a silent overwrite (the
 * same rule as the site settings). Nothing here is public.
 *
 * Two blocks. Everyday is what gets changed; Advanced is a native <details>,
 * closed, with a filter that searches the settings' labels. A section has its
 * own Reset to defaults and the page its own Discard, so either can be undone
 * before Save. Caption templates and snippets moved to the Library tab.
 */

const UTM_TOKEN = /^[a-z0-9_.-]{1,40}$/;

const everydayOf = (s: AnnounceSettings) => ({ mail: s.email.enabled, channels: s.channels, hashtags: s.hashtags, signature: s.signature });
const advancedOf = (s: AnnounceSettings) => ({ enabled: s.enabled, events: s.email.events, utm: s.advanced.utm });

export default function SettingsPanel() {
  const w = useAnnounceWords();
  const sw = useSettingsPanelWords();
  const uid = useId();
  const doc = useSettingsDoc();
  /* Typed as the person types it; parsed on save, so a trailing comma is not eaten mid-word. */
  const [tags, setTags] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const { view, draft, status, issues, edit } = doc;
  if (doc.loadError) return <ErrorState message={w.settingsFailed} onRetry={doc.reload} />;
  if (!draft || !view) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const tagText = tags ?? draft.hashtags.join(" ");
  const working: AnnounceSettings = { ...draft, hashtags: tags === null ? draft.hashtags : parseTags(tags) };
  const dirty = !same(working, view.settings);
  const everydayDirty = !same(everydayOf(working), everydayOf(view.settings));
  const everydayIsDefault = same(everydayOf(working), { mail: false, channels: ANNOUNCE_CHANNELS, hashtags: [], signature: "" });
  const advancedDirty = !same(advancedOf(working), advancedOf(view.settings));

  const touch = () => note && setNote("");
  const change = (fn: (d: AnnounceSettings) => void) => (touch(), edit(fn));
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v));
  const statusText =
    status === "saving" ? w.saving : status === "saved" ? w.saved : status === "conflict" ? w.conflict : status === "failed" ? w.saveFailed : note || (dirty ? w.unsaved : "");
  const bad = status === "conflict" || status === "failed";

  const resetEveryday = () => {
    setTags(null);
    change((d) => {
      d.email.enabled = false;
      d.channels = [...ANNOUNCE_CHANNELS];
      d.hashtags = [];
      d.signature = "";
    });
    setNote(sw.sectionReset);
  };
  const resetAdvanced = () => {
    edit((d) => {
      d.enabled = true;
      d.email.events = ["post", "release"];
      d.advanced.utm = structuredClone(DEFAULT_UTM);
    });
    setNote(sw.sectionReset);
  };

  const check = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={checked} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {hint && <p id={`${id}-hint`} className="a-hint !mt-0 ps-8">{hint}</p>}
    </div>
  );

  const utm = draft.advanced.utm;
  const sample = (() => {
    try {
      const u = new URL("https://example.com/notes/hello");
      u.searchParams.set("utm_source", utm.source || "announce");
      u.searchParams.set("utm_medium", utm.mediumByChannel.linkedin || "linkedin");
      return u.href;
    } catch {
      return "";
    }
  })();
  const sourceBad = utm.source !== "" && !UTM_TOKEN.test(utm.source);

  /* One entry per advanced setting: the label (and some extra words) is what the filter searches. */
  const advanced: Array<{ key: string; label: string; words: string; node: ReactNode }> = [
    {
      key: "record",
      label: sw.recordLabel,
      words: `${sw.recordKeywords} record inbox`,
      node: check(`${uid}-on`, sw.recordLabel, draft.enabled, (v) => change((d) => void (d.enabled = v)), w.enabledHint),
    },
    {
      key: "events",
      label: w.emailEvents,
      words: `${sw.emailEventsKeywords} email notify`,
      node: (
        <fieldset disabled={!draft.email.enabled}>
          <legend className="a-label">{w.emailEvents}</legend>
          {(["post", "release"] as AnnounceKind[]).map((k) => (
            <div key={k}>{check(`${uid}-ev-${k}`, w.kinds[k], draft.email.events.includes(k), (v) => change((d) => void (d.email.events = toggle(d.email.events, k, v))))}</div>
          ))}
        </fieldset>
      ),
    },
    {
      key: "utm",
      label: sw.utmHeading,
      words: `${sw.utmKeywords} utm source medium campaign tracking`,
      node: (
        <fieldset className="space-y-3">
          <legend className="a-label">{sw.utmHeading}</legend>
          {check(`${uid}-utm`, sw.utmEnabled, utm.enabled, (v) => change((d) => void (d.advanced.utm.enabled = v)), sw.utmEnabledHint)}
          <fieldset disabled={!utm.enabled} className="space-y-3 ps-8">
            <div>
              <label className="a-label" htmlFor={`${uid}-src`}>{sw.utmSource}</label>
              <input id={`${uid}-src`} className="a-input max-w-xs" dir="ltr" value={utm.source} maxLength={40} aria-invalid={sourceBad} aria-describedby={`${uid}-src-h`} autoComplete="off" onChange={(e) => change((d) => void (d.advanced.utm.source = e.target.value))} />
              <p id={`${uid}-src-h`} className={sourceBad ? "a-error" : "a-hint"}>{sw.utmSourceHint}</p>
            </div>
            <div>
              <p className="a-label">{sw.utmMediumHeading}</p>
              <p className="a-hint !mt-0">{sw.utmMediumHint}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {ANNOUNCE_CHANNELS.map((c) => (
                  <div key={c}>
                    <label className="a-label" htmlFor={`${uid}-m-${c}`}>{sw.utmMedium(w.channels[c])}</label>
                    <input
                      id={`${uid}-m-${c}`}
                      className="a-input"
                      dir="ltr"
                      maxLength={40}
                      placeholder={c}
                      value={utm.mediumByChannel[c] ?? ""}
                      autoComplete="off"
                      onChange={(e) => change((d) => (e.target.value === "" ? void delete d.advanced.utm.mediumByChannel[c] : void (d.advanced.utm.mediumByChannel[c] = e.target.value)))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <p className="a-hint">
              {sw.utmExample}: <bdi dir="ltr" className="break-all">{sample}</bdi>
            </p>
          </fieldset>
        </fieldset>
      ),
    },
  ];
  const q = filter.trim().toLowerCase();
  const shown = advanced.filter((s) => !q || `${s.label} ${s.words}`.toLowerCase().includes(q));
  const isOpen = open || q !== "";

  return (
    <form noValidate onSubmit={(e) => (e.preventDefault(), void doc.save(working))} className="max-w-3xl space-y-8" aria-labelledby={`${uid}-h`}>
      <div>
        <h2 id={`${uid}-h`} className="display-tight text-xl">{w.settingsHeading}</h2>
        <p className="a-hint">{w.settingsIntro}</p>
      </div>

      <section aria-labelledby={`${uid}-ev`} className="space-y-4">
        <div>
          <h3 id={`${uid}-ev`} className="display-tight text-lg">{sw.everydayHeading}</h3>
          <p className="a-hint !mt-0">{sw.everydayHint} {sw.templatesMoved}</p>
        </div>

        {check(`${uid}-mail`, w.emailEnabled, draft.email.enabled, (v) => change((d) => void (d.email.enabled = v)), w.emailHint)}

        <fieldset>
          <legend className="a-label">{w.channelsHeading}</legend>
          {ANNOUNCE_CHANNELS.map((c) => (
            <div key={c}>{check(`${uid}-ch-${c}`, w.channels[c], draft.channels.includes(c), (v) => change((d) => void (d.channels = ANNOUNCE_CHANNELS.filter((x) => (x === c ? v : d.channels.includes(x))))))}</div>
          ))}
        </fieldset>

        <div>
          <label className="a-label" htmlFor={`${uid}-tags`}>{w.hashtags}</label>
          <input id={`${uid}-tags`} className="a-input" dir="auto" value={tagText} onChange={(e) => (touch(), setTags(e.target.value))} aria-describedby={`${uid}-tags-h`} autoComplete="off" />
          <p id={`${uid}-tags-h`} className="a-hint">{w.hashtagsHint}</p>
        </div>

        <div>
          <label className="a-label" htmlFor={`${uid}-sig`}>{w.signature}</label>
          <textarea id={`${uid}-sig`} className="a-textarea" rows={2} maxLength={300} dir="auto" value={draft.signature} onChange={(e) => change((d) => void (d.signature = e.target.value))} aria-describedby={`${uid}-sig-h`} />
          <p id={`${uid}-sig-h`} className="a-hint">{w.signatureHint}</p>
        </div>

        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={everydayIsDefault} onClick={resetEveryday}>
          {sw.resetSection}
        </button>
      </section>

      <details
        className="a-box"
        open={isOpen}
        onToggle={(e) => {
          /* A filter forces it open; only a person's own toggle is remembered. */
          if (q === "") setOpen(e.currentTarget.open);
        }}
        data-testid="advanced"
      >
        <summary className="a-box-head min-h-[44px] cursor-pointer">
          <span className="a-box-title">{sw.advancedHeading}</span>
          {advancedDirty && <span className="ms-2 text-xs text-clay">{w.unsaved}</span>}
        </summary>
        <div className="space-y-6 p-4">
          <p className="a-hint !mt-0">{sw.advancedHint}</p>
          <div>
            <label className="a-label" htmlFor={`${uid}-f`}>{sw.filterLabel}</label>
            <input id={`${uid}-f`} type="search" className="a-input max-w-sm" dir="auto" value={filter} placeholder={sw.filterPlaceholder} onChange={(e) => setFilter(e.target.value)} autoComplete="off" />
            <p className="a-hint" role="status">{q ? (shown.length ? sw.filterCount(shown.length) : sw.filterNone) : ""}</p>
          </div>
          {shown.map((s) => <div key={s.key}>{s.node}</div>)}
          <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={resetAdvanced}>{sw.resetSection}</button>
        </div>
      </details>

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
        <button type="submit" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirty || status === "saving" || sourceBad}>{w.save}</button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => (setTags(null), doc.discard())}>{w.reset}</button>
        {status === "conflict" && <button type="button" className="a-btn min-h-[44px]" onClick={() => (setTags(null), doc.reload())}>{w.reload}</button>}
        <span role="status" className={`text-sm ${bad ? "font-bold text-[rgb(var(--destructive-ink))]" : "text-clay"}`}>{statusText}</span>
      </div>
    </form>
  );
}
