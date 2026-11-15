import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useContentWords } from "@/components/admin/content/words";
import AdminShell from "@/components/admin/AdminShell";
import EditorBar, { type BarTone } from "@/components/admin/EditorBar";
import { PageHeader } from "@/components/admin/ui";
import SettingsPhone, { isGroupId } from "@/components/admin/settings/SettingsPhone";
import { usePhone } from "@/hooks/usePhone";
import { issueText, useSettingsWords } from "@/components/admin/settings/words";
import { ContentConflictError, ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminSettings, type SettingsView } from "@/services/adminSettings";
import { SiteSettingsSchema, type SiteSettings } from "@/settings/schema";
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

/* The width SettingsList puts a list and its open group side by side at. */
const WIDE = "(min-width: 840px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(WIDE);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(WIDE).matches,
    () => false,
  );
}

export default function AdminSettings() {
  const w = useSettingsWords();
  const phone = usePhone();
  /* On a phone the open group lives in the address, so a link can land on it. */
  const [params, setParams] = useSearchParams();
  const group = params.get("group");
  /* Side by side (840px and up) a group is always open, so the pane is never an empty page. */
  const wide = useWide();
  const openId = isGroupId(group) ? group : wide ? "home" : null;
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

  return (
    <AdminShell
      title={w.title}
      section="settings"
      barEverywhere
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
      <PageHeader title={w.title} description={phone ? undefined : w.intro} />

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

      {draft && view && (
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

    </AdminShell>
  );
}
