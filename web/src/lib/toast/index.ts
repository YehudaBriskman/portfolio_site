import { useSyncExternalStore } from "react";
import { useToastWords } from "@/i18n/toast";
import type { HelpTopic } from "./helpTopics";

export { HELP_TOPICS, helpHref, type HelpTopic } from "./helpTopics";

/*
 * The toast service: one place that decides what is shown, for how long, and
 * what is remembered. Rendering (stack, swipe, pause on hover/focus/touch)
 * is sonner's, in `components/ui/ToastHost.tsx`, which reads this store; this
 * file imports no library and no DOM, so any page may raise a toast without
 * paying for the renderer, and the state is correct with or without a host
 * (it uses timers and plain values, never animation events).
 *
 * Decision rule (docs/admin-design-guide.md): a toast is the transient result
 * of an action. Something to fix or keep seeing stays inline; something that
 * needs a decision is a sheet or dialog.
 */

export type ToastKind = "success" | "info" | "warning" | "error" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** The same id replaces the toast in place: no stacking storm. */
  id?: string;
  /** One short line under the title. */
  description?: string;
  /** Longer text behind a Details button. Never kept in the history. */
  details?: string;
  /** A "Learn more" link to a help topic (typed ids: `helpTopics.ts`). Shown with the Details, or alone. */
  help?: { topic: HelpTopic };
  action?: ToastAction;
  secondary?: ToastAction;
  /** Ms. Overrides the default for the kind. */
  duration?: number;
  /** Never expires on its own. */
  persistent?: boolean;
  dismissible?: boolean;
}

export interface ToastRecord {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  details?: string;
  help?: { topic: HelpTopic };
  action?: ToastAction;
  secondary?: ToastAction;
  /** Ms; Infinity never expires. */
  duration: number;
  dismissible: boolean;
  /** Details are showing. */
  open: boolean;
  /** Bumped on every change, so a renderer knows to re-emit. */
  rev: number;
}

export interface HistoryEntry {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  at: number;
}

/** Default lifetime by importance, in ms (design guide: toasts >= 5 s, Undo >= 8 s). */
export const toastDurations = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: 8000,
  /** An error with something to press is not allowed to vanish under the pointer. */
  errorWithAction: 12000,
  undo: 8000,
} as const;

export const HISTORY_MAX = 30;

let records: ToastRecord[] = [];
let history: HistoryEntry[] = [];
let unread = 0;
let version = 0;
let seq = 0;
let hosts = 0;
let announced: { status: string; alert: string; n: number } = { status: "", alert: "", n: 0 };
const listeners = new Set<() => void>();

const emit = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

function lifetime(kind: ToastKind, o: ToastOptions, open: boolean): number {
  if (open || o.persistent || kind === "loading") return Infinity;
  if (o.duration !== undefined) return o.duration;
  if (kind === "error") return o.action || o.secondary || o.details || o.help ? toastDurations.errorWithAction : toastDurations.error;
  return toastDurations[kind];
}

function raise(kind: ToastKind, title: string, o: ToastOptions = {}, open = false, quiet = false): string {
  const id = o.id ?? `t${(seq += 1)}`;
  const prev = records.find((r) => r.id === id);
  const rec: ToastRecord = {
    id,
    kind,
    title,
    description: o.description,
    details: o.details,
    help: o.help,
    action: o.action,
    secondary: o.secondary,
    duration: lifetime(kind, o, open),
    dismissible: o.dismissible ?? kind !== "loading",
    open,
    rev: (prev?.rev ?? 0) + 1,
  };
  records = prev ? records.map((r) => (r.id === id ? rec : r)) : [...records, rec];
  options.set(id, o);

  if (quiet) {
    emit();
    return id;
  }

  /* One history line per id: an update rewrites it rather than adding another. */
  const entry: HistoryEntry = { id, kind, title, description: o.description, at: Date.now() };
  const had = history.some((h) => h.id === id);
  history = had ? history.map((h) => (h.id === id ? entry : h)) : [entry, ...history].slice(0, HISTORY_MAX);
  if (kind !== "loading" && !had) unread += 1;

  /* Written once per toast: a loading line is not news, its outcome is. */
  if (kind !== "loading") {
    announced = { ...announced, n: announced.n + 1, ...(kind === "error" ? { alert: title } : { status: title }) };
  }
  emit();
  return id;
}

const options = new Map<string, ToastOptions>();

/* ------------------------------------------------------------- undo --- */

interface Job {
  commit: () => void | Promise<void>;
  onUndo?: () => void;
  settled: boolean;
}
const jobs = new Map<string, Job>();

function settle(id: string, undone: boolean) {
  const j = jobs.get(id);
  if (!j || j.settled) return;
  j.settled = true;
  jobs.delete(id);
  if (undone) j.onUndo?.();
  else void j.commit();
}

function flushJobs() {
  for (const id of [...jobs.keys()]) settle(id, false);
}

