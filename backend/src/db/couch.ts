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

/** The store address, database and credential, shared with the binary client in attachments.ts. */
export const couchConfig = { base, db, auth };

/*
 * Every failure of the store, answered or not.
 *
 * `status` is CouchDB's own status when it answered, and 0 when it did not —
 * connection refused, a name that does not resolve, or the timeout below
 * aborting the request. Those used to escape as fetch's bare TypeError or
 * AbortError, which the error handler could not tell from a bug in the API and
 * answered with 500. An unreachable store is the same fault as a store that
 * answers 5xx — upstream of us — so it is the same class and gets the same 502
 * (#131). 0 is safe for the callers that branch on status: they look for 404
 * and 412, which an unreachable store can never be.
 */
export class CouchError extends Error {
  /* `cause` is a field rather than ES2022's `Error` option because this
     package's lib target predates it; pino's serializer reads it either way. */
  constructor(readonly status: number, message: string, readonly cause?: unknown) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/${db}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (cause) {
      throw new CouchError(0, `couch unreachable on ${path}`, cause);
    }
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on ${path}`);
    try {
      return (await res.json()) as T;
    } catch (cause) {
      // A 200 that is not JSON is a proxy or gateway answering for the store:
      // upstream's fault, so the same 502 class as an unreachable store.
      throw new CouchError(0, `couch returned a non-JSON body on ${path}`, cause);
    }
  } finally {
    clearTimeout(t);
  }
}

export const couch = {
  get: <T>(id: string) => call<T>(`/${encodeURIComponent(id)}`),
  put: <T>(id: string, doc: unknown) =>
    call<T>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
  /*
   * Create-only: a document written without a `_rev` can only be created, and
   * CouchDB answers 409 if the id exists. Separate from `put` so the audit log
   * (services/audit.ts) cannot be pointed at an existing document by mistake.
   */
  append: <T>(id: string, doc: Record<string, unknown>) => {
    const { _rev: _ignored, ...fresh } = doc;
    return call<T>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(fresh) });
  },
  /* Deletes one revision; 409 if the document moved on, 404 if it is gone. */
  del: (id: string, rev: string) =>
    call<{ ok: boolean }>(`/${encodeURIComponent(id)}?rev=${encodeURIComponent(rev)}`, { method: "DELETE" }),
  find: <T>(selector: unknown) =>
    call<{ docs: T[] }>(`/_find`, { method: "POST", body: JSON.stringify(selector) }),
  /*
   * Creates the content database if it is missing.
   *
   * DECISION: the API ensures its database exists at boot — and only its
   * database, never its content. Recorded here because the question will come
   * back on the next namespace.
   *
   * The case against is real. Implicit creation can paper over a
   * misconfiguration: point COUCHDB_URL at the wrong server and a booting API
   * will cheerfully create `portfolio_content` there and look perfectly
   * healthy, where a missing database at least fails. This project has already
   * written to the wrong store once, by running the seed script carelessly, so
   * that is not a hypothetical. Creating a database also needs a server-admin
   * credential in CouchDB 3, which is a wider privilege than reading and
   * writing documents.
   *
   * It is still the right trade, for one reason that outweighs those: the name
   * is hardcoded three lines up. `portfolio_content` is not configuration, it
   * is a constant in this application — and an application that owns a name
   * but refuses to create it leaves every fresh environment in a state only a
   * human holding a runbook can get it out of. Preprod sat exactly there: zero
   * databases, every content read a 404, and the SPA fallback reporting all of
   * it as 200. Nothing about that was going to be different the next time a
   * namespace was created.
   *
   * The misconfiguration risk is answered where it actually lives rather than
   * by declining to bootstrap: the URL and the credential are per-environment
   * secrets, and preprod's cannot reach the production store at all.
   *
   * What this deliberately does not do is create documents. A database that
   * exists and is empty is an honest, distinguishable state, and `make smoke`
   * asserts on a real /api/ body so an unseeded environment announces itself
   * instead of hiding behind a 200.
   */
  ensureDatabase: async (): Promise<void> => {
    try {
      await call<{ ok: boolean }>("", { method: "PUT" });
    } catch (err) {
      // 412 is CouchDB's `file_exists`, which is the answer on every boot
      // after the first and the whole point of calling this unconditionally.
      // Anything else — 401, 403, a timeout — is a real failure and the
      // caller must be allowed to say so out loud.
      if (err instanceof CouchError && err.status === 412) return;
      throw err;
    }
  },
  /**
   * Creates an index if it does not already exist. Safe to call on every boot:
   * CouchDB answers 200 `result: "exists"` for one already there. Every other
   * failure (401, 403, 5xx) propagates so the caller cannot log success.
   */
  ensureIndex: async (name: string, fields: unknown[]): Promise<void> => {
    await call(`/_index`, { method: "POST", body: JSON.stringify({ index: { fields }, name, type: "json" }) });
  },
  reachable: async () => {
    try {
      await call("/", {}, 3000);
      return true;
    } catch {
      return false;
    }
  },
};

/** The document, or null when it does not exist; any other failure still throws. */
export async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}
