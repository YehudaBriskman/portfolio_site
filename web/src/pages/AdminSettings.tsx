import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useContentWords } from "@/components/admin/content/words";
import AdminShell from "@/components/admin/AdminShell";
import EditorBar, { type BarTone } from "@/components/admin/EditorBar";
import { PageHeader } from "@/components/admin/ui";
import { Disclosure } from "@/components/ui/Disclosure";
import SettingsPhone, { isGroupId } from "@/components/admin/settings/SettingsPhone";
import { changesBetween } from "@/components/admin/settings/diff";
import { usePhone } from "@/hooks/usePhone";
import { issueText, useSettingsWords } from "@/components/admin/settings/words";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { ContentConflictError, ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminSettings, type SettingsView } from "@/services/adminSettings";
import { ACCENT_PRESETS, css } from "@/settings/accents";
import {
  ACCENTS,
  MOTION_DEFAULTS,
  SHARE_CHANNELS,
  SHARE_SURFACES,
  SHARE_TEMPLATE_MAX,
  SiteSettingsSchema,
  THEME_DEFAULTS,
  type SiteSettings,
} from "@/settings/schema";
import { setSettings } from "@/settings/store";

/*
 * /admin/settings (#254): the home page's order and visibility, and the
 * visual defaults, with the history of every save and a way to put one back.
 *
 * Reordering is two buttons per row rather than drag and drop: they work
 * from a keyboard and a screen reader with no extra machinery, and focus
 * follows the moved row. The shared schema checks the working copy on every
 * change, so the ledger rule (no two dark acts side by side) is shown beside
 * the row before Save is pressed, and Save is refused until it is fixed; the
 * server checks it again.
 *
 * Colour is chosen from presets, each shown as its swatch in both themes.
 */

type Status = "idle" | "saving" | "saved" | "conflict" | "failed" | "unauthorised";

const differences = (a: SiteSettings, b: SiteSettings): number => changesBetween(a, b).length;

