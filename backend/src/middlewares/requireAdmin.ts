import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import {
  parseToken,
  tokenDocId,
  tokenIsLive,
  tokenMatches,
  type StoredToken,
  type TokenScope,
} from "../services/apiTokenFormat.js";

type Admin = {
  login: string;
  email: string | null;
  /* How the request got in: the oauth2-proxy session, or an API token. */
  via: "proxy" | "token";
  tokenId: string | null;
  /* A proxy session is always `write`; a token carries its own scope. */
  scope: TokenScope;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: Admin;
    }
  }
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/*
 * Two ways in.
 *
 * 1. The browser, through the oauth2-proxy router. Two independent facts must
 *    both hold.
 *
 *    X-Auth-Request-User says WHO, but it is only a header — a request sent
 *    straight at the public ingress can set it to anything. So it proves
 *    nothing on its own.
 *
 *    X-Admin-Proxy-Secret proves the request TRAVERSED the authenticated
 *    router: Traefik strips any client-supplied copy first, then injects the
 *    real value only on the admin router. A client cannot forge it because it
 *    never sees it.
 *
 *    Neither alone is sufficient. Together they are.
 *
 * 2. Automation (the MCP server, #252), with `Authorization: Bearer ptk_...`,
 *    and only when ADMIN_API_TOKENS allows it:
 *      off     (the default) the header is ignored, and the request is judged
 *              as path 1 — exactly the behaviour before tokens existed;
 *      tunnel  only on a loopback socket, i.e. `kubectl port-forward` to the
 *              api pod; anything through nginx arrives from the web pod;
 *      on      from anywhere, the public domain included.
 *    The token names its stored document, whose SHA-256 must match, and which
 *    must be neither revoked nor expired. A `read` token may only GET; token
 *    management is proxy-only (see admin.route.ts), so a leaked token cannot
 *    mint another. A refusal is logged with the id's first characters only.
 *
 * The proxy path is checked first and is unchanged: a request carrying the
 * proof header is judged on it alone.
 */
const SAFE = new Set(["GET", "HEAD"]);
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export const bearerOf = (req: Request) => /^Bearer\s+(\S+)$/i.exec(req.header("authorization") ?? "")?.[1];

export function tokensAccepted(req: Pick<Request, "socket">): boolean {
  if (env.ADMIN_API_TOKENS === "on") return true;
  // The socket, never req.ip: X-Forwarded-For is the client's to write.
  if (env.ADMIN_API_TOKENS === "tunnel") return LOOPBACK.has(req.socket.remoteAddress ?? "");
  return false;
}

/* lastUsedAt: written at most once a minute per token, off the request's path. */
const LAST_USED_EVERY_MS = 60_000;
const lastUsedWrites = new Map<string, number>();

function touch(doc: StoredToken, now: Date) {
  const last = lastUsedWrites.get(doc.id) ?? Date.parse(doc.lastUsedAt ?? "");
  if (Number.isFinite(last) && now.getTime() - last < LAST_USED_EVERY_MS) return;
  lastUsedWrites.set(doc.id, now.getTime());
  couch.put(doc._id, { ...doc, lastUsedAt: now.toISOString() }).catch((e: unknown) => {
    // 409: revoked or touched elsewhere meanwhile; the next use tries again.
    if (e instanceof CouchError && e.status === 409) return;
    logger.warn({ err: e instanceof Error ? e.message : String(e), tokenId: doc.id }, "token lastUsedAt not recorded");
  });
}

type Refusal = "malformed" | "unknown" | "mismatch" | "revoked" | "expired";

async function tokenAdmin(bearer: string): Promise<{ admin: Admin } | { refused: Refusal; idPrefix: string | null }> {
  const parsed = parseToken(bearer);
  if (!parsed) return { refused: "malformed", idPrefix: null };
  const idPrefix = parsed.id.slice(0, 6);
  let doc: StoredToken;
  try {
    doc = await couch.get<StoredToken>(tokenDocId(parsed.id));
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return { refused: "unknown", idPrefix };
    throw e;
  }
  if (doc.type !== "apitoken" || !tokenMatches(bearer, doc.hash)) return { refused: "mismatch", idPrefix };
  const now = new Date();
  if (!tokenIsLive(doc, now)) return { refused: doc.revokedAt ? "revoked" : "expired", idPrefix };
  touch(doc, now);
  return { admin: { login: `token:${doc.name}`, email: null, via: "token", tokenId: doc.id, scope: doc.scope } };
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const proof = req.header("x-admin-proxy-secret");
  const bearer = bearerOf(req);

  if (proof === undefined && bearer && tokensAccepted(req)) {
    tokenAdmin(bearer)
      .then((r) => {
        if ("refused" in r) {
          // Never the secret, never the whole id: enough to tell tokens apart.
          logger.warn({ reason: r.refused, tokenIdPrefix: r.idPrefix, ip: req.ip }, "admin bearer token refused");
          return res.status(401).json({ ok: false, error: "unauthenticated" });
        }
        if (r.admin.scope === "read" && !SAFE.has(req.method)) {
          return res.status(403).json({ ok: false, error: "This token is read-only." });
        }
        req.admin = r.admin;
        next();
      })
      .catch(next);
    return;
  }

  if (!env.ADMIN_PROXY_SECRET || !safeEqual(proof ?? "", env.ADMIN_PROXY_SECRET)) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }
  const login = req.header("x-auth-request-user") ?? "";
  if (!login || login.toLowerCase() !== env.ADMIN_GITHUB_LOGIN.toLowerCase()) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  req.admin = { login, email: req.header("x-auth-request-email") ?? null, via: "proxy", tokenId: null, scope: "write" };
  next();
};

/*
 * Failed bearer attempts, limited far harder than adminLimiter's 240 a
 * minute: ten 401s per address per fifteen minutes. Only requests carrying a
 * Bearer header count, and only the ones refused as unauthenticated, so a
 * working token that sends a few invalid edits is not locked out.
 */
export const createBearerFailureLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => !bearerOf(req),
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  message: { ok: false, error: "Too many failed token attempts. Try again later." },
});

/* For routes a token must never reach, whatever its scope. */
export const requireProxySession: RequestHandler = (req, res, next) => {
  if (req.admin?.via !== "proxy") {
    return res.status(403).json({ ok: false, error: "This needs the admin sign-in, not a token." });
  }
  next();
};
