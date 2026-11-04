import type { ContentKey } from "@/content/schema";
import { invalidateTranslations } from "./translations";

/*
 * The content editors' half of the admin API (#163): one document per key,
 * holding what the site serves and, optionally, a draft beside it.
 *
 * Kept apart from `services/admin.ts` so the posts editor's client, and the
 * auth around it, are untouched. Same rules: relative paths, so a request
 * stays on the gated origin, and a body that is not JSON is reported as the
 * API being down rather than as a parse error.
 */

export type ContentView<T> = {
  ok: true;
  key: ContentKey;
  exists: boolean;
  _rev: string | null;
  published: T;
  draft: T | null;
  updatedAt: string | null;
  publishedAt: string | null;
  source: "seed" | "admin" | null;
};

export type Issue = { path: string; message: string };

/** A 400 the editor can show next to the fields it names. */
export class ContentInvalidError extends Error {
  readonly issues: Issue[];
  constructor(message: string, issues: Issue[]) {
    super(message);
    this.name = "ContentInvalidError";
    this.issues = issues;
  }
}

/** A 409: someone else saved first. */
export class ContentConflictError extends Error {
  constructor() {
    super("Changed elsewhere. Reload to see the newer version.");
    this.name = "ContentConflictError";
  }
}

type ErrorBody = { error?: unknown; issues?: unknown };

function issuesOf(body: ErrorBody | null): Issue[] {
  if (!body || !Array.isArray(body.issues)) return [];
  return body.issues.flatMap((i: unknown) => {
    if (typeof i !== "object" || i === null) return [];
    const { path, message } = i as Record<string, unknown>;
    return typeof message === "string" ? [{ path: typeof path === "string" ? path : "", message }] : [];
  });
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The admin API did not respond. It may be restarting.");
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/content${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = parse(text);
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 409) throw new ContentConflictError();
  if (!res.ok) {
    const b = (typeof body === "object" && body !== null ? body : null) as ErrorBody | null;
    const message = typeof b?.error === "string" ? b.error : `Request failed (${res.status})`;
    if (res.status === 400) throw new ContentInvalidError(message, issuesOf(b));
    throw new Error(message);
  }
  /* A write changes what is translated: the Hebrew pills read again. */
  if (init?.method && init.method !== "GET") invalidateTranslations();
  return body as T;
}

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });

export const adminContent = {
  get: <T>(key: ContentKey) => call<ContentView<T>>(`/${key}`),
  saveDraft: <T>(key: ContentKey, data: T, rev: string | null) =>
    call<ContentView<T>>(`/${key}/draft`, { method: "PUT", ...json({ data, _rev: rev ?? undefined }) }),
  publish: <T>(key: ContentKey, data: T, rev: string | null) =>
    call<ContentView<T>>(`/${key}/publish`, { method: "POST", ...json({ data, _rev: rev ?? undefined }) }),
  discardDraft: <T>(key: ContentKey, rev: string | null) =>
    call<ContentView<T>>(`/${key}/draft?rev=${encodeURIComponent(rev ?? "")}`, { method: "DELETE" }),
  seed: () => call<{ ok: true; created: ContentKey[]; kept: ContentKey[] }>("/seed", { method: "POST" }),
};
