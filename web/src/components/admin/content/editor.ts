import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ZodType } from "zod";
import { toIssues, type ContentKey } from "@/content/schema";
import {
  adminContent,
  ContentConflictError,
  ContentInvalidError,
  type ContentView,
  type Issue,
} from "@/services/adminContent";
import type { SaveState } from "@/components/admin/StatusPill";

/*
 * The state of one content editor (#163): the document as the server holds
 * it, the working copy, and the issues against it.
 *
 * The working copy is edited by mutating a clone (`edit`), which keeps the
 * deep paths these forms write to (`items.3.decisions.1.body.he`) one line
 * each. Every check the server makes is made here first with the same schema
 * (`content/schema.ts` is a tested copy of the backend's), so a mistake is
 * named next to its field before a request is sent; the server's answer, for
 * the rules that span documents, lands in the same place.
 */

export type Issues = ReadonlyMap<string, string>;

/** The issues by path, for the fields to look themselves up in. */
export const IssuesContext = createContext<Issues>(new Map());

export function useIssue(path: string): string | undefined {
  return useContext(IssuesContext).get(path);
}

const issueMap = (issues: Issue[]): Issues => {
  const map = new Map<string, string>();
  for (const i of issues) if (!map.has(i.path)) map.set(i.path, i.message);
  return map;
};

const countLabel = (n: number) => (n === 1 ? "1 field needs attention" : `${n} fields need attention`);

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function useContentEditor<T>(key: ContentKey, schema: ZodType<T>) {
  const [view, setView] = useState<ContentView<T> | null>(null);
  const [value, setValue] = useState<T | null>(null);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;
    adminContent
      .get<T>(key)
      .then((v) => {
        if (!live) return;
        setView(v);
        setValue(v.draft ?? v.published);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (live) setLoadError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [key, generation]);

  /** Re-read the document from the server, dropping unsaved edits. */
  const reload = useCallback(() => {
    setState({ kind: "idle" });
    setIssues([]);
    setGeneration((g) => g + 1);
  }, []);

  const edit = useCallback((change: (draft: T) => void) => {
    setValue((prev) => {
      if (prev === null) return prev;
      const next = structuredClone(prev);
      change(next);
      return next;
    });
    setState({ kind: "dirty" });
  }, []);

  /** The schema's verdict on the working copy, or null with the issues shown. */
  const check = (): T | null => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    const found = toIssues(parsed.error);
    setIssues(found);
    setState({ kind: "invalid", message: countLabel(found.length) });
    return null;
  };

  const run = async (send: (data: T, rev: string | null) => Promise<ContentView<T>>) => {
    const data = check();
    if (data === null) return;
    setState({ kind: "saving" });
    try {
      const next = await send(data, view?._rev ?? null);
      setView(next);
      setValue(next.draft ?? next.published);
      setIssues([]);
      setState({ kind: "saved", at: new Date() });
    } catch (e) {
      if (e instanceof ContentInvalidError) {
        setIssues(e.issues);
        setState({ kind: "invalid", message: e.issues.length ? countLabel(e.issues.length) : e.message });
      } else if (e instanceof ContentConflictError) {
        setState({ kind: "conflict" });
      } else {
        setState({ kind: "failed", message: messageOf(e) });
      }
    }
  };

  const saveDraft = () => run((data, rev) => adminContent.saveDraft(key, data, rev));
  const publish = () => run((data, rev) => adminContent.publish(key, data, rev));

  const discard = async () => {
    setState({ kind: "saving" });
    try {
      const next = await adminContent.discardDraft<T>(key, view?._rev ?? null);
      setView(next);
      setValue(next.published);
      setIssues([]);
      setState({ kind: "idle" });
    } catch (e) {
      setState(e instanceof ContentConflictError ? { kind: "conflict" } : { kind: "failed", message: messageOf(e) });
    }
  };

  const seed = async () => {
    setState({ kind: "saving" });
    try {
      await adminContent.seed();
      reload();
    } catch (e) {
      setState({ kind: "failed", message: messageOf(e) });
    }
  };

  return {
    view,
    value,
    state,
    issues,
    issueMap: issueMap(issues),
    loadError,
    edit,
    saveDraft,
    publish,
    discard,
    seed,
    reload,
  };
}

export type ContentEditor<T> = ReturnType<typeof useContentEditor<T>>;
