/*
 * The admin only works on the gated host: its sign-in sits in front of that name alone, so on the public site
 * every /api/admin call is a 401. Preprod and local development gate /admin on their own host and stay put.
 */
const PUBLIC_HOSTS = new Set(["yehudabriskman.com", "www.yehudabriskman.com"]);
const ADMIN_ORIGIN = "https://admin.yehudabriskman.com";

export function adminHostHref(at: Pick<Location, "hostname" | "pathname" | "search" | "hash">): string | null {
  return PUBLIC_HOSTS.has(at.hostname) ? `${ADMIN_ORIGIN}${at.pathname}${at.search}${at.hash}` : null;
}
