import { useId } from "react";
import { NOTIFY_EVENTS, type NotifySettings } from "@/services/adminAnnounce";
import { useNotifyWords } from "./words";

const clamp = (v: string, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};

/* Settings > Advanced > Notices by email. The master switch is in Everyday; this holds which events, how often and the digest. */
export default function NotifySection({ notify, onChange }: { notify: NotifySettings; onChange: (fn: (n: NotifySettings) => void) => void }) {
  const w = useNotifyWords();
  const uid = useId();
  const off = !notify.enabled;
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
