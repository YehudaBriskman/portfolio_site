import { useCallback, useEffect, useState } from "react";

/*
 * The translations report (#301) as the admin reads it (#302): what is
 * missing, stale, in a draft or done in Hebrew, per note, area, project,
 * story beat and site-copy section. The statuses are computed by the backend
 * (`backend/src/schemas/i18n.ts`); the admin only shows them.
 *
 * One read serves the Translations page, the pill on every list row and the
 * count on the nav item, so it is cached briefly and shared. A save anywhere
 * drops the cache (`invalidateTranslations`), so the pills follow the edit.
 */

export const TRANSLATION_STATUSES = ["missing", "draft", "stale", "unverified", "translated"] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];
export const TRANSLATION_TYPES = ["post", "area", "project", "story", "site-copy"] as const;
export type TranslationType = (typeof TRANSLATION_TYPES)[number];

export type TranslationUnit = {
  path: string;
  status: TranslationStatus;
  primary: boolean;
  en: string;
  he: string | null;
  draftHe: string | null;
};

export type TranslationItem = {
  type: TranslationType;
  id: string;
  title: string;
  route: string;
  rank: number;
  visibility: "public" | "private";
  status: TranslationStatus | null;
  units: TranslationUnit[];
};

export type TranslationCounts = Record<TranslationStatus, number>;
export type TranslationReport = { counts: TranslationCounts; coverage: number; items: TranslationItem[] };

const TTL_MS = 30_000;
let cache: { at: number; value: Promise<TranslationReport> } | null = null;
const listeners = new Set<() => void>();

/** Every item, public and private, unfiltered: the page filters on the client. */
export function translationReport(): Promise<TranslationReport> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = fetch("/api/admin/translations?visibility=all", { headers: { Accept: "application/json" } }).then(async (res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const body = (await res.json()) as Partial<TranslationReport> & { ok?: boolean };
    if (!body || !Array.isArray(body.items) || !body.counts) throw new Error("The translations report did not come back");
    return { counts: body.counts, coverage: body.coverage ?? 0, items: body.items };
  });
  cache = { at: Date.now(), value };
  value.catch(() => {
    if (cache?.value === value) cache = null; // A failure must not be remembered.
  });
  return value;
}

/** After a save: the next read is fresh, and every open reader reloads. */
export function invalidateTranslations(): void {
  cache = null;
  for (const l of listeners) l();
}

export function useTranslationReport(): { report: TranslationReport | null; error: string | null; reload: () => void } {
  const [report, setReport] = useState<TranslationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    cache = null;
    setError(null);
    setTick((t) => t + 1);
  }, []);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    listeners.add(bump);
    return () => void listeners.delete(bump);
  }, []);
  useEffect(() => {
    let live = true;
    translationReport().then(
      (r) => live && setReport(r),
      (e: unknown) => live && setError(e instanceof Error ? e.message : "Failed to load"),
    );
    return () => {
      live = false;
    };
  }, [tick]);
  return { report, error, reload };
}

/** The item pill's status, or undefined while the report loads or failed. */
export function useTranslationStatus(): (type: TranslationType, id: string) => TranslationStatus | null | undefined {
  const { report } = useTranslationReport();
  return useCallback(
    (type: TranslationType, id: string) => {
      if (!report) return undefined;
      const hit = report.items.find((i) => i.type === type && i.id === id);
      return hit ? hit.status : null;
    },
    [report],
  );
}

/** What the nav badge counts: public units a Hebrew reader sees in English, or old Hebrew. */
export function toDo(report: TranslationReport): number {
  let n = 0;
  for (const i of report.items) if (i.visibility === "public") for (const u of i.units) if (u.status === "missing" || u.status === "stale") n += 1;
  return n;
}

/** The tab a unit counts under: unverified Hebrew is published Hebrew, so it is done. */
export type TranslationTab = "missing" | "stale" | "draft" | "done";
export const TABS: readonly TranslationTab[] = ["missing", "stale", "draft", "done"];
export function tabOf(status: TranslationStatus): TranslationTab {
  return status === "translated" || status === "unverified" ? "done" : status;
}

/** Where to edit an item, opened at one of its fields. */
export function editHref(item: TranslationItem, unit: TranslationUnit | undefined): string {
  const field = unit ? `#field=${encodeURIComponent(unit.path)}` : "";
  switch (item.type) {
    case "post":
      return `/admin/posts/${item.id}`;
    case "area":
      return `/admin/areas/${item.id}`;
    case "project":
      return `/admin/projects?project=${encodeURIComponent(item.id)}${field}`;
    case "story":
      if (item.id.startsWith("role:")) return `/admin/story?role=${encodeURIComponent(item.id.slice(5))}${field}`;
      return `/admin/story${unit ? `#field=${encodeURIComponent(item.id === "start" ? `start.${unit.path}` : unit.path)}` : ""}`;
    case "site-copy":
      return `/admin/site-copy${unit ? `#field=${encodeURIComponent(`${item.id}.${unit.path}`)}` : ""}`;
  }
}
