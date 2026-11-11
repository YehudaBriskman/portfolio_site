import { randomBytes } from "node:crypto";
import cors from "cors";
import express, { type Express, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import type { Admin } from "../middlewares/requireAdmin.js";
import { hashToken, tokenMatches } from "../services/apiTokenFormat.js";
import { INTERNAL_BASE, internalFetch } from "./internal.js";
import {
  SCOPES,
  TXN_COOKIE,
  cookieSecure,
  docsUrl,
  issuer,
  prmUrl,
  resourceUrl,
  type Scope,
} from "./oauth/config.js";
import { GithubError, githubIdentity, isOwner } from "./oauth/github.js";
import { consentPage, errorPage, notAuthorizedPage, returnToClientPage } from "./oauth/pages.js";
import { clientSecretOk, createCode, provider, txnDocId, type McpTxnDoc } from "./oauth/provider.js";
import { safeEqual, tryGet } from "./oauth/util.js";
import { PortfolioApi } from "./shared/api.js";
import { instructionsFor, registerTools, VERSION, type ToolAccess } from "./shared/tools.js";

/*
 * The remote MCP server (#263): Streamable HTTP at /mcp, OAuth 2.1 in front
 * of it, sign-in through GitHub. What it serves:
 *
 *   POST /mcp                  the owner's server: a Bearer access token is
 *                              required (401 + WWW-Authenticate pointing at
 *                              the metadata below, which is what starts the
 *                              browser sign-in in a client). mcp:read gets
 *                              the public tools and the admin reads;
 *                              mcp:write adds the writes.
 *   POST /mcp/public           the public tools, no sign-in, nothing else.
 *   GET  /mcp, /mcp/public     a browser (Accept: text/html) is sent to the
 *                              page that explains all this; anything else
 *                              gets 405 (stateless: no SSE stream to open).
 *
 *   /.well-known/oauth-protected-resource[/mcp]   RFC 9728
 *   /.well-known/oauth-authorization-server       RFC 8414
 *   /mcp/oauth/register     RFC 7591 dynamic registration (SDK handler)
 *   /mcp/oauth/authorize    authorization code + PKCE S256 (SDK handler)
 *   /mcp/oauth/token        code and refresh grants (SDK handler)
 *   /mcp/oauth/revoke       RFC 7009 (SDK handler)
 *   /mcp/oauth/github/callback, /mcp/oauth/consent   ours: GitHub's answer,
 *                              then the owner's choice of scopes.
 *
 * MCP_REMOTE=off (the default) answers every one of those paths 404.
 *
 * Stateless: each POST builds a server, runs the request and drops it, so
 * nothing is held between calls and any replica can answer any request.
 * Tools reach this API in-process (internal.ts), so a write is validated,
 * locked and audited exactly as from the admin UI, and the audit entry says
 * `via: "mcp-oauth"` and the client's name.
 */

const AUDIT_VIA = "mcp-oauth";
const REPLACED_BY_TICKET = "replaced-by-ticket";

const PATHS = ["/mcp", "/.well-known/oauth-protected-resource", "/.well-known/oauth-authorization-server"];

const limiter = (windowMs: number, limit: number): RequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too_many_requests", error_description: "Too many requests. Try again later." },
  });

/* The SDK handlers take express-rate-limit options; theirs are looser than these. */
const sdkLimit = (windowMs: number, max: number) => ({ windowMs, max, standardHeaders: true, legacyHeaders: false });

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.header("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return safeDecode(part.slice(i + 1).trim());
  }
  return null;
}

