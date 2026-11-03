import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
  TemporarilyUnavailableError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { couch, CouchError } from "../../db/couch.js";
import { logger } from "../../logger.js";
import { hashToken, mintToken, parsePrefixedToken, tokenMatches } from "../../services/apiTokenFormat.js";
import { githubAuthorizeUrl, pkceChallenge } from "./github.js";
import { safeEqual, tryGet } from "./util.js";

export { safeEqual, tryGet };
import {
  ACCESS_TTL_S,
  CLIENT_IDLE_TTL_MS,
  CLIENT_UNUSED_TTL_MS,
  CODE_TTL_MS,
  MAX_CLIENTS,
  REFRESH_TTL_MS,
  SCOPES,
  TXN_COOKIE,
  TXN_TTL_MS,
  cookieSecure,
  resourceUrl,
  sameResource,
  type Scope,
} from "./config.js";

/*
 * The authorization server behind /mcp (#263), as the MCP TypeScript SDK's
 * OAuthServerProvider. The SDK's handlers do the protocol (parameter checks,
 * PKCE S256 verification against the challenge returned here, error shapes,
 * redirect_uri matching with RFC 8252's any-port loopback rule); this file
 * owns state, and every piece of it is a CouchDB document of a type the
 * public routes never select (routes/public-isolation.test.ts):
 *
 *   mcpclient:<uuid>  a dynamically registered client. Its secret, if it has
 *                     one, is stored as SHA-256 only. Expires 24 h after
 *                     registration if never used, else 30 days after last use.
 *   mcptxn:<hex>      one sign-in in flight: the client's request, and the
 *                     state and PKCE verifier sent on to GitHub. 10 minutes.
 *   mcpcode:<hex>     an authorization code, hashed. Single use, 5 minutes; a
 *                     second use revokes the grant the first one created.
 *   mcpgrant:<hex>    one connection (a row under /admin "Connected apps"):
 *                     the client, the scopes the owner chose, the current
 *                     access token(s) and refresh token, all hashed.
 *   mcpowner          the owner's numeric GitHub id, recorded on first sign-in
 *                     unless ADMIN_GITHUB_ID pins it.
 *
 * Tokens are opaque, `<prefix>_<16 hex id>_<43 random>`, the #252 format:
 * `mat_` access (1 hour), `mrt_` refresh (30 days, rotated on every use),
 * `mac_` code. The id names the document, so a presented token is a key
 * lookup and one constant-time hash compare.
 *
 * Refresh rotation with reuse detection: each refresh replaces the refresh
 * token and remembers the old one's hash. Presenting a remembered one again
 * means two parties hold it, so the whole grant is revoked.
 */

