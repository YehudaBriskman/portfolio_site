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

/* `total` is every contact in the group, `active` those who can be mailed; the server sends no `count`. */
export type Group = { slug: string; name: string; kind: "system" | "manual"; count: number; total?: number; active?: number };

export type ConsentEntry = {
  textId: string | null;
  textHash: string | null;
  lang?: ContactLang;
  at: string;
  confirmedAt?: string;
  source: ContactSource;
  note?: string;
};

export type Contact = {
  hash: string;
  email: string;
  name?: string | null;
  /* Absent once the person unsubscribed and their details were dropped. */
  lang?: ContactLang;
  groups: string[];
  status: ContactStatus;
  source: ContactSource;
  consentAt: string;
  consentNote: string;
  /* Newest last; `consent` is the last entry. Older servers send neither. */
  consent?: ConsentEntry;
  consentHistory?: ConsentEntry[];
  topics: Topics;
  createdAt?: string;
  confirmedAt?: string | null;
  unsubscribedAt?: string | null;
};

export type ContactPage = { items: Contact[]; nextCursor: string | null };
export type ContactQuery = { group?: string; status?: ContactStatus | ""; q?: string; limit?: number; cursor?: string | null };
export type ContactPatch = Partial<Pick<Contact, "name" | "lang" | "groups" | "topics" | "status">>;
export type NewContact = { email: string; name?: string; lang: ContactLang; groups: string[]; consentNote: string };
export type ImportInput = { csv: string; consentNote: string; consentConfirmed: true; group?: string };
export type ImportResult = { added: number; skipped: number; invalid: Array<{ row?: number; value?: string; reason?: string } | string> };
export type SuppressManyResult = { suppressed: number; already: number; failed: number; invalid: string[] };
/* `since` is when the address was suppressed (the server's field). */
export type Suppressed = { hash: string; email?: string; since?: string };

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
const toGroup = (g: Json): Group => {
  const n = g.total ?? g.count;
  return { ...(g as unknown as Group), count: typeof n === "number" ? n : 0 };
};
const toSuppressed = (s: Json): Suppressed => {
  const when = s.since ?? s.at;
  return { hash: String(s.hash ?? s.id ?? ""), ...(typeof s.email === "string" ? { email: s.email } : {}), ...(typeof when === "string" ? { since: when } : {}) };
};
const toContact = (c: Json): Contact => ({
  ...(c as unknown as Contact),
  hash: String(c.hash ?? c.id ?? ""),
  groups: Array.isArray(c.groups) ? (c.groups as string[]) : [],
  topics: { blog: true, releases: true, ...((c.topics as Partial<Topics>) ?? {}) },
});

export const adminAudience = {
  groups: async (): Promise<Group[]> => list<Json>(await call<unknown>("/groups"), "groups").map(toGroup),
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

  suppression: async (): Promise<Suppressed[]> => list<Json>(await call<unknown>("/suppression"), "suppression", "suppressed").map(toSuppressed),
  suppress: (email: string) => call<unknown>("/suppression", { method: "POST", body: JSON.stringify({ email }) }),
  /** Many addresses pasted as text (lines, commas, "Name <a@b.c>"); the server validates and reports what it could not read. */
  suppressMany: async (text: string): Promise<SuppressManyResult> => {
    const b = await call<Partial<SuppressManyResult>>("/suppression/bulk", { method: "POST", body: JSON.stringify({ text }) });
    return { suppressed: b.suppressed ?? 0, already: b.already ?? 0, failed: b.failed ?? 0, invalid: Array.isArray(b.invalid) ? b.invalid.filter((x): x is string => typeof x === "string") : [] };
  },
  unsuppress: (hash: string) => call<unknown>(`/suppression/${enc(hash)}`, { method: "DELETE" }),

  /** Whether the never-mail ledger is usable and what its guard last repaired. Counts only, never an address. */
  ledger: async (): Promise<LedgerState> => {
    const b = await call<Partial<LedgerState>>("/ledger");
    const zero = { unsubscribed: 0, suppressed: 0, erased: 0 };
    return {
      ready: b.ready === true,
      counts: { ...zero, ...(b.counts ?? {}) },
      report: b.report ? { at: b.report.at, repaired: { ...zero, ...b.report.repaired }, acknowledgedAt: b.report.acknowledgedAt ?? null } : null,
    };
  },
  /** What the scheduled sweep deleted (unconfirmed signups). Counts and times only. */
  sweep: async (): Promise<SweepState> => {
    const b = await call<Partial<SweepState>>("/sweep");
    return { pendingTtlDays: b.pendingTtlDays ?? 7, report: b.report ?? null };
  },
  /** Everything held about one address, as the parsed JSON file. The address travels in the body only. */
  exportData: (email: string) => call<unknown>("/contacts/data-export", { method: "POST", body: JSON.stringify({ email }) }),
  acknowledgeLedger: () => call<unknown>("/ledger/ack", { method: "POST", body: "{}" }),
};

export type SweepState = { pendingTtlDays: number; report: { at: string; lastPurged: number; totalPurged: number; since: string; lastMinimised?: number; totalMinimised?: number } | null };
export type LedgerCounts = { unsubscribed: number; suppressed: number; erased: number };
export type LedgerState = { ready: boolean; counts: LedgerCounts; report: { at: string; repaired: LedgerCounts; acknowledgedAt: string | null } | null };
