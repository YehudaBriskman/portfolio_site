import { useCallback, useEffect, useState } from "react";
import { ContentConflictError, ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminAnnounce, type AnnounceSettings, type AnnounceSettingsView, type SenderWarning } from "@/services/adminAnnounce";
import { DEFAULT_SENDER } from "./sender/defaults";

/*
 * The announce settings document, read and saved by the Settings and Library
 * tabs alike. Saved with the revision that was read, so a stale save is a 409
 * and never a silent overwrite. A document saved before snippets, the library
 * or the UTM scheme existed has none of them; they are filled in here so the
 * panels never meet an undefined.
 */

export type DocStatus = "idle" | "saving" | "saved" | "conflict" | "failed";

export const DEFAULT_UTM = { enabled: false, source: "announce", mediumByChannel: {} } as const;

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function normalise(s: AnnounceSettings): AnnounceSettings {
  const c = structuredClone(s);
  c.snippets ??= [];
  c.library ??= [];
  c.advanced ??= { utm: structuredClone(DEFAULT_UTM) };
  c.advanced.utm ??= structuredClone(DEFAULT_UTM);
  c.advanced.utm.mediumByChannel ??= {};
  /* The whole sender object travels back on save: the server resets a field it does not receive. */
  c.sender = { ...structuredClone(DEFAULT_SENDER), ...c.sender };
  return c;
}

export function useSettingsDoc() {
  const [view, setView] = useState<AnnounceSettingsView | null>(null);
  const [draft, setDraft] = useState<AnnounceSettings | null>(null);
  const [status, setStatus] = useState<DocStatus>("idle");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [warnings, setWarnings] = useState<SenderWarning[]>([]);

  const take = useCallback((v: AnnounceSettingsView) => {
    const settings = normalise(v.settings);
    setView({ ...v, settings });
    setDraft(structuredClone(settings));
  }, []);

  const reload = () => {
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

  const edit = (fn: (d: AnnounceSettings) => void) => {
    setDraft((d) => {
      const next = structuredClone(d!);
      fn(next);
      return next;
    });
    setStatus((s) => (s === "saved" ? "idle" : s));
  };

  const save = async (working: AnnounceSettings) => {
    if (!view) return;
    setStatus("saving");
    setIssues([]);
    try {
      const saved = await adminAnnounce.saveSettings(working, view._rev);
      take(saved);
      setWarnings(saved.warnings ?? []);
      setStatus("saved");
    } catch (e) {
      if (e instanceof ContentConflictError) setStatus("conflict");
      else {
        if (e instanceof ContentInvalidError) setIssues(e.issues);
        setStatus("failed");
      }
    }
  };

  const discard = () => view && (setDraft(structuredClone(view.settings)), setStatus("idle"), setIssues([]));

  return { view, draft, warnings, status, setStatus, issues, loadError, reload, edit, save, discard };
}