export type McpClientDoc = {
  _id: string;
  _rev?: string;
  type: "mcpclient";
  info: Omit<OAuthClientInformationFull, "client_secret">;
  secretHash: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type McpTxnDoc = {
  _id: string;
  _rev?: string;
  type: "mcptxn";
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  requestedScopes: Scope[];
  state: string | null;
  resource: string;
  githubStateHash: string;
  githubVerifier: string;
  /* Set once GitHub said who this is and they are the owner. */
  owner: { login: string; githubId: number } | null;
  csrfHash: string | null;
  createdAt: string;
  expiresAt: string;
};

type McpCodeDoc = {
  _id: string;
  _rev?: string;
  type: "mcpcode";
  hash: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: Scope[];
  resource: string;
  owner: { login: string; githubId: number };
  expiresAt: string;
  usedAt: string | null;
  grantId: string | null;
};

export type McpGrantDoc = {
  _id: string;
  _rev?: string;
  type: "mcpgrant";
  id: string;
  clientId: string;
  clientName: string;
  scopes: Scope[];
  resource: string;
  login: string;
  githubId: number;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  /* The current access token and, for an hour after a refresh, the one before. */
  access: { hash: string; expiresAt: string }[];
  refresh: { hash: string; expiresAt: string };
  usedRefresh: string[];
};

export const clientDocId = (id: string) => `mcpclient:${id}`;
export const txnDocId = (id: string) => `mcptxn:${id}`;
const codeDocId = (id: string) => `mcpcode:${id}`;
export const grantDocId = (id: string) => `mcpgrant:${id}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const USED_REFRESH_KEPT = 50;

const iso = (ms: number) => new Date(ms).toISOString();

export function clientExpired(doc: McpClientDoc, now = Date.now()) {
  return doc.lastUsedAt
    ? now - Date.parse(doc.lastUsedAt) > CLIENT_IDLE_TTL_MS
    : now - Date.parse(doc.createdAt) > CLIENT_UNUSED_TTL_MS;
}

export const grantLive = (g: McpGrantDoc, now = Date.now()) =>
  !g.revokedAt && Date.parse(g.refresh.expiresAt) > now;

/* -------------------------------------------------------------- clients -- */

/**
 * RFC 7591 registration, narrowed. Redirect URIs: https, or http on a
 * loopback host (any port, RFC 8252); nothing else, so no custom schemes and
 * no plain http to a real host. Logos and links a client claims are dropped:
 * the consent page shows only its name and where it sends the code.
 */
function checkRedirectUris(uris: string[]) {
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5) {
    throw new InvalidClientMetadataError("redirect_uris: between 1 and 5");
  }
  for (const raw of uris) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new InvalidClientMetadataError(`redirect_uri is not a URL: ${raw}`);
    }
    if (u.hash || raw.includes("#")) throw new InvalidClientMetadataError("redirect_uri must not have a fragment");
    if (u.username || u.password) throw new InvalidClientMetadataError("redirect_uri must not carry credentials");
    const ok = u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK.has(u.hostname));
    if (!ok) {
      throw new InvalidClientMetadataError("redirect_uri must be https, or http on localhost / 127.0.0.1 / [::1]");
    }
  }
}

const cleanName = (name: unknown) =>
  (typeof name === "string" ? name : "")
    // Control and bidi-override characters out: the name is shown on the
    // consent screen, and must read as what it is.
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "")
    .trim()
    .slice(0, 80) || "Unnamed client";

export const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId) {
    if (!UUID.test(clientId)) return undefined;
    const doc = await tryGet<McpClientDoc>(clientDocId(clientId));
    if (!doc || doc.type !== "mcpclient" || clientExpired(doc)) return undefined;
    // The SDK compares a presented secret with this field in plain text; the
    // secret is checked against its hash before the SDK sees the request
    // (router.ts, clientSecretGuard), so it is never handed over here.
    return { ...doc.info } as OAuthClientInformationFull;
  },

  async registerClient(registering) {
    // The SDK handler generates client_id before calling this (clientIdGeneration).
    const client = registering as OAuthClientInformationFull;
    if (!client.client_id) throw new InvalidClientMetadataError("no client_id was generated");
    checkRedirectUris(client.redirect_uris);
    const grantTypes = client.grant_types ?? ["authorization_code", "refresh_token"];
    if (!grantTypes.every((g) => g === "authorization_code" || g === "refresh_token")) {
      throw new InvalidClientMetadataError("grant_types: authorization_code and refresh_token only");
    }
    if (!(client.response_types ?? ["code"]).every((r) => r === "code")) {
      throw new InvalidClientMetadataError("response_types: code only");
    }
    // RFC 7591's default is client_secret_basic; the SDK generated a secret
    // for anything but `none`, so that is what such a client gets.
    const method = client.token_endpoint_auth_method ?? "client_secret_basic";
    if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
      throw new InvalidClientMetadataError("token_endpoint_auth_method: none, client_secret_post or client_secret_basic");
    }

    await sweep();
    const { docs } = await couch.find<McpClientDoc>({ selector: { type: "mcpclient" }, fields: ["_id", "createdAt", "lastUsedAt"], limit: MAX_CLIENTS + 1 });
    if (docs.filter((d) => !clientExpired(d as McpClientDoc)).length >= MAX_CLIENTS) {
      logger.warn({ count: docs.length }, "mcp client registration refused: too many clients");
      throw new TemporarilyUnavailableError("Registration is closed for now. Try again later.");
    }

    const secret = method === "none" ? undefined : client.client_secret;
    const info = {
      client_id: client.client_id,
      client_id_issued_at: client.client_id_issued_at,
      client_name: cleanName(client.client_name),
      redirect_uris: client.redirect_uris,
      grant_types: grantTypes,
      response_types: ["code"],
      token_endpoint_auth_method: method,
      ...(client.scope ? { scope: client.scope.split(" ").filter((s) => (SCOPES as readonly string[]).includes(s)).join(" ") } : {}),
    } as Omit<OAuthClientInformationFull, "client_secret">;
    const doc: McpClientDoc = {
      _id: clientDocId(info.client_id),
      type: "mcpclient",
      info,
      secretHash: secret ? hashToken(secret) : null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    await couch.append(doc._id, doc);
    logger.info({ clientId: info.client_id, clientName: info.client_name, method }, "mcp client registered");
    // The one time the secret is shown. Never expires on its own: the
    // client record does, when unused.
    return { ...info, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}) } as OAuthClientInformationFull;
  },
};

/** Constant-time: does `secret` match the client's stored hash? */
export async function clientSecretOk(clientId: string, secret: string | undefined): Promise<"public" | "ok" | "bad"> {
  if (!UUID.test(clientId)) return "bad";
  const doc = await tryGet<McpClientDoc>(clientDocId(clientId));
  if (!doc || doc.type !== "mcpclient" || clientExpired(doc)) return "bad";
  if (!doc.secretHash) return "public";
  return secret !== undefined && tokenMatches(secret, doc.secretHash) ? "ok" : "bad";
}

async function touchClient(clientId: string) {
  const doc = await tryGet<McpClientDoc>(clientDocId(clientId));
  if (!doc) return;
  await couch.put(doc._id, { ...doc, lastUsedAt: new Date().toISOString() }).catch(() => undefined);
}

/* ---------------------------------------------------------------- sweep -- */

/* Expired sign-ins, codes, clients and long-dead grants go, at most every ten minutes. */
let lastSweep = 0;
export async function sweep(now = Date.now()) {
  if (now - lastSweep < 10 * 60_000) return;
  lastSweep = now;
  try {
    const { docs } = await couch.find<Record<string, unknown> & { _id: string; _rev: string; type: string }>({
      selector: { type: { $in: ["mcptxn", "mcpcode", "mcpclient", "mcpgrant"] } },
      limit: 1000,
    });
    const month = 30 * 86_400_000;
    const dead = docs.filter((d) => {
      if (d.type === "mcptxn" || d.type === "mcpcode") return Date.parse(String(d.expiresAt)) < now;
      if (d.type === "mcpclient") return clientExpired(d as unknown as McpClientDoc, now);
      const g = d as unknown as McpGrantDoc;
      const end = g.revokedAt ? Date.parse(g.revokedAt) : Date.parse(g.refresh.expiresAt);
      return now - end > month;
    });
    await Promise.all(dead.map((d) => couch.del(d._id, d._rev).catch(() => undefined)));
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "mcp sweep failed");
  }
}

export function resetSweep() {
  lastSweep = 0;
}

/* --------------------------------------------------------------- grants -- */

export async function revokeGrant(grantId: string, reason: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const g = await tryGet<McpGrantDoc>(grantDocId(grantId));
    if (!g || g.type !== "mcpgrant") return null;
    if (g.revokedAt) return g;
    const next = { ...g, revokedAt: new Date().toISOString(), revokedReason: reason };
    try {
      await couch.put(g._id, next);
      logger.info({ grantId, client: g.clientName, reason }, "mcp grant revoked");
      return next;
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) continue;
      throw e;
    }
  }
  throw new Error("could not revoke grant: kept conflicting");
}

function issue(grantId: string, scopes: Scope[], now: number) {
  const access = mintToken("mat", grantId);
  const refresh = mintToken("mrt", grantId);
  return {
    access: { hash: access.hash, expiresAt: iso(now + ACCESS_TTL_S * 1000) },
    refresh: { hash: refresh.hash, expiresAt: iso(now + REFRESH_TTL_MS) },
    tokens: {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: refresh.token,
      scope: scopes.join(" "),
    } satisfies OAuthTokens,
  };
}

/* ------------------------------------------------------------- provider -- */

async function loadCode(code: string): Promise<McpCodeDoc> {
  const parsed = parsePrefixedToken("mac", code);
  const doc = parsed ? await tryGet<McpCodeDoc>(codeDocId(parsed.id)) : null;
  if (!doc || doc.type !== "mcpcode" || !tokenMatches(code, doc.hash)) throw new InvalidGrantError("Invalid authorization code");
  return doc;
}

export const provider: OAuthServerProvider = {
  clientsStore,

  /*
   * Starts a sign-in: remember the client's request, bind it to this browser
   * with a cookie, and send the browser to GitHub with a state and a PKCE
   * challenge of our own. The SDK has already checked client_id,
   * redirect_uri, response_type and code_challenge_method=S256.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    if (!S256_CHALLENGE.test(params.codeChallenge)) throw new InvalidRequestError("code_challenge must be an S256 challenge");
    const resource = params.resource ? params.resource.href : resourceUrl();
    if (!sameResource(resource, resourceUrl())) throw new InvalidTargetError("This server issues tokens for its /mcp resource only");
    // Unknown scopes are ignored (RFC 6749 §3.3 lets the server narrow).
    const requested = (params.scopes ?? []).filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
    await sweep();

    const id = randomBytes(16).toString("hex");
    const githubState = randomBytes(32).toString("base64url");
    const githubVerifier = randomBytes(32).toString("base64url");
    const now = Date.now();
    const doc: McpTxnDoc = {
      _id: txnDocId(id),
      type: "mcptxn",
      clientId: client.client_id,
      clientName: client.client_name ?? "Unnamed client",
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      requestedScopes: requested,
      state: params.state ?? null,
      resource: resourceUrl(),
      githubStateHash: hashToken(githubState),
      githubVerifier,
      owner: null,
      csrfHash: null,
      createdAt: iso(now),
      expiresAt: iso(now + TXN_TTL_MS),
    };
    await couch.append(doc._id, doc);
    res.cookie(TXN_COOKIE, id, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/mcp/oauth",
      maxAge: TXN_TTL_MS,
    });
    res.redirect(302, githubAuthorizeUrl(githubState, pkceChallenge(githubVerifier)));
  },

  async challengeForAuthorizationCode(client, code) {
    const doc = await loadCode(code);
    if (doc.clientId !== client.client_id) throw new InvalidGrantError("Invalid authorization code");
    if (doc.usedAt) {
      // RFC 6749 §4.1.2: a code used twice revokes what it issued.
      if (doc.grantId) await revokeGrant(doc.grantId, "authorization code reused");
      throw new InvalidGrantError("Authorization code already used");
    }
    return doc.codeChallenge;
  },

  async exchangeAuthorizationCode(client, code, _verifier, redirectUri, resource) {
    const doc = await loadCode(code);
    if (doc.clientId !== client.client_id || doc.usedAt) throw new InvalidGrantError("Invalid authorization code");
    if (Date.parse(doc.expiresAt) < Date.now()) throw new InvalidGrantError("Authorization code expired");
    if (redirectUri !== undefined && redirectUri !== doc.redirectUri) throw new InvalidGrantError("redirect_uri does not match");
    if (resource && !sameResource(resource.href, doc.resource)) throw new InvalidTargetError("resource does not match");

    const now = Date.now();
    const grantId = mintToken("mat").id;
    // Spend the code first, on its revision: of two concurrent exchanges one
    // gets a 409 and nothing.
    try {
      await couch.put(doc._id, { ...doc, usedAt: iso(now), grantId });
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) throw new InvalidGrantError("Authorization code already used");
      throw e;
    }
    const { access, refresh, tokens } = issue(grantId, doc.scopes, now);
    const grant: McpGrantDoc = {
      _id: grantDocId(grantId),
      type: "mcpgrant",
      id: grantId,
      clientId: client.client_id,
      clientName: doc.clientName,
      scopes: doc.scopes,
      resource: doc.resource,
      login: doc.owner.login,
      githubId: doc.owner.githubId,
      createdAt: iso(now),
      lastUsedAt: iso(now),
      revokedAt: null,
      revokedReason: null,
      access: [access],
      refresh,
      usedRefresh: [],
    };
    await couch.append(grant._id, grant);
    await touchClient(client.client_id);
    logger.info({ grantId, client: doc.clientName, scopes: doc.scopes }, "mcp grant issued");
    return tokens;
  },

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const parsed = parsePrefixedToken("mrt", refreshToken);
    // Twice at most: a grant whose lastUsedAt was written between our read
    // and our write answers 409 and is read again.
    for (let attempt = 0; attempt < 2; attempt++) {
      const g = parsed ? await tryGet<McpGrantDoc>(grantDocId(parsed.id)) : null;
      if (!g || g.type !== "mcpgrant" || g.clientId !== client.client_id || g.revokedAt) {
        throw new InvalidGrantError("Invalid refresh token");
      }
      if (!tokenMatches(refreshToken, g.refresh.hash)) {
        const presented = Buffer.from(hashToken(refreshToken), "hex");
        const reused = g.usedRefresh.some((h) => {
          const b = Buffer.from(h, "hex");
          return b.length === presented.length && timingSafeEqual(b, presented);
        });
        if (reused) {
          logger.warn({ grantId: g.id, client: g.clientName }, "mcp refresh token reused: revoking the grant");
          await revokeGrant(g.id, "refresh token reused");
        }
        throw new InvalidGrantError("Invalid refresh token");
      }
      const now = Date.now();
      if (Date.parse(g.refresh.expiresAt) < now) throw new InvalidGrantError("Refresh token expired");
      if (scopes && !scopes.every((s) => (g.scopes as string[]).includes(s))) {
        throw new InvalidScopeError("Scope exceeds what was granted");
      }
      if (resource && !sameResource(resource.href, g.resource)) throw new InvalidTargetError("resource does not match");

      const { access, refresh, tokens } = issue(g.id, g.scopes, now);
      const next: McpGrantDoc = {
        ...g,
        lastUsedAt: iso(now),
        // The previous access token keeps its hour: a client that refreshed
        // early is not cut off mid-call.
        access: [access, ...g.access.filter((a) => Date.parse(a.expiresAt) > now)].slice(0, 2),
        refresh,
        usedRefresh: [g.refresh.hash, ...g.usedRefresh].slice(0, USED_REFRESH_KEPT),
      };
      try {
        await couch.put(g._id, next);
      } catch (e) {
        if (e instanceof CouchError && e.status === 409) continue;
        throw e;
      }
      await touchClient(client.client_id);
      return tokens;
    }
    throw new InvalidGrantError("Refresh token already used");
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const parsed = parsePrefixedToken("mat", token);
    const g = parsed ? await tryGet<McpGrantDoc>(grantDocId(parsed.id)) : null;
    if (!g || g.type !== "mcpgrant" || g.revokedAt) throw new InvalidTokenError("Invalid access token");
    const now = Date.now();
    // Every entry compared, so the time taken does not say which one matched.
    let match: { hash: string; expiresAt: string } | null = null;
    for (const a of g.access) if (tokenMatches(token, a.hash)) match = a;
    if (!match) throw new InvalidTokenError("Invalid access token");
    if (Date.parse(match.expiresAt) <= now) throw new InvalidTokenError("Access token expired");
    touchGrant(g, now);
    return {
      token,
      clientId: g.clientId,
      scopes: g.scopes,
      expiresAt: Math.floor(Date.parse(match.expiresAt) / 1000),
      resource: new URL(g.resource),
      extra: { grantId: g.id, clientName: g.clientName, login: g.login },
    };
  },

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    // RFC 7009: an unknown or foreign token is answered 200 all the same.
    const parsed = parsePrefixedToken("mat", request.token) ?? parsePrefixedToken("mrt", request.token);
    const g = parsed ? await tryGet<McpGrantDoc>(grantDocId(parsed.id)) : null;
    if (!g || g.type !== "mcpgrant" || g.clientId !== client.client_id) return;
    const known = tokenMatches(request.token, g.refresh.hash) || g.access.some((a) => tokenMatches(request.token, a.hash));
    if (known) await revokeGrant(g.id, "revoked by the client");
  },
};

/* lastUsedAt on a grant: at most once a minute, off the request's path. */
const grantTouches = new Map<string, number>();
function touchGrant(g: McpGrantDoc, now: number) {
  const last = grantTouches.get(g.id) ?? Date.parse(g.lastUsedAt ?? "");
  if (Number.isFinite(last) && now - last < 60_000) return;
  grantTouches.set(g.id, now);
  couch.put(g._id, { ...g, lastUsedAt: iso(now) }).catch(() => undefined);
}

/* ---------------------------------------------------------------- codes -- */

/** After consent: a single-use code for the client, bound to its PKCE challenge. */
export async function createCode(txn: McpTxnDoc, scopes: Scope[]) {
  if (!txn.owner) throw new Error("no owner on this sign-in");
  const { id, token, hash } = mintToken("mac");
  const doc: McpCodeDoc = {
    _id: codeDocId(id),
    type: "mcpcode",
    hash,
    clientId: txn.clientId,
    clientName: txn.clientName,
    redirectUri: txn.redirectUri,
    codeChallenge: txn.codeChallenge,
    scopes,
    resource: txn.resource,
    owner: txn.owner,
    expiresAt: iso(Date.now() + CODE_TTL_MS),
    usedAt: null,
    grantId: null,
  };
  await couch.append(doc._id, doc);
  return token;
}
