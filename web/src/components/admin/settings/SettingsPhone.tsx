import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { ICON } from "@/components/ui/icons";
import { RecordRow, type Fact } from "@/components/ui/RecordRow";
import { SettingsList, type SettingsGroupDef } from "@/components/ui/SettingsList";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { issueText, useSettingsWords } from "@/components/admin/settings/words";
import { changesBetween, type Change } from "@/components/admin/settings/diff";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import type { Issue } from "@/services/adminContent";
import type { SettingsView } from "@/services/adminSettings";
import { ACCENT_PRESETS, css } from "@/settings/accents";
import { ACCENTS, MOTION_DEFAULTS, SHARE_CHANNELS, SHARE_SURFACES, SHARE_TEMPLATE_MAX, THEME_DEFAULTS, type SiteSettings } from "@/settings/schema";
import styles from "@/components/admin/phone/phone.module.css";

/*
 * /admin/settings below 600px. The same working copy as the desktop form,
 * shown as five groups (one summary line each, opened as a page) and the save
 * history as compact rows in a closed section. A history row is the version,
 * when it was saved and how many things differ from the live one; the diff
 * and Put back are in its sheet. Every edit goes through the page's `edit`, so
 * Save, Reset, the revision check and the payload are the desktop's.
 * The history keeps no author, so a row cannot say who saved it.
 */

export const GROUP_IDS = ["home", "look", "sharing", "links", "texts"] as const;
export const isGroupId = (v: string | null): v is (typeof GROUP_IDS)[number] => GROUP_IDS.includes(v as never);

export interface SettingsPhoneProps {
  draft: SiteSettings;
  view: SettingsView;
  edit: (fn: (d: SiteSettings) => void) => void;
  toggle: <T extends string>(all: readonly T[], list: readonly T[], item: T, on: boolean) => T[];
  move: (i: number, by: -1 | 1) => void;
  issues: Issue[];
  saving: boolean;
  onRestore: (version: number) => Promise<void>;
  openId: string | null;
  onOpenChange: (id: string | null, surface?: "page" | "sheet") => void;
}

