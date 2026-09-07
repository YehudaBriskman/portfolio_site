import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: { login: string; email: string | null };
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
 * Two independent facts must both hold.
 *
 * X-Auth-Request-User says WHO, but it is only a header — a request sent
 * straight at the public ingress can set it to anything. So it proves nothing
 * on its own.
 *
 * X-Admin-Proxy-Secret proves the request TRAVERSED the authenticated router:
 * Traefik strips any client-supplied copy first, then injects the real value
 * only on the admin router. A client cannot forge it because it never sees it.
 *
 * Neither alone is sufficient. Together they are.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const proof = req.header("x-admin-proxy-secret") ?? "";
  const login = req.header("x-auth-request-user") ?? "";

  if (!env.ADMIN_PROXY_SECRET || !safeEqual(proof, env.ADMIN_PROXY_SECRET)) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }
  if (!login || login.toLowerCase() !== env.ADMIN_GITHUB_LOGIN.toLowerCase()) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  req.admin = { login, email: req.header("x-auth-request-email") ?? null };
  next();
};
