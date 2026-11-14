import { DEFAULT_SHARING, type SiteSettings } from "@/settings/schema";
import { ContentConflictError, ContentInvalidError, type Issue } from "./adminContent";

/*
 * The settings half of the admin API (#254). Same rules as adminContent.ts:
 * relative paths so a request stays on the gated origin, 409 is a conflict,
 * 400 carries `issues` the page places beside what they name.
 */

export type SettingsVersion = { version: number; at: string; settings: SiteSettings };

export type SettingsView = {
  ok: true;
  exists: boolean;
  _rev: string | null;
  version: number;
  updatedAt: string | null;
  settings: SiteSettings;
  history: SettingsVersion[];
};

/*
 * Settings saved before sharing templates existed (or a partial payload) have
 * no `sharing.templates`; the editors index into it, so fill what is missing
 * from the defaults rather than let the page throw.
 */
export function withSharingDefaults(settings: SiteSettings): SiteSettings {
  const s = settings as Partial<SiteSettings> | null | undefined;
  if (!s || typeof s !== "object") return settings;
  const sharing = (s.sharing ?? structuredClone(DEFAULT_SHARING)) as SiteSettings["sharing"];
  const t = (sharing.templates ?? {}) as Partial<SiteSettings["sharing"]["templates"]>;
  return { ...settings, sharing: { ...sharing, templates: { en: t.en ?? {}, he: t.he ?? {} } } };
}

function issuesOf(body: unknown): Issue[] {
  const list = (body as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(list)) return [];
  return list.flatMap((i: unknown) => {
    const { path, message } = (i ?? {}) as Record<string, unknown>;
    return typeof message === "string" ? [{ path: typeof path === "string" ? path : "", message }] : [];
  });
}

async function call(path: string, init?: RequestInit): Promise<SettingsView> {
  const res = await fetch(`/api/admin/settings${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("api-down");
  }
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 409) throw new ContentConflictError();
  if (res.status === 400) throw new ContentInvalidError("invalid", issuesOf(body));
  if (!res.ok) throw new Error(`status-${res.status}`);
  const view = body as SettingsView;
  return view && typeof view === "object" && view.settings ? { ...view, settings: withSharingDefaults(view.settings) } : view;
}

export const adminSettings = {
  get: () => call(""),
  save: (settings: SiteSettings, rev: string | null) =>
    call("", { method: "PUT", body: JSON.stringify({ settings, ...(rev ? { _rev: rev } : {}) }) }),
  revert: (version: number, rev: string | null) =>
    call("/revert", { method: "POST", body: JSON.stringify({ version, ...(rev ? { _rev: rev } : {}) }) }),
};
