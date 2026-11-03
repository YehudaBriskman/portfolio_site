/*
 * Configuration, from the environment only.
 *
 * PORTFOLIO_API_URL is required and has no default: a default would be either
 * production, which a local experiment must never write to by accident, or
 * localhost, which silently talks to nothing in production. Say which.
 *
 * PORTFOLIO_ADMIN_TOKEN is optional. Without it the server registers only the
 * public read tools, so read-only is what you get unless you hand it a token.
 */
export type Config = { apiUrl: string; adminToken: string | null };

export function loadConfig(env: Record<string, string | undefined>): Config {
  const raw = env.PORTFOLIO_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "PORTFOLIO_API_URL is required (e.g. http://localhost:8080 or https://yehudabriskman.com). There is no default.",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PORTFOLIO_API_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`PORTFOLIO_API_URL must be http(s): ${raw}`);
  }
  const token = env.PORTFOLIO_ADMIN_TOKEN?.trim() || null;
  if (token && url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Refusing to send PORTFOLIO_ADMIN_TOKEN over plain http to a non-local host.");
  }
  return { apiUrl: url.origin + url.pathname.replace(/\/+$/, ""), adminToken: token };
}