function Choice<T extends string>({ name, legend, hint, options, value, onChange }: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: T; label: string; swatch?: [string, string] }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="px-4 py-3">
      <legend className="a-label !mt-0">{legend}</legend>
      {hint && <p className="a-hint">{hint}</p>}
      <div className="mt-1 flex flex-col">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-[44px] items-center gap-3 text-sm">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.swatch && (
              <span aria-hidden="true" className="flex overflow-hidden rounded-full border border-[rgb(var(--rule-firm))]">
                <span className="block h-5 w-5" style={{ background: o.swatch[0] }} />
                <span className="block h-5 w-5" style={{ background: o.swatch[1] }} />
              </span>
            )}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SettingsPhone({ draft, view, edit, toggle, move, issues, saving, onRestore, openId, onOpenChange }: SettingsPhoneProps) {
  const w = useSettingsWords();
  const p = usePhoneAdminWords().settings;
  const lang = useLang();
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const issueAt = (path: string) => issues.find((i) => i.path === path);
  const sw = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean, warning?: string | null) => (
    <SettingsRow key={id} kind="switch" id={id} label={label} checked={checked} onChange={onChange} disabled={disabled} warning={warning} />
  );

  const written = (["en", "he"] as const).reduce((n, l) => n + SHARE_CHANNELS.filter((c) => (draft.sharing.templates[l][c] ?? "") !== "").length, 0);

  const groups: SettingsGroupDef<SiteSettings>[] = [
    {
      id: "home",
      icon: ICON.home,
      title: p.groupHome,
      controls: draft.home.sections.length * 3,
      summary: (d) => {
        const hidden = d.home.sections.filter((s) => !s.visible).length;
        return p.sumHome(d.home.sections.length - hidden, hidden);
      },
      warning: () => {
        const bad = issues.find((i) => /^home\.sections\.\d+/.test(i.path));
        return bad ? issueText(w, bad.message) : null;
      },
      render: (d) => (
        <>
          <p className="px-4 py-3 text-sm text-clay">{p.hero}</p>
          {d.home.sections.map((s, i) => {
            const name = w.sections[s.id];
            const issue = issueAt(`home.sections.${i}`) ?? issueAt(`home.sections.${i}.id`);
            return (
              <div key={s.id} className="flex items-center">
                <div className="min-w-0 flex-1">
                  {sw(`settings-${s.id}-visible`, name, s.visible, (v) => edit((x) => void (x.home.sections[i].visible = v)), false, issue ? issueText(w, issue.message) : null)}
                </div>
                <span className="flex gap-1 pe-2">
                  <button type="button" id={`settings-${s.id}-up`} className="a-btn a-btn-ghost a-icon-btn" aria-label={w.moveUp(name)} disabled={i === 0} onClick={() => move(i, -1)}>
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button type="button" id={`settings-${s.id}-down`} className="a-btn a-btn-ghost a-icon-btn" aria-label={w.moveDown(name)} disabled={i === d.home.sections.length - 1} onClick={() => move(i, 1)}>
                    <span aria-hidden="true">↓</span>
                  </button>
                </span>
              </div>
            );
          })}
        </>
      ),
    },
    {
      id: "look",
      icon: ICON.everyday,
      title: p.groupLook,
      controls: THEME_DEFAULTS.length + MOTION_DEFAULTS.length + ACCENTS.length,
      summary: (d) => p.sumLook(w.themes[d.visuals.theme], w.motions[d.visuals.motion], w.accents[d.visuals.accent]),
      render: (d) => (
        <>
          <Choice name="settings-theme" legend={w.themeLegend} hint={w.themeHint} value={d.visuals.theme} onChange={(t) => edit((x) => void (x.visuals.theme = t))} options={THEME_DEFAULTS.map((t) => ({ value: t, label: w.themes[t] }))} />
          <Choice name="settings-motion" legend={w.motionLegend} hint={w.motionHint} value={d.visuals.motion} onChange={(m) => edit((x) => void (x.visuals.motion = m))} options={MOTION_DEFAULTS.map((m) => ({ value: m, label: w.motions[m] }))} />
          <Choice
            name="settings-accent" legend={w.accentLegend} hint={w.accentHint} value={d.visuals.accent} onChange={(a) => edit((x) => void (x.visuals.accent = a))}
            options={ACCENTS.map((a) => ({ value: a, label: w.accents[a], swatch: [css(ACCENT_PRESETS[a].light.signal), css(ACCENT_PRESETS[a].dark.signal)] as [string, string] }))}
          />
        </>
      ),
    },
    {
      id: "sharing",
      icon: ICON.channels,
      title: p.groupSharing,
      controls: 1 + SHARE_SURFACES.length + SHARE_CHANNELS.length,
      summary: (d) => (d.sharing.enabled ? p.sumSharing(d.sharing.surfaces.length, d.sharing.channels.length) : p.off),
      render: (d) => (
        <>
          {sw("settings-sharing-enabled", w.sharingEnabled, d.sharing.enabled, (v) => edit((x) => void (x.sharing.enabled = v)))}
          <h3 className="a-label px-4 pt-3">{w.surfacesLegend}</h3>
          {SHARE_SURFACES.map((s) => sw(`settings-surface-${s}`, w.surfaces[s], d.sharing.surfaces.includes(s), (v) => edit((x) => void (x.sharing.surfaces = toggle(SHARE_SURFACES, x.sharing.surfaces, s, v))), !d.sharing.enabled))}
          <h3 className="a-label px-4 pt-3">{w.channelsLegend}</h3>
          {SHARE_CHANNELS.map((c) => sw(`settings-channel-${c}`, w.channels[c], d.sharing.channels.includes(c), (v) => edit((x) => void (x.sharing.channels = toggle(SHARE_CHANNELS, x.sharing.channels, c, v))), !d.sharing.enabled))}
        </>
      ),
    },
    {
      id: "links",
      icon: ICON.usedIn,
      title: p.groupLinks,
      controls: 2,
      hasText: true,
      summary: (d) => (d.sharing.utm.enabled ? p.sumLinks(d.sharing.utm.source) : p.off),
      render: (d) => (
        <>
          {sw("settings-utm-enabled", w.utmEnabled, d.sharing.utm.enabled, (v) => edit((x) => void (x.sharing.utm.enabled = v)), !d.sharing.enabled)}
          <div className="px-4 py-3">
            <label className="a-label !mt-0" htmlFor="settings-utm-source">{w.utmSource}</label>
            <input
              id="settings-utm-source" className="a-input a-input-mono mt-1" dir="ltr" maxLength={40}
              value={d.sharing.utm.source} disabled={!d.sharing.enabled || !d.sharing.utm.enabled}
              onChange={(e) => edit((x) => void (x.sharing.utm.source = e.target.value))}
            />
          </div>
        </>
      ),
    },
    {
      id: "texts",
      icon: ICON.note,
      title: p.groupTexts,
      controls: SHARE_CHANNELS.length * 2,
      hasText: true,
      summary: () => p.sumTexts(written, SHARE_CHANNELS.length * 2),
      render: (d) => (
        <>
          {(["en", "he"] as const).map((l) => (
            <Disclosure key={l} summary={w.templatesFor[l]} className="px-4">
              <div className="space-y-4 pb-3">
                {SHARE_CHANNELS.map((c) => {
                  const id = `settings-template-${l}-${c}`;
                  const value = d.sharing.templates[l][c] ?? "";
                  return (
                    <div key={c}>
                      <label className="a-label" htmlFor={id}>{w.channels[c]}</label>
                      <textarea
                        id={id} className="a-textarea mt-1" rows={3} dir={l === "he" ? "rtl" : "ltr"} lang={l} value={value} disabled={!d.sharing.enabled}
                        onChange={(e) =>
                          edit((x) => {
                            if (e.target.value === "") delete x.sharing.templates[l][c];
                            else x.sharing.templates[l][c] = e.target.value;
                          })
                        }
                      />
                      <p className="a-hint tabular-nums">{w.templateCount(value.length, SHARE_TEMPLATE_MAX)}</p>
                    </div>
                  );
                })}
              </div>
            </Disclosure>
          ))}
        </>
      ),
    },
  ];

  /* ----- history ----- */
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(INTL[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const label = (v: number) => (v === 0 ? w.builtIn : w.version(v));
  const entries = [
    { version: view.version, at: view.updatedAt, live: true, changes: [] as Change[] },
    ...view.history.map((h) => ({ version: h.version, at: h.version === 0 ? "" : h.at, live: false, changes: changesBetween(h.settings, view.settings) })),
  ];
  const factsOf = (e: (typeof entries)[number]): [Fact?, Fact?] => {
    const at = e.at ? { icon: ICON.when, text: when(e.at) } : undefined;
    return e.live ? [at] : [at, { text: p.changesCount(e.changes.length) }];
  };
  const open = entries.find((e) => e.version === openVersion) ?? null;

  const line = (c: Change) => {
    if (c.kind === "section") return `${p.sectionN(c.index + 1)}: ${w.sections[c.id as keyof typeof w.sections]}${c.visible ? "" : ` · ${p.hiddenTag}`}`;
    if (c.kind === "visual") {
      const legend = { theme: w.themeLegend, motion: w.motionLegend, accent: w.accentLegend }[c.key];
      const value = (c.key === "theme" ? w.themes : c.key === "motion" ? w.motions : w.accents) as Record<string, string>;
      return `${legend}: ${value[c.value]}`;
    }
    return `${w.sharingHeading}: ${p.sharingChanged}`;
  };

  const restore = async (version: number) => {
    setBusy(true);
    try {
      await onRestore(version);
      setOpenVersion(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page} data-testid="settings-phone">
      <SettingsList groups={groups} value={draft} openId={openId} onOpenChange={onOpenChange} />

      {view.exists && (
        <Disclosure summary={w.historyHeading} meta={p.historyMeta(view.history.length)} testid="settings-history">
          <ul className={styles.list}>
            {entries.map((e) => (
              <RecordRow
                key={e.version}
                as="li"
                icon={ICON.restore}
                title={e.live ? `${w.version(e.version)} · ${w.current}` : label(e.version)}
                facts={factsOf(e)}
                openLabel={`${p.openVersion(e.live ? `${w.version(e.version)} · ${w.current}` : label(e.version))} ${factsOf(e).filter(Boolean).map((f) => f!.text).join(" ")}`}
                onOpen={() => setOpenVersion(e.version)}
              />
            ))}
          </ul>
        </Disclosure>
      )}

      <BottomSheet
        open={open !== null}
        onClose={() => setOpenVersion(null)}
        title={open ? (open.live ? w.version(open.version) : label(open.version)) : ""}
        footer={
          open && !open.live ? (
            <button type="button" className="a-btn a-btn-primary min-h-[44px]" aria-label={w.restoreLabel(label(open.version))} disabled={busy || saving} onClick={() => void restore(open.version)}>
              {w.restore}
            </button>
          ) : null
        }
      >
        {open && (
          <div className={styles.sheetBody} data-testid="settings-version">
            {open.at && <time dateTime={open.at} className={styles.num}>{when(open.at)}</time>}
            {open.live ? (
              <p>{p.isLive}</p>
            ) : open.changes.length === 0 ? (
              <p>{p.same}</p>
            ) : (
              <section>
                <h3 className={styles.heading} id="settings-diff">{p.diffHeading}</h3>
                <ul className={styles.changes} aria-labelledby="settings-diff">
                  {open.changes.map((c, i) => (
                    <li key={i} className={styles.change}>{line(c)}</li>
                  ))}
                </ul>
              </section>
            )}
            {!open.live && <p className="a-hint">{p.restoreHint}</p>}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