/* Malformed percent-encoding is the client's mistake: null, never a throw (a 500). */
function safeDecode(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

const clearTxnCookie = (res: Response) =>
  res.clearCookie(TXN_COOKIE, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/mcp/oauth" });

const wantsHtml = (req: Request) => req.accepts(["application/json", "text/event-stream", "text/html"]) === "text/html";

export function protectedResourceMetadata() {
  return {
    resource: resourceUrl(),
    authorization_servers: [issuer()],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "yehudabriskman.com",
    resource_documentation: docsUrl(),
  };
}

export function authorizationServerMetadata() {
  const base = issuer();
  return {
    issuer: base,
    authorization_endpoint: `${base}/mcp/oauth/authorize`,
    token_endpoint: `${base}/mcp/oauth/token`,
    registration_endpoint: `${base}/mcp/oauth/register`,
    revocation_endpoint: `${base}/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [...SCOPES],
    service_documentation: docsUrl(),
  };
}

export function createMcpRouter(app: Express) {
  const router = express.Router();

  // The switch, judged per request so it can be flipped in a test.
  router.use(PATHS, (_req, res, next) => {
    if (env.MCP_REMOTE === "on") return next();
    res.status(404).json({ ok: false, error: "Not Found" });
  });

  /*
   * CORS, by what each endpoint is.
   *
   * Public and read-only (the /.well-known metadata and /mcp/public): any
   * origin may read them, with `*` and never credentials. They hold nothing
   * a page could not fetch through a server anyway, and a browser-based MCP
   * client needs them to discover this server.
   *
   * Authenticated (/mcp, and the token, register and revoke endpoints): a
   * fixed allowlist, never the request's Origin reflected and never `*`. The
   * clients that use these are not browsers bound to an origin: Claude Code
   * and Claude Desktop call them from a native process, where CORS does not
   * apply. The only browser clients expected are claude.ai and claude.com,
   * so only they get an Access-Control-Allow-Origin, and without
   * credentials (the token is a Bearer header, not a cookie). The SDK's own
   * handlers set `*`; restrictCors removes it for any other origin.
   *
   * authorize, the GitHub callback and consent are top-level navigations
   * and get no CORS at all.
   */
  const BROWSER_CLIENTS = ["https://claude.ai", "https://claude.com"];
  const CORS_ALLOW_HEADERS = "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID";
  const CORS_EXPOSE_HEADERS = "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version";

  const publicCors: RequestHandler = (req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": CORS_EXPOSE_HEADERS,
    });
    if (req.method !== "OPTIONS") return next();
    res
      .set({
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
        "Access-Control-Max-Age": "600",
      })
      .status(204)
      .end();
  };

  /* Pins Access-Control-Allow-Origin to the allowlist, whoever sets it. */
  const restrictCors: RequestHandler = (req, res, next) => {
    const origin = req.header("origin");
    const allowed = origin !== undefined && BROWSER_CLIENTS.includes(origin) ? origin : null;
    const setHeader = res.setHeader.bind(res);
    res.setHeader = ((name: string, value: number | string | readonly string[]) => {
      if (name.toLowerCase() === "access-control-allow-origin") {
        if (!allowed) return res;
        return setHeader(name, allowed);
      }
      if (name.toLowerCase() === "access-control-allow-credentials") return res;
      return setHeader(name, value);
    }) as typeof res.setHeader;
    res.vary("Origin");
    next();
  };

  const authCors: RequestHandler[] = [
    restrictCors,
    cors({
      origin: BROWSER_CLIENTS,
      credentials: false,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: CORS_ALLOW_HEADERS.split(", "),
      exposedHeaders: CORS_EXPOSE_HEADERS.split(", "),
      maxAge: 600,
    }),
  ];

  /* ---------------------------------------------------------- metadata -- */

  const metaLimiter = limiter(60_000, 120);
  router.get(
    ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"],
    publicCors,
    metaLimiter,
    (_req, res) => res.set("Cache-Control", "public, max-age=300").json(protectedResourceMetadata()),
  );
  router.options(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"], publicCors);
  router.get("/.well-known/oauth-authorization-server", publicCors, metaLimiter, (_req, res) =>
    res.set("Cache-Control", "public, max-age=300").json(authorizationServerMetadata()),
  );
  router.options("/.well-known/oauth-authorization-server", publicCors);

  /* ------------------------------------------------------ authorization -- */

  router.use(
    "/mcp/oauth/register",
    restrictCors,
    clientRegistrationHandler({
      clientsStore: provider.clientsStore,
      // Ten registrations an hour per address; a native client registers once.
      rateLimit: sdkLimit(60 * 60_000, 10),
      // The secret does not expire on its own; the client record does, unused.
      clientSecretExpirySeconds: 0,
    }),
  );

  router.use("/mcp/oauth/authorize", authorizationHandler({ provider, rateLimit: sdkLimit(15 * 60_000, 30) }));

  /*
   * Client authentication, before the SDK sees the request. The SDK compares
   * a client secret with the stored one in plain text; here only its SHA-256
   * is stored, and it is compared in constant time. Accepts the secret in
   * the body (client_secret_post) or as HTTP Basic, and strips it, so the
   * SDK treats the request as an authenticated public client.
   */
  const clientSecretGuard: RequestHandler = asyncHandler(async (req, res, next) => {
    if (req.method !== "POST") return next();
    const body = (req.body ?? {}) as Record<string, unknown>;
    let id = typeof body.client_id === "string" ? body.client_id : undefined;
    let secret = typeof body.client_secret === "string" ? body.client_secret : undefined;
    const basic = /^Basic\s+(\S+)$/i.exec(req.header("authorization") ?? "")?.[1];
    if (basic) {
      const decoded = Buffer.from(basic, "base64").toString("utf8");
      const i = decoded.indexOf(":");
      const bid = safeDecode(i < 0 ? decoded : decoded.slice(0, i));
      const bsecret = i < 0 ? undefined : safeDecode(decoded.slice(i + 1));
      if (bid === null || bsecret === null || (id !== undefined && id !== bid)) {
        return res.status(401).json({ error: "invalid_client", error_description: "Client authentication failed" });
      }
      id = bid;
      secret = bsecret;
    }
    if (id === undefined) return next(); // the SDK answers invalid_request
    const verdict = await clientSecretOk(id, secret);
    if (verdict === "bad") {
      return res.status(401).json({ error: "invalid_client", error_description: "Client authentication failed" });
    }
    req.body = { ...body, client_id: id };
    delete (req.body as Record<string, unknown>).client_secret;
    next();
  });
  const formBody = express.urlencoded({ extended: false, limit: "16kb" });

  router.use("/mcp/oauth/token", restrictCors, formBody, clientSecretGuard, tokenHandler({ provider, rateLimit: sdkLimit(15 * 60_000, 60) }));
  router.use("/mcp/oauth/revoke", restrictCors, formBody, clientSecretGuard, revocationHandler({ provider, rateLimit: sdkLimit(15 * 60_000, 30) }));

  const signInLimiter = limiter(15 * 60_000, 30);

  /* GitHub's answer: who signed in, and are they the owner. */
  router.get(
    "/mcp/oauth/github/callback",
    signInLimiter,
    asyncHandler(async (req, res) => {
      const txnId = readCookie(req, TXN_COOKIE);
      const txn = txnId && /^[0-9a-f]{32}$/.test(txnId) ? await tryGet<McpTxnDoc>(txnDocId(txnId)) : null;
      if (!txn || txn.type !== "mcptxn" || txn.owner || Date.parse(txn.expiresAt) < Date.now()) {
        return errorPage(res, 400, "Sign-in expired", "This sign-in expired or was already used. Start it again from your MCP client.");
      }
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!state || !tokenMatches(state, txn.githubStateHash)) {
        logger.warn({ ip: req.ip }, "mcp github callback: state mismatch");
        return errorPage(res, 400, "Sign-in refused", "The answer from GitHub does not belong to this sign-in. Start it again from your MCP client.");
      }
      if (typeof req.query.error === "string") {
        // Cancelled at GitHub: tell the client, grant nothing.
        await couch.del(txn._id, txn._rev!).catch(() => undefined);
        clearTxnCookie(res);
        const target = new URL(txn.redirectUri);
        target.searchParams.set("error", "access_denied");
        if (txn.state) target.searchParams.set("state", txn.state);
        return returnToClientPage(res, txn.clientName, target, false);
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      let user;
      try {
        user = await githubIdentity(code, txn.githubVerifier);
      } catch (e) {
        if (!(e instanceof GithubError)) throw e;
        logger.warn({ err: e.message }, "mcp github sign-in failed");
        return errorPage(res, 502, "GitHub sign-in failed", `${e.message}. Start it again from your MCP client.`);
      }
      if (!(await isOwner(user))) {
        await couch.del(txn._id, txn._rev!).catch(() => undefined);
        clearTxnCookie(res);
        logger.warn({ login: user.login, githubId: user.id, client: txn.clientName }, "mcp sign-in refused: not the owner");
        return notAuthorizedPage(res, user.login, `${issuer()}/mcp/public`);
      }
      const csrf = randomBytes(32).toString("base64url");
      try {
        await couch.put(txn._id, { ...txn, owner: { login: user.login, githubId: user.id }, csrfHash: hashToken(csrf) });
      } catch (e) {
        if (e instanceof CouchError && e.status === 409) {
          return errorPage(res, 409, "Sign-in already in progress", "This sign-in was answered twice. Start it again from your MCP client.");
        }
        throw e;
      }
      consentPage(res, {
        clientName: txn.clientName,
        redirectUri: txn.redirectUri,
        login: user.login,
        txn: txnId!,
        csrf,
        writeRequested: txn.requestedScopes.includes("mcp:write"),
      });
    }),
  );

  /*
   * The owner's choice. CSRF: a POST, carrying the transaction id that must
   * equal the HttpOnly SameSite cookie set when this browser started the
   * sign-in, and a one-time token whose hash the transaction holds; a
   * foreign Origin is refused outright. The transaction is spent here.
   */
  router.post(
    "/mcp/oauth/consent",
    signInLimiter,
    formBody,
    asyncHandler(async (req, res) => {
      const origin = req.header("origin");
      if (origin !== undefined && origin !== "null" && origin !== issuer()) {
        return errorPage(res, 403, "Refused", "This form can only be sent from this site.");
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cookieTxn = readCookie(req, TXN_COOKIE);
      const formTxn = typeof body.txn === "string" ? body.txn : "";
      if (!cookieTxn || !safeEqual(cookieTxn, formTxn) || !/^[0-9a-f]{32}$/.test(formTxn)) {
        return errorPage(res, 403, "Refused", "This consent form does not belong to this browser's sign-in. Start it again from your MCP client.");
      }
      const txn = await tryGet<McpTxnDoc>(txnDocId(formTxn));
      const csrf = typeof body.csrf === "string" ? body.csrf : "";
      if (!txn || txn.type !== "mcptxn" || !txn.owner || !txn.csrfHash || Date.parse(txn.expiresAt) < Date.now()) {
        return errorPage(res, 400, "Sign-in expired", "This sign-in expired or was already used. Start it again from your MCP client.");
      }
      if (!csrf || !tokenMatches(csrf, txn.csrfHash)) {
        return errorPage(res, 403, "Refused", "This consent form is not the one this sign-in showed.");
      }
      try {
        await couch.del(txn._id, txn._rev!);
      } catch (e) {
        if (e instanceof CouchError && (e.status === 409 || e.status === 404)) {
          return errorPage(res, 400, "Sign-in expired", "This sign-in was already answered.");
        }
        throw e;
      }
      clearTxnCookie(res);
      const target = new URL(txn.redirectUri);
      if (txn.state) target.searchParams.set("state", txn.state);
      if (body.decision !== "approve") {
        target.searchParams.set("error", "access_denied");
        logger.info({ client: txn.clientName }, "mcp consent denied");
        return returnToClientPage(res, txn.clientName, target, false);
      }
      const scopes: Scope[] = body.write === "on" ? ["mcp:read", "mcp:write"] : ["mcp:read"];
      target.searchParams.set("code", await createCode(txn, scopes));
      logger.info({ client: txn.clientName, scopes }, "mcp consent granted");
      returnToClientPage(res, txn.clientName, target, true);
    }),
  );

  /* --------------------------------------------------------------- MCP -- */

  async function serve(req: Request, res: Response, access: ToolAccess, admin: Admin | null) {
    const server = new McpServer({ name: "yehudabriskman.com", version: VERSION }, { instructions: instructionsFor(access) });
    // PortfolioApi wants a bearer token to allow admin calls. There is none
    // here: internalFetch replaces the header with a one-shot ticket, so the
    // value is a placeholder and only its presence (admin session or not) counts.
    registerTools(server, new PortfolioApi(INTERNAL_BASE, admin ? REPLACED_BY_TICKET : null, internalFetch(app, admin, req.ip ?? "")), access);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  const json = express.json({ limit: "1mb" });
  const mcpLimiter = limiter(60_000, 120);
  const toDocs: RequestHandler = (req, res, next) => (wantsHtml(req) ? res.redirect(303, "/developers/mcp") : next());
  const notAllowed: RequestHandler = (_req, res) =>
    res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });

  const bearer = requireBearerAuth({
    verifier: provider,
    requiredScopes: ["mcp:read"],
    resourceMetadataUrl: prmUrl(),
    expectedResource: new URL(resourceUrl()),
  });

  router.options("/mcp/public", publicCors);
  router.options("/mcp", authCors);
  router.get("/mcp/public", publicCors, toDocs, notAllowed);
  router.delete("/mcp/public", publicCors, notAllowed);
  router.post(
    "/mcp/public",
    publicCors,
    mcpLimiter,
    json,
    asyncHandler((req, res) => serve(req, res, "public", null)),
  );

  router.get("/mcp", authCors, toDocs, mcpLimiter, bearer, notAllowed);
  router.delete("/mcp", authCors, mcpLimiter, bearer, notAllowed);
  router.post(
    "/mcp",
    authCors,
    mcpLimiter,
    bearer,
    json,
    asyncHandler((req, res) => {
      const auth = (req as Request & { auth: AuthInfo }).auth;
      const write = auth.scopes.includes("mcp:write");
      const extra = auth.extra as { grantId: string; clientName: string; login: string };
      const admin: Admin = {
        login: extra.login,
        email: null,
        via: AUDIT_VIA,
        tokenId: extra.grantId,
        client: extra.clientName,
        scope: write ? "write" : "read",
      };
      return serve(req, res, write ? "write" : "read", admin);
    }),
  );

  return router;
}
