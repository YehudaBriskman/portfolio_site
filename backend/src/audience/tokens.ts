import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";

/*
 * Signed links: base64url(JSON payload) "." base64url(HMAC-SHA256).
 * The payload carries a contact HASH, never an address.
 * Secret: SUBSCRIBE_SECRET if set, else one generated on first use and kept in
 * the admin-only doc `secret:subscribe`. No route returns that doc.
 */

export const SECRET_DOC = "secret:subscribe";
export const TOKEN_KINDS = ["confirm", "unsub", "manage"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];
export type TokenPayload = { t: TokenKind; h: string; exp: number };

const Payload = z.object({ t: z.enum(TOKEN_KINDS), h: z.string().regex(/^[a-f0-9]{32}$/), exp: z.number().int() }).strict();

let cached: string | null = null;
/** Forget the cached secret (tests, and a future "rotate"). */
export const resetSecretCache = () => { cached = null; };

async function secret(): Promise<string> {
  if (env.SUBSCRIBE_SECRET) return env.SUBSCRIBE_SECRET;
  if (cached) return cached;
  const read = async () => (await couch.get<{ secret: string }>(SECRET_DOC)).secret;
  try {
    cached = await read();
  } catch (e) {
    if (!(e instanceof CouchError) || e.status !== 404) throw e;
    try {
      const fresh = randomBytes(32).toString("base64url");
      await couch.append(SECRET_DOC, { type: "secret", secret: fresh, createdAt: new Date().toISOString() });
      cached = fresh;
    } catch (e2) {
      // Another process created it first: use theirs.
      if (!(e2 instanceof CouchError) || e2.status !== 409) throw e2;
      cached = await read();
    }
  }
  return cached;
}

const mac = (key: string, body: string) => createHmac("sha256", key).update(body).digest();

export const expiresIn = (seconds: number, now = Date.now()) => Math.floor(now / 1000) + Math.floor(seconds);

export async function signToken(p: TokenPayload): Promise<string> {
  const body = Buffer.from(JSON.stringify({ t: p.t, h: p.h, exp: p.exp })).toString("base64url");
  return `${body}.${mac(await secret(), body).toString("base64url")}`;
}

/** The payload when the signature is genuine, the kind matches and it has not expired; else null (one answer for every failure). */
export async function verifyToken(token: string, kind: TokenKind, now = Date.now()): Promise<TokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const given = Buffer.from(parts[1], "base64url");
  const want = mac(await secret(), parts[0]);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  let parsed: z.infer<typeof Payload>;
  try {
    parsed = Payload.parse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
  } catch {
    return null;
  }
  if (parsed.t !== kind || parsed.exp * 1000 <= now) return null;
  return parsed;
}
