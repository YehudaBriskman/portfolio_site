import { useId } from "react";
import { NOTIFY_EVENTS, type NotifySettings } from "@/services/adminAnnounce";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useNotifyWords } from "./words";

const clamp = (v: string, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};

/* Settings > Advanced > Notices by email. The master switch is in Everyday; this holds which events, how often and the digest. */
export default function NotifySection({ notify, onChange, phone = false }: { notify: NotifySettings; onChange: (fn: (n: NotifySettings) => void) => void; phone?: boolean }) {
  const w = useNotifyWords();
  const uid = useId();
  const off = !notify.enabled;
  if (phone) {
    /* On a phone: switch rows with the help behind an info button; a number field only while its switch is on. */
    return (
      <section aria-label={w.heading} data-testid="notify-section">
        <fieldset className="min-w-0" disabled={off}>
          <legend className="sr-only">{w.events}</legend>
          {NOTIFY_EVENTS.map((k) => {
            const r = notify.events[k];
            return (
              <div key={k}>
                <SettingsRow kind="switch" id={`notice-${k}`} label={w.ev[k]} checked={r.on} onChange={(v) => onChange((n) => void (n.events[k].on = v))} />
                {r.on && (
                  <label className="flex items-center gap-2 px-4 pb-2 text-sm text-clay">
                    <span>{w.every}</span>
                    <input type="number" inputMode="numeric" min={0} max={168} className="a-input min-h-[44px] w-20 tabular-nums" dir="ltr" value={r.hours} onChange={(e) => onChange((n) => void (n.events[k].hours = clamp(e.target.value, 168)))} />
                    <span>{w.hoursUnit}</span>
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
        <fieldset className="min-w-0" disabled={off}>
          <SettingsRow kind="switch" id="notice-digest" label={w.digestOn} info={w.digestHint} checked={notify.digest.enabled} onChange={(v) => onChange((n) => void (n.digest.enabled = v))} />
          {notify.digest.enabled && (
            <div className="px-4 pb-3" data-setting-id="notice-hour">
              <div className="flex items-center justify-between gap-2">
                <label className="a-label !mt-0" htmlFor={`${uid}-hr`}>{w.digestHour}</label>
                <InfoPopover label={w.digestHour} text={w.digestHourHint} />
              </div>
              <input id={`${uid}-hr`} type="number" inputMode="numeric" min={0} max={23} className="a-input min-h-[44px] w-20 tabular-nums" dir="ltr" value={notify.digest.hour} onChange={(e) => onChange((n) => void (n.digest.hour = clamp(e.target.value, 23)))} />
            </div>
          )}
          <div className="px-4 pb-3 pt-2" data-setting-id="notice-lang">
            <label className="a-label !mt-0" htmlFor={`${uid}-lang`}>{w.lang}</label>
            <select id={`${uid}-lang`} className="a-input min-h-[44px] w-40" value={notify.lang} onChange={(e) => onChange((n) => void (n.lang = e.target.value === "en" ? "en" : "he"))}>
              <option value="he">{w.langHe}</option>
              <option value="en">{w.langEn}</option>
            </select>
          </div>
        </fieldset>
      </section>
    );
  }
  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-3" data-testid="notify-section">
      <div>
        <h4 id={`${uid}-h`} className="display-tight text-lg">{w.heading}</h4>
        <p className="a-hint !mt-0">{w.intro}</p>
      </div>
      <fieldset className="min-w-0 space-y-1" disabled={off}>
        <legend className="a-label">{w.events}</legend>
        <ul className="space-y-1">
          {NOTIFY_EVENTS.map((k) => {
            const r = notify.events[k];
            return (
              <li key={k} className="flex flex-wrap items-center gap-x-4">
                <label className="flex min-h-[44px] min-w-0 flex-1 basis-60 items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={r.on} onChange={(e) => onChange((n) => void (n.events[k].on = e.target.checked))} />
                  <span>{w.ev[k]}</span>
                </label>
                <label className="flex items-center gap-2 ps-8 text-sm text-clay sm:ps-0">
                  <span>{w.every}</span>
                  <input type="number" inputMode="numeric" min={0} max={168} className="a-input min-h-[44px] w-20 tabular-nums" dir="ltr" disabled={!r.on} value={r.hours} onChange={(e) => onChange((n) => void (n.events[k].hours = clamp(e.target.value, 168)))} />
                  <span>{w.hoursUnit}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset className="min-w-0 space-y-1" disabled={off}>
        <label className="flex min-h-[44px] items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={notify.digest.enabled} aria-describedby={`${uid}-dh`} onChange={(e) => onChange((n) => void (n.digest.enabled = e.target.checked))} />
          <span>{w.digestOn}</span>
        </label>
        <p id={`${uid}-dh`} className="a-hint !mt-0 ps-8">{w.digestHint}</p>
        {notify.digest.enabled && (
          <div className="ps-8">
            <label className="a-label" htmlFor={`${uid}-hr`}>{w.digestHour}</label>
            <input id={`${uid}-hr`} type="number" inputMode="numeric" min={0} max={23} className="a-input min-h-[44px] w-20 tabular-nums" dir="ltr" value={notify.digest.hour} aria-describedby={`${uid}-hrh`} onChange={(e) => onChange((n) => void (n.digest.hour = clamp(e.target.value, 23)))} />
            <p id={`${uid}-hrh`} className="a-hint">{w.digestHourHint}</p>
          </div>
        )}
        <div>
          <label className="a-label" htmlFor={`${uid}-lang`}>{w.lang}</label>
          <select id={`${uid}-lang`} className="a-input min-h-[44px] w-40" value={notify.lang} onChange={(e) => onChange((n) => void (n.lang = e.target.value === "en" ? "en" : "he"))}>
            <option value="he">{w.langHe}</option>
            <option value="en">{w.langEn}</option>
          </select>
        </div>
      </fieldset>
    </section>
  );
}
