/*
 * Weak or missing settings that must not stop a boot: an API that refused to
 * start would take the public site's reads and contact form down with it. They
 * are said once, at startup, by name and never by value.
 */
type Checked = {
  NODE_ENV: string;
  ADMIN_PROXY_SECRET: string;
  COUCHDB_PASSWORD: string;
  MCP_REMOTE: "off" | "on";
  ADMIN_GITHUB_ID?: string;
};

const MIN_SECRET_LENGTH = 32;

export function envWarnings(env: Checked): string[] {
  const production = env.NODE_ENV === "production";
  const out: string[] = [];
  const secret = env.ADMIN_PROXY_SECRET;
  if (secret && secret.length < MIN_SECRET_LENGTH) {
    out.push(`ADMIN_PROXY_SECRET is shorter than ${MIN_SECRET_LENGTH} characters; use a longer random value`);
  } else if (!secret && production) {
    out.push("ADMIN_PROXY_SECRET is empty; admin sign-in through the proxy is refused");
  }
  if (!env.COUCHDB_PASSWORD && production) out.push("COUCHDB_PASSWORD is empty");
  if (env.MCP_REMOTE === "on" && !env.ADMIN_GITHUB_ID) {
    out.push("ADMIN_GITHUB_ID is not set while MCP_REMOTE is on; set it to pin the owner account");
  }
  return out;
}
