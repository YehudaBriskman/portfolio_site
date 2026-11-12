/*
 * The public subscription API (contract: POST /api/subscribe, GET
 * /api/subscribe/confirm, POST /api/subscribe/unsubscribe, GET and PUT
 * /api/subscribe/manage).
 *
 * Two rules the callers rely on. The signup answers the same 202 whether or
 * not the address is known or suppressed, so this never reports which: a
 * failure here is a network or rate-limit failure, never "already subscribed".
 * And a token is sent in the query or body of the request and never put in a
 * message shown to the reader.
 */

export type SubscribeLang = "en" | "he";
export type Topics = { blog: boolean; releases: boolean };

/** Why a call failed, as the pages need to tell it: a reader can act on only these. */
export type SubscribeFailure = "invalid" | "rate" | "network" | "server";

export class SubscribeError extends Error {
  constructor(readonly kind: SubscribeFailure) {
    super(kind);
    this.name = "SubscribeError";
  }
}

async function call(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new SubscribeError("network");
  }
  if (!res.ok) {
    if (res.status === 429) throw new SubscribeError("rate");
    if (res.status >= 400 && res.status < 500) throw new SubscribeError("invalid");
    throw new SubscribeError("server");
  }
  return res.json().catch(() => ({}));
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type SignupInput = {
  email: string;
  name?: string;
  lang: SubscribeLang;
  topics: Topics;
  /** The honeypot: a person leaves it empty, a form-filling bot does not. */
  website: string;
};

export async function subscribe(input: SignupInput): Promise<void> {
  const body: Record<string, unknown> = {
    email: input.email.trim(),
    lang: input.lang,
    topics: input.topics,
    website: input.website,
  };
  if (input.name?.trim()) body.name = input.name.trim();
  await call("/api/subscribe", json("POST", body));
}

export async function confirmSubscription(token: string): Promise<{ lang: SubscribeLang | null }> {
  const r = (await call(`/api/subscribe/confirm?token=${encodeURIComponent(token)}`)) as { lang?: string };
  return { lang: r.lang === "he" || r.lang === "en" ? r.lang : null };
}

export async function unsubscribe(token: string): Promise<void> {
  await call("/api/subscribe/unsubscribe", json("POST", { token }));
}

export type Preferences = { email: string; lang: SubscribeLang; topics: Topics; status: string };

export async function getPreferences(token: string): Promise<Preferences> {
  const r = (await call(`/api/subscribe/manage?token=${encodeURIComponent(token)}`)) as Partial<Preferences>;
  return {
    email: typeof r.email === "string" ? r.email : "",
    lang: r.lang === "he" ? "he" : "en",
    topics: { blog: r.topics?.blog === true, releases: r.topics?.releases === true },
    status: typeof r.status === "string" ? r.status : "",
  };
}

export async function savePreferences(token: string, prefs: { lang: SubscribeLang; topics: Topics }): Promise<void> {
  await call("/api/subscribe/manage", json("PUT", { token, lang: prefs.lang, topics: prefs.topics }));
}

/** The address looks like one. The server decides for real; this only saves a round trip. */
export const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
