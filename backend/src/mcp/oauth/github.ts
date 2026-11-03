import { createHash } from "node:crypto";
import { couch, CouchError } from "../../db/couch.js";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { githubCallbackUrl } from "./config.js";
import { safeEqual, tryGet } from "./util.js";

/*
 * Sign-in is delegated to GitHub (#263): an OAuth app of its own
 * (MCP_GITHUB_CLIENT_ID / _SECRET), the authorization-code flow with a state
 * and PKCE S256 toward GitHub too. No scope is requested: GET /user answers
 * the public profile, which is all that is needed — who this is.
 *
 * The GitHub token is used for that one call and dropped. It is never stored
 * and never logged.
 */

export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function githubAuthorizeUrl(state: string, challenge: string) {
  const u = new URL("/login/oauth/authorize", env.MCP_GITHUB_OAUTH_URL);
  u.searchParams.set("client_id", env.MCP_GITHUB_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", githubCallbackUrl());
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("allow_signup", "false");
  return u.href;
}

export type GithubUser = { id: number; login: string };

export class GithubError extends Error {}

/** Exchanges GitHub's code (with our verifier) and asks GitHub who signed in. */
export async function githubIdentity(code: string, verifier: string): Promise<GithubUser> {
  const tokenRes = await fetch(new URL("/login/oauth/access_token", env.MCP_GITHUB_OAUTH_URL), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MCP_GITHUB_CLIENT_ID ?? "",
      client_secret: env.MCP_GITHUB_CLIENT_SECRET ?? "",
      code,
      code_verifier: verifier,
      redirect_uri: githubCallbackUrl(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenBody = (await tokenRes.json().catch(() => null)) as { access_token?: unknown; error?: unknown } | null;
  if (!tokenRes.ok || typeof tokenBody?.access_token !== "string") {
    // GitHub's error code only (e.g. bad_verification_code), never the body.
    throw new GithubError(`GitHub refused the sign-in (${typeof tokenBody?.error === "string" ? tokenBody.error : tokenRes.status})`);
  }
  const userRes = await fetch(new URL("/user", env.MCP_GITHUB_API_URL), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenBody.access_token}`,
      "User-Agent": "yehudabriskman.com-mcp",
    },
    signal: AbortSignal.timeout(10_000),
  });
  const user = (await userRes.json().catch(() => null)) as { id?: unknown; login?: unknown } | null;
  if (!userRes.ok || typeof user?.id !== "number" || typeof user?.login !== "string") {
    throw new GithubError(`GitHub did not say who signed in (${userRes.status})`);
  }
  return { id: user.id, login: user.login };
}

type OwnerDoc = { _id: "mcpowner"; type: "mcpowner"; githubId: number; login: string; recordedAt: string };

/**
 * Only the owner: ADMIN_GITHUB_LOGIN by login (case-insensitive) AND by
 * numeric id — ADMIN_GITHUB_ID if set, else the id recorded the first time
 * that login signed in here. A login is a name anyone can take once it is
 * given up; the id is not.
 */
export async function isOwner(user: GithubUser): Promise<boolean> {
  if (!safeEqual(user.login.toLowerCase(), env.ADMIN_GITHUB_LOGIN.toLowerCase())) return false;
  if (env.ADMIN_GITHUB_ID) return safeEqual(String(user.id), env.ADMIN_GITHUB_ID);
  const recorded = await tryGet<OwnerDoc>("mcpowner");
  if (recorded) return safeEqual(String(user.id), String(recorded.githubId));
  try {
    await couch.append("mcpowner", {
      _id: "mcpowner",
      type: "mcpowner",
      githubId: user.id,
      login: user.login,
      recordedAt: new Date().toISOString(),
    });
    logger.info({ githubId: user.id, login: user.login }, "mcp owner GitHub id recorded");
    return true;
  } catch (e) {
    // Recorded by a concurrent sign-in: judge against that.
    if (e instanceof CouchError && e.status === 409) {
      const now = await tryGet<OwnerDoc>("mcpowner");
      return !!now && safeEqual(String(user.id), String(now.githubId));
    }
    throw e;
  }
}
