/*
 * A thin client for the site's HTTP API. Every endpoint answers
 * `{ ok: true, ... }` or `{ ok: false, error }`; a non-2xx becomes ApiError
 * with the server's own message, so a tool can repeat it verbatim.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type Query = Record<string, string | number | undefined>;

export class PortfolioApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  get hasToken() {
    return this.token !== null;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      query?: Query;
      body?: unknown;
      raw?: { data: Uint8Array; type: string };
      /* multipart/form-data; fetch writes the Content-Type with its boundary. */
      form?: FormData;
      admin?: boolean;
      timeoutMs?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== "") qs.set(k, String(v));
    const url = `${this.baseUrl}${path}${qs.size ? `?${qs}` : ""}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.raw) headers["Content-Type"] = opts.raw.type;
    if (opts.admin) {
      if (!this.token) throw new ApiError(401, "No PORTFOLIO_ADMIN_TOKEN is configured.");
      headers.Authorization = `Bearer ${this.token}`;
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: opts.form ?? (opts.raw ? opts.raw.data : opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
    } catch (e) {
      throw new ApiError(0, `Could not reach ${this.baseUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON: the status speaks for itself */
    }
    if (!res.ok) {
      const msg = (body as { error?: unknown } | null)?.error;
      throw new ApiError(res.status, typeof msg === "string" ? msg : `HTTP ${res.status}`);
    }
    return body as T;
  }

  /* Public. */
  get<T>(path: string, query?: Query) {
    return this.request<T>("GET", path, { query });
  }

  /* Authenticated with the admin token. */
  adminGet<T>(path: string, query?: Query) {
    return this.request<T>("GET", path, { query, admin: true });
  }
  adminSend<T>(method: "PUT" | "POST" | "DELETE", path: string, body?: unknown) {
    return this.request<T>(method, path, { body, admin: true });
  }
  /* Raw bytes as the body (a media upload); the server makes its variants
     before it answers, so this waits longer than a JSON write. */
  adminUpload<T>(path: string, query: Query, data: Uint8Array, type: string) {
    return this.request<T>("POST", path, { query, raw: { data, type }, admin: true, timeoutMs: 120_000 });
  }

  /** A video with its poster (and captions): the one upload that is several files. */
  adminUploadForm<T>(path: string, query: Query, form: FormData) {
    return this.request<T>("POST", path, { query, form, admin: true, timeoutMs: 180_000 });
  }
}
