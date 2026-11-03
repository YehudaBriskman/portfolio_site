import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Scoped API tokens for automation (#252), the pure half.
 *
 * Nothing here touches the store or `env`, so the CLI in
 * scripts/api-token.ts can import it without a full API configuration.
 *
 *   ptk_<id>_<secret>
 *
 * `id` is 16 hex characters and names the stored document (`apitoken:<id>`),
 * so a presented token is looked up by key rather than by scanning hashes.
 * `secret` is 32 random bytes, base64url. Only SHA-256 of the WHOLE token is
 * stored: the secret is high-entropy, so a slow password hash buys nothing,
 * and a leaked database row cannot be replayed.
 */
export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/* Every token expires. 30 days unless asked otherwise, never more than 90. */
export const TOKEN_TTL_DAYS_DEFAULT = 30;
export const TOKEN_TTL_DAYS_MAX = 90;

const TOKEN_RE = /^ptk_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;

export type StoredToken = {
  _id: string;
  _rev?: string;
  type: "apitoken";
  id: string;
  name: string;
  scope: TokenScope;
  hash: string;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
};

export const tokenDocId = (id: string) => `apitoken:${id}`;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The id a well-formed token names, or null for anything else. */
export function parseToken(token: string): { id: string } | null {
  const m = TOKEN_RE.exec(token);
  return m ? { id: m[1] } : null;
}

/*
 * The same shape under another prefix, for the remote MCP server's OAuth
 * tokens (#263): `mat_` access, `mrt_` refresh, `mac_` authorization codes.
 * `id` names the stored document; pass one to mint a fresh secret for an
 * existing document (a grant's next access token).
 */
export function mintToken(prefix: string, id = randomBytes(8).toString("hex")) {
  const token = `${prefix}_${id}_${randomBytes(32).toString("base64url")}`;
  return { id, token, hash: hashToken(token) };
}

/** The id a well-formed `<prefix>_` token names, or null. */
export function parsePrefixedToken(prefix: string, token: string): { id: string } | null {
  if (!/^[a-z]{3}$/.test(prefix) || !token.startsWith(`${prefix}_`)) return null;
  return parseToken(`ptk${token.slice(prefix.length)}`);
}

export function generateToken(): { id: string; token: string; hash: string } {
  return mintToken("ptk");
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newTokenDoc(
  input: { name: string; scope: TokenScope; createdBy: string; ttlDays?: number },
  now = new Date(),
) {
  const ttl = input.ttlDays ?? TOKEN_TTL_DAYS_DEFAULT;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > TOKEN_TTL_DAYS_MAX) {
    throw new RangeError(`ttlDays must be a whole number from 1 to ${TOKEN_TTL_DAYS_MAX}`);
  }
  const { id, token, hash } = generateToken();
  const doc: StoredToken = {
    _id: tokenDocId(id),
    type: "apitoken",
    id,
    name: input.name,
    scope: input.scope,
    hash,
    createdAt: now.toISOString(),
    createdBy: input.createdBy,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + ttl * 86_400_000).toISOString(),
    lastUsedAt: null,
  };
  return { token, doc };
}

/** Usable now: not revoked, and an expiry that exists and is in the future. */
export function tokenIsLive(t: StoredToken, now = new Date()): boolean {
  if (t.revokedAt) return false;
  const exp = Date.parse(t.expiresAt ?? "");
  return Number.isFinite(exp) && exp > now.getTime();
}

/** What a listing may show: never the hash. */
export function publicToken(t: StoredToken) {
  return {
    id: t.id,
    name: t.name,
    scope: t.scope,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    expiresAt: t.expiresAt ?? null,
    lastUsedAt: t.lastUsedAt ?? null,
    revokedAt: t.revokedAt,
  };
}