export default function AdminSettings() {
  const w = useSettingsWords();
  const lang = useLang();
  const phone = usePhone();
  /* On a phone the open group lives in the address, so a link can land on it. */
  const [params, setParams] = useSearchParams();
  const group = params.get("group");
  const openId = phone && isGroupId(group) ? group : null;
  const navigate = useNavigate();
  const location = useLocation();
  /*
   * A page (a group with a text field) is a screen, so opening it is a PUSH and Back closes it;
   * a replace would send Back out of /admin/settings and drop the unsaved edits. A sheet pushes
   * its own entry, so it only rewrites the address. Closing a page we pushed goes back, so no
   * dead entry is left to step through.
   */
  const openGroup = (id: string | null, surface?: "page" | "sheet") => {
    if (!id && (location.state as { settingsPage?: boolean } | null)?.settingsPage) return navigate(-1);
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (id) next.set("group", id);
        else next.delete("group");
        return next;
      },
      id && surface === "page" ? { state: { settingsPage: true } } : { replace: true },
    );
  };
  const leaveText = useContentWords().leaveConfirm;
  /* A page has no sheet to hand focus back, so return it to the row that opened it. */
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      return;
    }
    const id = lastOpen.current;
    lastOpen.current = null;
    if (id) document.querySelector<HTMLElement>(`[data-settings-group="${id}"] button`)?.focus();
  }, [openId]);
  const [view, setView] = useState<SettingsView | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [loadError, setLoadError] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);

  const take = useCallback((v: SettingsView) => {
    setView(v);
    setDraft(structuredClone(v.settings));
    setServerIssues([]);
    /* The admin is a page of this site: what it shows itself in follows the save. */
    setSettings(v.settings);
  }, []);

  const fetchView = useCallback(() => {
    adminSettings
      .get()
      .then(take)
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === "not-authorised") setStatus("unauthorised");
        else setLoadError(true);
      });
  }, [take]);

  useEffect(fetchView, [fetchView]);

  const load = () => {
    setLoadError(false);
    setStatus("idle");
    fetchView();
  };

  /* Move focus to the button that moved with its row, after the re-render. */
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  }, [draft]);

  const localIssues = useMemo<Issue[]>(() => {
    if (!draft) return [];
    const parsed = SiteSettingsSchema.safeParse(draft);
    return parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
  }, [draft]);
  const issues = localIssues.length > 0 ? localIssues : serverIssues;
  const issueAt = (path: string) => issues.find((i) => i.path === path);
  const general = issues.filter((i) => !/^home\.sections\.\d+/.test(i.path));
  const dirty = Boolean(view && draft && JSON.stringify(view.settings) !== JSON.stringify(draft));
  useLeaveGuard(dirty || status === "saving", leaveText);

  const edit = (fn: (d: SiteSettings) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });
    setStatus("idle");
    setServerIssues([]);
  };

  /* Keep the canonical order so two saves of the same choice are the same bytes. */
  const toggle = <T extends string>(all: readonly T[], list: readonly T[], item: T, on: boolean): T[] =>
    all.filter((x) => (x === item ? on : list.includes(x)));

  const move = (i: number, by: -1 | 1) => {
    if (!draft) return;
    const j = i + by;
    if (j < 0 || j >= draft.home.sections.length) return;
    const id = draft.home.sections[i].id;
    edit((d) => {
      const [row] = d.home.sections.splice(i, 1);
      d.home.sections.splice(j, 0, row);
    });
    /* Keep focus on the same control unless it has run out of room. */
    const edge = (by === -1 && j === 0) || (by === 1 && j === draft.home.sections.length - 1);
    focusAfter.current = `settings-${id}-${edge ? (by === -1 ? "down" : "up") : by === -1 ? "up" : "down"}`;
  };

  const run = async (op: () => Promise<SettingsView>) => {
    setStatus("saving");
    try {
      take(await op());
      setStatus("saved");
    } catch (e) {
      if (e instanceof ContentConflictError) setStatus("conflict");
      else if (e instanceof ContentInvalidError) {
        setServerIssues(e.issues);
        setStatus("failed");
      } else setStatus("failed");
    }
  };

  const save = () => {
    if (!draft || !view || localIssues.length > 0) return;
    void run(() => adminSettings.save(draft, view._rev));
  };

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString(INTL[lang], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const statusText =
    status === "saving"
      ? w.saving
      : status === "saved"
        ? w.saved
        : status === "conflict"
          ? w.conflict
          : status === "failed" && issues.length === 0
            ? w.loadFailed
            : dirty
              ? w.unsaved
              : "";

  const saveDisabled = !dirty || status === "saving" || localIssues.length > 0;
  const tone: BarTone =
    status === "conflict" || status === "failed" ? "bad" : status === "saving" ? "busy" : status === "saved" ? "ok" : "idle";

  const actions = (
    <span className="flex gap-2">
      <button type="button" className="a-btn a-btn-ghost" disabled={!dirty || status === "saving"} onClick={() => view && take(view)}>
        {w.reset}
      </button>
      <button
        type="button"
        className="a-btn a-btn-primary"
        disabled={saveDisabled}
        onClick={save}
      >
        {w.save}
      </button>
    </span>
  );

  const statusLine = (
    <span
      role="status"
      className={`mono min-h-[1.25rem] text-sm uppercase tracking-[0.18em] ${status === "conflict" || status === "failed" ? "text-[rgb(var(--destructive-ink))]" : "text-clay"}`}
    >
      {statusText}
    </span>
  );

  return (
    <AdminShell
      title={w.title}
      section="settings"
      bottomBar={
        <EditorBar
          tone={tone}
          status={statusText}
          primary={
            <button type="button" className="a-btn a-btn-primary" disabled={saveDisabled} onClick={save}>
              {w.save}
            </button>
          }
          more={[{ key: "reset", label: w.reset, disabled: !dirty || status === "saving", onSelect: () => view && take(view) }]}
        />
      }
    >
      <PageHeader
        title={w.title}
        description={phone ? undefined : w.intro}
        actions={
          <div className="hidden items-center gap-3 lg:flex">
            {statusLine}
            {actions}
          </div>
        }
      />

      {status === "unauthorised" && <p className="a-card mt-8 p-4 text-sm">{w.notAuthorised}</p>}
      {loadError && <p className="a-card mt-8 p-4 text-sm">{w.loadFailed}</p>}
      {!loadError && status !== "unauthorised" && !draft && <p className="mono mt-8 text-sm text-clay">{w.loading}</p>}
      {status === "conflict" && (
        <p className="mt-4">
          <button type="button" className="a-btn a-btn-ghost" onClick={load}>
            {w.reload}
          </button>
        </p>
      )}

      {general.length > 0 && (
        <ul className="a-card mt-4 space-y-1 p-4">
          {general.map((i) => (
            <li key={i.path + i.message} className="a-error mt-0">
              {issueText(w, i.message)}
            </li>
          ))}
        </ul>
      )}

      {draft && view && phone && (
        <SettingsPhone
          draft={draft}
          view={view}
          edit={edit}
          toggle={toggle}
          move={move}
          issues={issues}
          saving={status === "saving"}
          onRestore={(version) => run(() => adminSettings.revert(version, view._rev))}
          openId={openId}
          onOpenChange={openGroup}
        />
      )}

      {draft && view && !phone && (
        <form noValidate onSubmit={(e) => (e.preventDefault(), save())} className="max-w-3xl">
          <section className="mt-10 space-y-4" aria-labelledby="settings-home">
            <h2 id="settings-home" className="display-tight text-xl">
              {w.homeHeading}
            </h2>
            <p className="a-hint">{w.homeHint}</p>
            <ol className="space-y-2">
              <li className="a-card flex items-center gap-3 p-3 text-sm text-clay">
                <span className="mono w-6 text-end tabular-nums">0</span>
                <span>{w.hero}</span>
              </li>
              {draft.home.sections.map((s, i) => {
                const name = w.sections[s.id];
                const issue = issueAt(`home.sections.${i}`) ?? issueAt(`home.sections.${i}.id`);
                const errId = `settings-${s.id}-error`;
                return (
                  <li key={s.id} className="a-card p-3" aria-describedby={issue ? errId : undefined}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="mono w-6 text-end text-sm tabular-nums text-clay">{i + 1}</span>
                      <span className={`min-w-0 flex-1 text-sm ${s.visible ? "" : "text-clay line-through"}`}>{name}</span>
                      <label className="flex min-h-[44px] items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          id={`settings-${s.id}-visible`}
                          checked={s.visible}
                          aria-label={w.show(name)}
                          onChange={(e) => edit((d) => void (d.home.sections[i].visible = e.target.checked))}
                        />
                        <span aria-hidden="true">{s.visible ? w.shown : w.hidden}</span>
                      </label>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          id={`settings-${s.id}-up`}
                          className="a-btn a-btn-ghost a-icon-btn"
                          aria-label={w.moveUp(name)}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          id={`settings-${s.id}-down`}
                          className="a-btn a-btn-ghost a-icon-btn"
                          aria-label={w.moveDown(name)}
                          disabled={i === draft.home.sections.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                      </span>
                    </div>
                    {issue && (
                      <p id={errId} className="a-error">
                        {issueText(w, issue.message)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-10 space-y-6" aria-labelledby="settings-visuals">
            <h2 id="settings-visuals" className="display-tight text-xl">
              {w.visualsHeading}
            </h2>

            <fieldset>
              <legend className="a-label">{w.themeLegend}</legend>
              <p className="a-hint">{w.themeHint}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {THEME_DEFAULTS.map((t) => (
                  <label key={t} className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="radio" name="settings-theme" value={t} checked={draft.visuals.theme === t} onChange={() => edit((d) => void (d.visuals.theme = t))} />
                    {w.themes[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="a-label">{w.motionLegend}</legend>
              <p className="a-hint">{w.motionHint}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {MOTION_DEFAULTS.map((m) => (
                  <label key={m} className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="radio" name="settings-motion" value={m} checked={draft.visuals.motion === m} onChange={() => edit((d) => void (d.visuals.motion = m))} />
                    {w.motions[m]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="a-label">{w.accentLegend}</legend>
              <p className="a-hint">{w.accentHint}</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ACCENTS.map((a) => {
                  const p = ACCENT_PRESETS[a];
                  return (
                    <label key={a} className="a-card flex min-h-[44px] items-center gap-3 p-3 text-sm">
                      <input type="radio" name="settings-accent" value={a} checked={draft.visuals.accent === a} onChange={() => edit((d) => void (d.visuals.accent = a))} />
                      <span aria-hidden="true" className="flex overflow-hidden rounded-full border border-[rgb(var(--rule-firm))]">
                        <span className="block h-6 w-6" style={{ background: css(p.light.signal) }} />
                        <span className="block h-6 w-6" style={{ background: css(p.dark.signal) }} />
                      </span>
                      {w.accents[a]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section className="mt-10 space-y-6" aria-labelledby="settings-sharing">
            <h2 id="settings-sharing" className="display-tight text-xl">
              {w.sharingHeading}
            </h2>
            <p className="a-hint">{w.sharingHint}</p>

            <div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  role="switch"
                  id="settings-sharing-enabled"
                  checked={draft.sharing.enabled}
                  aria-describedby="settings-sharing-enabled-hint"
                  onChange={(e) => edit((d) => void (d.sharing.enabled = e.target.checked))}
                />
                {w.sharingEnabled}
              </label>
              <p id="settings-sharing-enabled-hint" className="a-hint">{w.sharingEnabledHint}</p>
            </div>

            <fieldset disabled={!draft.sharing.enabled} className="space-y-6">
              <fieldset>
                <legend className="a-label">{w.surfacesLegend}</legend>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {SHARE_SURFACES.map((x) => (
                    <label key={x} className="flex min-h-[44px] items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.sharing.surfaces.includes(x)}
                        onChange={(e) => edit((d) => void (d.sharing.surfaces = toggle(SHARE_SURFACES, d.sharing.surfaces, x, e.target.checked)))}
                      />
                      {w.surfaces[x]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="a-label">{w.channelsLegend}</legend>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {SHARE_CHANNELS.map((c) => (
                    <label key={c} className="flex min-h-[44px] items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.sharing.channels.includes(c)}
                        onChange={(e) => edit((d) => void (d.sharing.channels = toggle(SHARE_CHANNELS, d.sharing.channels, c, e.target.checked)))}
                      />
                      {w.channels[c]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.sharing.utm.enabled}
                    aria-describedby="settings-utm-hint"
                    onChange={(e) => edit((d) => void (d.sharing.utm.enabled = e.target.checked))}
                  />
                  {w.utmEnabled}
                </label>
                <p id="settings-utm-hint" className="a-hint">{w.utmHint}</p>
                <label className="a-label mt-2 block" htmlFor="settings-utm-source">{w.utmSource}</label>
                <input
                  id="settings-utm-source"
                  className="a-input a-input-mono mt-1 max-w-xs"
                  dir="ltr"
                  maxLength={40}
                  value={draft.sharing.utm.source}
                  disabled={!draft.sharing.utm.enabled}
                  onChange={(e) => edit((d) => void (d.sharing.utm.source = e.target.value))}
                />
              </div>

              <fieldset>
                <legend className="a-label">{w.templatesLegend}</legend>
                <p className="a-hint">{w.templatesHint}</p>
                <div className="mt-2 space-y-3">
                  {(["en", "he"] as const).map((l) => (
                    <Disclosure key={l} summary={w.templatesFor[l]} className="a-card p-3">
                      <div className="mt-2 space-y-4">
                        {SHARE_CHANNELS.map((c) => {
                          const id = `settings-template-${l}-${c}`;
                          const value = draft.sharing.templates[l][c] ?? "";
                          return (
                            <div key={c}>
                              <label className="a-label" htmlFor={id}>{w.channels[c]}</label>
                              <textarea
                                id={id}
                                className="a-textarea mt-1"
                                rows={3}
                                dir={l === "he" ? "rtl" : "ltr"}
                                lang={l}
                                value={value}
                                onChange={(e) =>
                                  edit((d) => {
                                    if (e.target.value === "") delete d.sharing.templates[l][c];
                                    else d.sharing.templates[l][c] = e.target.value;
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
                </div>
              </fieldset>
            </fieldset>
          </section>

          <section className="mt-10 space-y-3" aria-labelledby="settings-history">
            <h2 id="settings-history" className="display-tight text-xl">
              {w.historyHeading}
            </h2>
            {!view.exists ? (
              <p className="a-hint">{w.historyEmpty}</p>
            ) : (
              <ol className="space-y-2">
                <li className="a-card flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    {w.version(view.version)} · {w.current}
                  </span>
                  {view.updatedAt && <time dateTime={view.updatedAt} className="tabular-nums text-clay">{when(view.updatedAt)}</time>}
                </li>
                {view.history.map((h) => (
                  <li key={h.version} className="a-card flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      {h.version === 0 ? w.builtIn : w.version(h.version)}
                      <span className="text-clay"> · {w.differences(differences(h.settings, view.settings))}</span>
                    </span>
                    {h.version !== 0 && <time dateTime={h.at} className="tabular-nums text-clay">{when(h.at)}</time>}
                    <button
                      type="button"
                      className="a-btn a-btn-ghost"
                      aria-label={w.restoreLabel(h.version === 0 ? w.builtIn : w.version(h.version))}
                      disabled={status === "saving"}
                      onClick={() => void run(() => adminSettings.revert(h.version, view._rev))}
                    >
                      {w.restore}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </form>
      )}
    </AdminShell>
  );
}
