import { useEffect, useState } from "react";
import { adminAnnounce, type AnnounceSummary, type PreviewIssue } from "@/services/adminAnnounce";

/*
 * What is wrong with the page a link points at, per event, read from the
 * server's preview. The inbox asks for each row once, a few at a time, so a
 * long inbox does not open a long burst of requests.
 */
export type Readiness = { state: "loading" } | { state: "failed" } | { state: "ready"; issues: PreviewIssue[] };

const cache = new Map<string, Readiness>();
const CONCURRENCY = 3;

export const ISSUE_ORDER: PreviewIssue["code"][] = [
  "title-missing",
  "description-missing",
  "image-missing",
  "title-long",
  "description-long",
  "image-size",
  "no-hebrew-translation",
];
export const sortIssues = (list: PreviewIssue[]) =>
  [...list].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1) || ISSUE_ORDER.indexOf(a.code) - ISSUE_ORDER.indexOf(b.code));

/** A 422 means the event has no page of its own (a custom one): nothing to fix there. */
export function useReadiness(items: AnnounceSummary[] | null, stamp: unknown = 0): Record<string, Readiness> {
  const [, setTick] = useState(0);
  const key = items?.map((i) => i.id).join("|") ?? "";
  useEffect(() => {
    if (!items) return;
    let live = true;
    const todo = items.filter((i) => !cache.has(i.id));
    const put = (id: string, r: Readiness) => {
      cache.set(id, r);
      if (live) setTick((n) => n + 1);
    };
    let next = 0;
    const worker = async () => {
      while (live && next < todo.length) {
        const ev = todo[next++];
        try {
          const p = await adminAnnounce.preview(ev.id, "en");
          put(ev.id, { state: "ready", issues: p.issues });
        } catch (e) {
          put(ev.id, e instanceof Error && e.message === "status-422" ? { state: "ready", issues: [] } : { state: "failed" });
        }
      }
    };
    for (let i = 0; i < CONCURRENCY; i++) void worker();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stamp]);
  return Object.fromEntries((items ?? []).map((i) => [i.id, cache.get(i.id) ?? { state: "loading" as const }]));
}

/** The composer has just read this event's page: the row shows the same answer. */
export const rememberReadiness = (id: string, issues: PreviewIssue[]) => void cache.set(id, { state: "ready", issues });

export const clearReadinessCache = () => cache.clear();
