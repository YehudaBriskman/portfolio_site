import { env } from "../env.js";

/*
 * Minimal CouchDB client over fetch. Deliberately not a library: the whole
 * surface used here is GET/PUT/DELETE and _find, and a pure-HTTP client avoids
 * native modules, which on arm64 inside alpine is where builds go to die.
 */
const base = env.COUCHDB_URL.replace(/\/+$/, "");
const db = "portfolio_content";
const auth =
  "Basic " + Buffer.from(`${env.COUCHDB_USER}:${env.COUCHDB_PASSWORD}`).toString("base64");

export class CouchError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${db}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const couch = {
  get: <T>(id: string) => call<T>(`/${encodeURIComponent(id)}`),
  put: <T>(id: string, doc: unknown) =>
    call<T>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
  find: <T>(selector: unknown) =>
    call<{ docs: T[] }>(`/_find`, { method: "POST", body: JSON.stringify(selector) }),
  /** Creates an index if it does not already exist. Safe to call on every boot. */
  ensureIndex: (name: string, fields: unknown[]) =>
    call(`/_index`, { method: "POST", body: JSON.stringify({ index: { fields }, name, type: "json" }) })
      .catch(() => undefined),
  reachable: async () => {
    try {
      await call("/", {}, 3000);
      return true;
    } catch {
      return false;
    }
  },
};