let pagehideBound = false;
function bindPagehide() {
  if (pagehideBound || typeof window === "undefined") return;
  pagehideBound = true;
  window.addEventListener("pagehide", flushJobs);
}

function currentLang(): "en" | "he" {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang.toLowerCase().startsWith("he") ? "he" : "en";
}

/* -------------------------------------------------------------- api --- */

function remove(id: string) {
  if (!records.some((r) => r.id === id)) return;
  records = records.filter((r) => r.id !== id);
  options.delete(id);
  emit();
}

export const toast = {
  success: (title: string, o?: ToastOptions) => raise("success", title, o),
  info: (title: string, o?: ToastOptions) => raise("info", title, o),
  warning: (title: string, o?: ToastOptions) => raise("warning", title, o),
  error: (title: string, o?: ToastOptions) => raise("error", title, o),
  loading: (title: string, o?: ToastOptions) => raise("loading", title, o),

  /** A loading toast that becomes the outcome, under one id. Resolves with the promise. */
  promise<T>(
    p: Promise<T>,
    m: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string); id?: string } & Omit<ToastOptions, "id">,
  ): Promise<T> {
    const { loading, success, error, ...rest } = m;
    const id = raise("loading", loading, rest);
    return p.then(
      (v) => {
        raise("success", typeof success === "function" ? success(v) : success, { ...rest, id });
        return v;
      },
      (e: unknown) => {
        raise("error", typeof error === "function" ? error(e) : error, { ...rest, id });
        throw e;
      },
    );
  },

  /**
   * A deferred action with an Undo window. `commit` is held back and runs once
   * when the toast goes away without Undo (timeout, dismiss, swipe, pagehide,
   * or a newer job replacing it). With no host mounted nothing could show the
   * Undo, so it commits at once rather than being lost.
   */
  undoable(job: { title: string; commit: () => void | Promise<void>; onUndo?: () => void; duration?: number; undoLabel?: string }): string {
    flushJobs();
    if (hosts === 0) {
      void job.commit();
      return "";
    }
    bindPagehide();
    const id = `u${(seq += 1)}`;
    jobs.set(id, { commit: job.commit, onUndo: job.onUndo, settled: false });
    raise("info", job.title, {
      id,
      duration: Math.max(job.duration ?? toastDurations.undo, toastDurations.undo),
      action: {
        label: job.undoLabel ?? useToastWords.of(currentLang()).undo,
        onClick: () => {
          settle(id, true);
          remove(id);
        },
      },
    });
    return id;
  },

  /** Closes a toast (and commits a pending Undo job: dismissing is not Undo). */
  dismiss(id?: string) {
    const ids = id ? [id] : records.map((r) => r.id);
    for (const i of ids) {
      settle(i, false);
      remove(i);
    }
  },

  /** Opens or closes the Details of a toast; open ones do not expire. */
  toggleDetails(id: string) {
    const r = records.find((x) => x.id === id);
    if (!r?.details) return;
    raise(r.kind, r.title, { ...(options.get(id) ?? {}), id }, !r.open, true);
  },

  /** The renderer reports a toast left the screen (`auto` timeout or a user `dismiss`/swipe). */
  gone(id: string, _reason: "auto" | "dismiss") {
    void _reason;
    settle(id, false);
    remove(id);
  },

  live: (): readonly ToastRecord[] => records,
  history: (): readonly HistoryEntry[] => history,
  unread: () => unread,
  markRead() {
    if (!unread) return;
    unread = 0;
    emit();
  },
  clearHistory() {
    history = [];
    unread = 0;
    emit();
  },
  announcement: () => announced,

  /** The host registers itself; `undoable` needs one to be able to show anything. */
  hostMounted(on: boolean) {
    hosts = Math.max(0, hosts + (on ? 1 : -1));
    emit();
  },
  hasHost: () => hosts > 0,
  /** Has anything been raised this visit (the public site mounts the host only then). */
  raised: () => seq > 0,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  version: () => version,
};

/** For tests: forget everything. */
export function __resetToasts() {
  jobs.clear();
  options.clear();
  seq = 0;
  records = [];
  history = [];
  unread = 0;
  hosts = 0;
  announced = { status: "", alert: "", n: 0 };
  emit();
}

/** Re-renders when anything changes. */
export function useToastVersion(): number {
  return useSyncExternalStore(toast.subscribe, toast.version, toast.version);
}

/** The last notifications, newest first (session only). */
export function useToastHistory(): { entries: readonly HistoryEntry[]; unread: number } {
  useToastVersion();
  return { entries: history, unread };
}

/**
 * Keeps the desktop stack clear of a fixed bar for as long as the caller is
 * mounted: pass the bar's height in px (0 or null releases it). On a phone
 * toasts are at the top, so this only matters at desktop width.
 */
export function setToastAvoid(px: number | null): void {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  if (px) s.setProperty("--toast-avoid", `${px}px`);
  else s.removeProperty("--toast-avoid");
}
