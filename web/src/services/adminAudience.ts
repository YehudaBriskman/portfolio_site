import { ContentInvalidError, type Issue } from "./adminContent";

/*
 * The owner's audience (/api/admin/audience): groups, contacts, imports and
 * the suppression list. Relative paths so a request stays on the gated
 * origin. Addresses only ever travel in request bodies and the response, never
 * in a URL: contacts are addressed by their hash. Everything a contact says
 * (name, note) arrives as plain text and is shown as text.
 *
 * Response shapes are read tolerantly (`items` or the plural noun, `hash` or
 * `id`) so a small difference in the server's envelope does not blank the tab.
 */

export type ContactStatus = "pending" | "active" | "unsubscribed" | "suppressed";
export const CONTACT_STATUSES: readonly ContactStatus[] = ["pending", "active", "unsubscribed", "suppressed"];
export type ContactSource = "site" | "manual" | "import";
export type ContactLang = "en" | "he";
export type Topics = { blog: boolean; releases: boolean };

export type Group = { slug: string; name: string; kind: "system" | "manual"; count: number };

export type Contact = {
  hash: string;
  email: string;
  name?: string;
  lang: ContactLang;
  groups: string[];
  status: ContactStatus;
  source: ContactSource;
  consentAt: string;
  consentNote: string;
  topics: Topics;
  createdAt?: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
};

export type ContactPage = { items: Contact[]; nextCursor: string | null };
export type ContactQuery = { group?: string; status?: ContactStatus | ""; q?: string; limit?: number; cursor?: string | null };
export type ContactPatch = Partial<Pick<Contact, "name" | "lang" | "groups" | "topics" | "status">>;
export type NewContact = { email: string; name?: string; lang: ContactLang; groups: string[]; consentNote: string };
export type ImportInput = { csv: string; consentNote: string; consentConfirmed: true; group?: string };
export type ImportResult = { added: number; skipped: number; invalid: Array<{ row?: number; value?: string; reason?: string } | string> };
export type Suppressed = { hash: string; email?: string; at?: string };

export const EXPORT_URL = "/api/admin/audience/contacts/export.csv";

type Json = Record<string, unknown>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/audience${path}`, {
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
  if (res.status === 400) {
    const raw = (body as { issues?: unknown } | null)?.issues;
    const issues: Issue[] = Array.isArray(raw) ? (raw as Issue[]) : [];
    throw new ContentInvalidError("invalid", issues);
  }
  if (!res.ok) throw new Error(`status-${res.status}`);
  return body as T;
}

const enc = encodeURIComponent;
const list = <T>(b: unknown, ...keys: string[]): T[] => {
  const o = (b ?? {}) as Json;
  for (const k of ["items", ...keys]) if (Array.isArray(o[k])) return o[k] as T[];
  return [];
};
const toContact = (c: Json): Contact => ({
  ...(c as unknown as Contact),
  hash: String(c.hash ?? c.id ?? ""),
  groups: Array.isArray(c.groups) ? (c.groups as string[]) : [],
  topics: { blog: true, releases: true, ...((c.topics as Partial<Topics>) ?? {}) },
});

export const adminAudience = {
  groups: async (): Promise<Group[]> => list<Group>(await call<unknown>("/groups"), "groups"),
  createGroup: (name: string) => call<unknown>("/groups", { method: "POST", body: JSON.stringify({ name }) }),
  renameGroup: (slug: string, name: string) => call<unknown>(`/groups/${enc(slug)}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteGroup: (slug: string) => call<unknown>(`/groups/${enc(slug)}`, { method: "DELETE" }),

  contacts: async (q: ContactQuery = {}): Promise<ContactPage> => {
    const p = new URLSearchParams();
    if (q.group) p.set("group", q.group);
    if (q.status) p.set("status", q.status);
    if (q.q) p.set("q", q.q);
    p.set("limit", String(q.limit ?? 25));
    if (q.cursor) p.set("cursor", q.cursor);
    const b = await call<Json>(`/contacts?${p}`);
    const next = b?.nextCursor ?? b?.cursor ?? null;
    return { items: list<Json>(b, "contacts").map(toContact), nextCursor: typeof next === "string" && next ? next : null };
  },
  addContact: (c: NewContact) => call<unknown>("/contacts", { method: "POST", body: JSON.stringify(c) }),
  patchContact: (hash: string, p: ContactPatch) => call<unknown>(`/contacts/${enc(hash)}`, { method: "PATCH", body: JSON.stringify(p) }),
  /** Hard delete: the contact's record is erased, not hidden. */
  eraseContact: (hash: string) => call<unknown>(`/contacts/${enc(hash)}`, { method: "DELETE" }),
  importCsv: async (i: ImportInput): Promise<ImportResult> => {
    const b = await call<Partial<ImportResult>>("/contacts/import", { method: "POST", body: JSON.stringify(i) });
    return { added: b.added ?? 0, skipped: b.skipped ?? 0, invalid: Array.isArray(b.invalid) ? b.invalid : [] };
  },

  suppression: async (): Promise<Suppressed[]> => list<Suppressed>(await call<unknown>("/suppression"), "suppression", "suppressed"),
  suppress: (email: string) => call<unknown>("/suppression", { method: "POST", body: JSON.stringify({ email }) }),
  unsuppress: (hash: string) => call<unknown>(`/suppression/${enc(hash)}`, { method: "DELETE" }),
};
