import { env } from "../../env.js";

/*
 * The remote MCP server's fixed numbers and URLs (#263). Everything is read
 * from `env` at call time, not import time, so a test can switch SITE_URL or
 * MCP_REMOTE without reloading the module graph.
 */

export const SCOPES = ["mcp:read", "mcp:write"] as const;
export type Scope = (typeof SCOPES)[number];

export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_MS = 30 * 86_400_000;
export const CODE_TTL_MS = 5 * 60_000;
export const TXN_TTL_MS = 10 * 60_000;
/* A registered client that never completed a sign-in, and one that stopped being used. */
export const CLIENT_UNUSED_TTL_MS = 86_400_000;
export const CLIENT_IDLE_TTL_MS = 30 * 86_400_000;
/* Live registrations at once; the rate limit is per address, this is for everybody. */
export const MAX_CLIENTS = 200;

/* Binds a sign-in in flight to the browser that started it. */
export const TXN_COOKIE = "mcp_txn";

/** The issuer: the site's origin, no path, no trailing slash. */
export const issuer = () => new URL(env.SITE_URL).origin;
/** The protected resource, and the audience every access token is bound to (RFC 8707). */
export const resourceUrl = () => `${issuer()}/mcp`;
export const prmUrl = () => `${issuer()}/.well-known/oauth-protected-resource/mcp`;
export const githubCallbackUrl = () => `${issuer()}/mcp/oauth/github/callback`;
export const docsUrl = () => `${issuer()}/developers/mcp`;
export const cookieSecure = () => new URL(env.SITE_URL).protocol === "https:";

/* One trailing slash and a fragment aside, the same resource. */
export function sameResource(a: string, b: string) {
  const norm = (v: string) => v.split("#")[0].replace(/\/$/, "");
  return norm(a) === norm(b);
}
